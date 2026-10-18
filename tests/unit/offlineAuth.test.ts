import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createSupabaseAuthPort } from '../../src/auth/supabaseAuth'

const user = { id: 'account-one', email: 'privat@example.com', user_metadata: { username: 'krischi' } }
const session = { user, access_token: 'expired-access', refresh_token: 'refresh', expires_at: 1 }
const clientWithSession = (getSession = vi.fn().mockResolvedValue({ data: { session: null }, error: null })) => ({
  client: { auth: { getSession } } as unknown as SupabaseClient, getSession,
})
function storage(value: string | null) { vi.stubGlobal('localStorage', { getItem: () => value }) }
afterEach(() => vi.unstubAllGlobals())

describe('lokaler Sitzungsstart', () => {
  it('öffnet das gespeicherte Konto sofort, selbst wenn das SDK noch auf das Netz wartet', async () => {
    storage(JSON.stringify(session))
    const { client, getSession } = clientWithSession(vi.fn(() => new Promise(() => {})))
    await expect(createSupabaseAuthPort(client).getCurrentUser()).resolves.toEqual({ id: user.id, email: user.email, username: 'krischi' })
    // Der Supabase-Client erneuert bereits selbst im Hintergrund. Keine zweite
    // synchron abzuwartende Erneuerung für die reine lokale Kontoauswahl.
    expect(getSession).not.toHaveBeenCalled()
  })

  it('erfindet bei fehlender gespeicherter Sitzung keine Anmeldung', async () => {
    storage(null)
    const { client, getSession } = clientWithSession()
    await expect(createSupabaseAuthPort(client).getCurrentUser()).resolves.toBeNull()
    expect(getSession).toHaveBeenCalledOnce()
  })

  it.each(['{kaputt', '{}', JSON.stringify({ ...session, refresh_token: null }), JSON.stringify({ ...session, user: { id: null } })])('verträgt beschädigte gespeicherte Sitzungen: %s', async value => {
    storage(value)
    const { client } = clientWithSession()
    await expect(createSupabaseAuthPort(client).getCurrentUser()).resolves.toBeNull()
  })

  it('verträgt gesperrten Browser-Speicher', async () => {
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('Speicher gesperrt') } })
    const { client } = clientWithSession()
    await expect(createSupabaseAuthPort(client).getCurrentUser()).resolves.toBeNull()
  })

  it('blockiert den lokalen Start nicht für die Profilprüfung eines alten Kontos', async () => {
    storage(JSON.stringify({ ...session, user: { ...user, user_metadata: {} } }))
    const { client, getSession } = clientWithSession(vi.fn(() => new Promise(() => {})))
    await expect(createSupabaseAuthPort(client).getCurrentUser()).resolves.toEqual({ id: user.id, email: user.email, username: null })
    expect(getSession).toHaveBeenCalledOnce()
  })
})
