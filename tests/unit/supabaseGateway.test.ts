import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import { createSupabaseGateway } from '../../src/sync/supabaseGateway'
import { classifyRemoteError, RemoteError } from '../../src/sync/remoteGateway'
import { localMember, localTask, remoteList, remoteMember, localListPreference, localUserPreference } from '../support/factories'
import { toRemotePreference, toRemoteUserPreference } from '../../src/domain/mapping'

/**
 * Supabase-Gateway (unit) – mit vollständig gemocktem Supabase-Client.
 *
 * Damit ist belegt, dass die Sync-Engine ohne echten Cloud-Zugriff getestet
 * werden kann und dass Netzwerkfehler nicht als Datenfehler missverstanden
 * werden.
 */

interface MockBehaviour {
  select?(table: string, from?: number, to?: number): { data: unknown[] | null; error: unknown; count?: number }
  upsert?(table: string, rows: unknown, options: unknown): { error: unknown }
  rpc?(name: string, args: unknown): { data: unknown; error: unknown }
}

function createMockClient(behaviour: MockBehaviour) {
  const select = vi.fn(async (table: string, from: number, to: number) => {
    const answer = behaviour.select?.(table, from, to) ?? { data: [], error: null }
    return { ...answer, count: answer.count ?? answer.data?.length ?? 0 }
  })
  const upsert = vi.fn(async (table: string, rows: unknown, options: unknown) =>
    behaviour.upsert?.(table, rows, options) ?? { error: null },
  )
  const rpc = vi.fn(async (name: string, args: unknown) => behaviour.rpc?.(name, args) ?? {
    data: name === 'sync_push' ? (args as { p_changes: Array<{ table: string; row: Record<string, unknown> }> }).p_changes.map(change => ({
      table: change.table, id: change.table === 'members' || change.table === 'preferences' ? `${change.row.list_id}:${change.row.user_id}` : change.row.id, kind: 'written', current: change.row,
    })) : null, error: null,
  })

  const client = {
    from: (table: string) => ({
      select: () => {
        const query = { order: () => query, range: (from: number, to: number) => select(table, from, to) }
        return query
      },
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
        return { data: table === 'tasks' ? [localTask()] : [], error: null }
      },
    })

    const snapshot = await createSupabaseGateway(client).pull()

    expect(snapshot.lists).toHaveLength(1)
    expect(snapshot.members).toHaveLength(1)
    expect(snapshot.tasks).toHaveLength(1)
  })

  it('liest und bestätigt beide persönlichen Einstellungen über denselben geschützten Pfad', async () => {
    const preference = toRemotePreference(localListPreference({ include_in_overview: true }))
    const userPreference = toRemoteUserPreference(localUserPreference({ overview_mode: 'newest' }))
    const { client, rpc } = createMockClient({ select: table => ({ data: table === 'list_preferences' ? [preference] : table === 'user_preferences' ? [userPreference] : [], error: null }) })
    const gateway = createSupabaseGateway(client)
    expect(await gateway.pull()).toMatchObject({ preferences: [preference], userPreferences: [userPreference] })
    const pushed = await gateway.push({ lists: [], members: [], tasks: [], preferences: [preference], userPreferences: [userPreference] })
    expect(pushed.hochgeladen.preferences).toEqual([preference])
    expect(pushed.hochgeladen.userPreferences).toEqual([userPreference])
    expect(rpc.mock.calls[0]?.[0]).toBe('sync_push')
  })

  it('sendet Listen → Mitglieder → Aufgaben durch den geschützten Serverpfad', async () => {
    const { client, rpc, upsert } = createMockClient({})
    const list = remoteList()
    await createSupabaseGateway(client).push({ lists: [list], members: [localMember()], tasks: [localTask()] })
    expect(rpc.mock.calls[0]?.[0]).toBe('sync_push')
    const request = rpc.mock.calls[0]![1] as { p_changes: Array<{table:string;expected:unknown}> }
    expect(request.p_changes.map(change => change.table)).toEqual(['lists','members','tasks'])
    expect(upsert).not.toHaveBeenCalled()
  })

  it('überspringt leere Tabellen', async () => {
    const { client, upsert } = createMockClient({})
    await createSupabaseGateway(client).push({ lists: [], members: [], tasks: [] })
    expect(upsert).not.toHaveBeenCalled()
  })

  it('bewahrt serverseitige Mikrosekunden im Erstellzeitpunkt und in der Bestätigung', async () => {
    const base = remoteMember({ created_at: '2026-01-01T12:00:00.123456+00:00' })
    const changed = { ...base, created_at: '2026-01-01T12:00:00.123Z', deleted_at: '2026-01-02T00:00:00.000Z' }
    const saved = { ...changed, created_at: base.created_at }
    const { client, rpc } = createMockClient({ rpc: () => ({ data: [
      { table: 'members', id: `${base.list_id}:${base.user_id}`, kind: 'written', current: saved },
    ], error: null }) })
    const result = await createSupabaseGateway(client).push(
      { lists: [], members: [changed], tasks: [] },
      { lists: {}, members: { [`${base.list_id}:${base.user_id}`]: base }, tasks: {} },
    )

    const request = rpc.mock.calls[0]![1] as { p_changes: Array<{ row: typeof saved }> }
    expect(request.p_changes[0].row.created_at).toBe(base.created_at)
    expect(result.hochgeladen.members).toEqual([saved])
  })

  it('übernimmt keine Konfliktantwort mit einer fremden Aufgabenkennung', async () => {
    const sent = localTask({ id: 'sent' })
    const { client } = createMockClient({ rpc: () => ({ data: [
      { table: 'tasks', id: 'sent', kind: 'conflict', current: { ...sent, id: 'other' } },
    ], error: null }) })
    await expect(createSupabaseGateway(client).push({ lists: [], members: [], tasks: [sent] }))
      .rejects.toMatchObject({ message: 'sync-protocol', retryable: true })
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

  it('ordnet die Ablehnung nur ihrer Zeile zu und bestätigt die andere', async () => {
    const bad = localTask({ id: 'bad' }); const good = localTask({ id: 'good' })
    const { client } = createMockClient({ rpc: () => ({ data: [
      { table: 'tasks', id: 'bad', kind: 'rejected', message: 'RLS', code: '42501' },
      { table: 'tasks', id: 'good', kind: 'written', current: good },
    ], error: null }) })
    const result = await createSupabaseGateway(client).push({ lists: [], members: [], tasks: [bad, good] })
    expect(result.fehler).toHaveLength(1)
    expect(result.fehler[0]).toMatchObject({ tabelle: 'tasks', ids: ['bad'], error: { kind: 'server', retryable: false } })
    expect(result.hochgeladen.tasks).toEqual([good])
  })

  it('liest über das Seitenlimit hinaus, auch bei einer kleineren Projektgrenze', async () => {
    const rows = Array.from({length: 1201}, (_,index)=>localTask({id: `task-${index}`}))
    const { client, select } = createMockClient({ select: (table,from=0) => ({ data: table === 'tasks' ? rows.slice(from,from+250) : [], count: table === 'tasks' ? rows.length : 0, error: null }) })
    expect((await createSupabaseGateway(client).pull()).tasks).toHaveLength(1201)
    expect(select.mock.calls.filter(call=>call[0]==='tasks').map(call=>call[1])).toEqual([0,250,500,750,1000])
  })

  it('fällt bei fehlender Serverfunktion nicht auf ungeschützte Upserts zurück', async () => {
    const { client, upsert } = createMockClient({ rpc: ()=>({data:null,error:{code:'PGRST202',message:'RPC missing'}}) })
    const result = await createSupabaseGateway(client).push({lists:[remoteList()],members:[],tasks:[]})
    expect(result.hochgeladen.lists).toEqual([])
    expect(upsert).not.toHaveBeenCalled()
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
    expect(classifyRemoteError({ message: 'Dienst gestört' }, 503)).toMatchObject({ kind: 'server', retryable: true })
    expect(classifyRemoteError({ message: 'Deadlock', code: '40P01' }).retryable).toBe(true)
  })

  it('lässt bereits klassifizierte Fehler unverändert', () => {
    const error = new RemoteError('offline', 'schon klassifiziert')
    expect(classifyRemoteError(error)).toBe(error)
  })
})
