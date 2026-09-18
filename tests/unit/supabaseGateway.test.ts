import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import { createSupabaseGateway } from '../../src/sync/supabaseGateway'
import { classifyRemoteError, RemoteError } from '../../src/sync/remoteGateway'
import { localMember, localTask, remoteList } from '../support/factories'

/**
 * Supabase-Gateway (unit) – mit vollständig gemocktem Supabase-Client.
 *
 * Damit ist belegt, dass die Sync-Engine ohne echten Cloud-Zugriff getestet
 * werden kann und dass Netzwerkfehler nicht als Datenfehler missverstanden
 * werden.
 */

interface MockBehaviour {
  select?(table: string): { data: unknown[] | null; error: unknown }
  upsert?(table: string, rows: unknown, options: unknown): { error: unknown }
  rpc?(name: string, args: unknown): { data: unknown; error: unknown }
}

function createMockClient(behaviour: MockBehaviour) {
  const select = vi.fn(async (table: string) => behaviour.select?.(table) ?? { data: [], error: null })
  const upsert = vi.fn(async (table: string, rows: unknown, options: unknown) =>
    behaviour.upsert?.(table, rows, options) ?? { error: null },
  )
  const rpc = vi.fn(async (name: string, args: unknown) => behaviour.rpc?.(name, args) ?? { data: null, error: null })

  const client = {
    from: (table: string) => ({
      select: () => select(table),
      upsert: (rows: unknown, options: unknown) => upsert(table, rows, options),
    }),
    rpc: (name: string, args: unknown) => rpc(name, args),
  }

  return { client: client as unknown as SupabaseClient, select, upsert, rpc }
}

describe('Supabase-Gateway', () => {
  it('lädt Listen, Mitgliedschaften und Aufgaben', async () => {
    const { client } = createMockClient({
      select: (table) => {
        if (table === 'lists') return { data: [remoteList()], error: null }
        if (table === 'list_members') return { data: [localMember()], error: null }
        return { data: [localTask()], error: null }
      },
    })

    const snapshot = await createSupabaseGateway(client).pull()

    expect(snapshot.lists).toHaveLength(1)
    expect(snapshot.members).toHaveLength(1)
    expect(snapshot.tasks).toHaveLength(1)
  })

  it('lädt in der Reihenfolge Listen → Mitglieder → Aufgaben hoch', async () => {
    const order: string[] = []
    const { client, upsert } = createMockClient({
      upsert: (table) => {
        order.push(table)
        return { error: null }
      },
    })

    await createSupabaseGateway(client).push({
      lists: [remoteList()],
      members: [localMember()],
      tasks: [localTask()],
    })

    expect(order).toEqual(['lists', 'list_members', 'tasks'])
    expect(upsert).toHaveBeenCalledTimes(3)
    expect(upsert.mock.calls[1]?.[2]).toEqual({ onConflict: 'list_id,user_id' })
  })

  it('überspringt leere Tabellen', async () => {
    const { client, upsert } = createMockClient({})
    await createSupabaseGateway(client).push({ lists: [], members: [], tasks: [] })
    expect(upsert).not.toHaveBeenCalled()
  })

  it('meldet einen nicht erreichbaren Server als Offline-Fehler', async () => {
    const { client } = createMockClient({
      select: () => ({ data: null, error: { message: 'TypeError: Failed to fetch' } }),
    })

    await expect(createSupabaseGateway(client).pull()).rejects.toMatchObject({ kind: 'offline' })
  })

  it('meldet eine abgelaufene Sitzung als Auth-Fehler', async () => {
    const { client } = createMockClient({
      select: () => ({ data: null, error: { message: 'JWT expired', code: 'PGRST301' } }),
    })

    await expect(createSupabaseGateway(client).pull()).rejects.toMatchObject({ kind: 'auth' })
  })

  it('meldet eine abgelehnte Schreiboperation als Serverfehler', async () => {
    const { client } = createMockClient({
      upsert: () => ({ error: { message: 'new row violates row-level security policy', code: '42501' } }),
    })

    await expect(
      createSupabaseGateway(client).push({ lists: [], members: [], tasks: [localTask()] }),
    ).rejects.toMatchObject({ kind: 'server' })
  })

  it('gibt beim Teilen die Benutzer-ID zurück', async () => {
    const { client, rpc } = createMockClient({
      rpc: (name) => {
        expect(name).toBe('share_list_by_email')
        return { data: 'user-b', error: null }
      },
    })

    const result = await createSupabaseGateway(client).shareListByEmail('list-1', 'b@example.com')

    expect(result).toEqual({ userId: 'user-b' })
    expect(rpc).toHaveBeenCalledWith('share_list_by_email', {
      p_list_id: 'list-1',
      p_email: 'b@example.com',
    })
  })

  it('reicht eine Fehlermeldung des Teilens verständlich weiter', async () => {
    const { client } = createMockClient({
      rpc: () => ({ data: null, error: { message: 'Es gibt keinen registrierten Nutzer mit dieser E-Mail-Adresse.' } }),
    })

    await expect(createSupabaseGateway(client).shareListByEmail('list-1', 'x@example.com')).rejects.toThrow(
      /keinen registrierten Nutzer/,
    )
  })
})

describe('Fehlerklassifikation', () => {
  it('erkennt Netzwerkfehler unabhängig von der Formulierung', () => {
    expect(classifyRemoteError(new TypeError('Failed to fetch')).kind).toBe('offline')
    expect(classifyRemoteError({ name: 'AuthRetryableFetchError', message: 'x' }).kind).toBe('offline')
    expect(classifyRemoteError(new Error('connect ETIMEDOUT')).kind).toBe('offline')
  })

  it('erkennt Auth- und Serverfehler', () => {
    expect(classifyRemoteError({ message: 'nope', status: 401 }).kind).toBe('auth')
    expect(classifyRemoteError({ message: 'nope', status: 403 }).kind).toBe('server')
    expect(classifyRemoteError(new Error('irgendwas')).kind).toBe('server')
  })

  it('lässt bereits klassifizierte Fehler unverändert', () => {
    const error = new RemoteError('offline', 'schon klassifiziert')
    expect(classifyRemoteError(error)).toBe(error)
  })
})
