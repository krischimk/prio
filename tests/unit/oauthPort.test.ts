import { expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createSupabaseOAuthPort } from '../../src/auth/supabaseOAuth'

it('shares one stateful authorization lookup between concurrent React effect mounts', async () => {
  const get = vi.fn().mockResolvedValueOnce({ data: { redirect_url: 'https://chatgpt.com/callback?code=once' }, error: null }).mockResolvedValue({ data: null, error: new Error('already processed') })
  const client = { auth: { oauth: { getAuthorizationDetails: get } }, rpc: vi.fn().mockResolvedValue({ data: { resumable: true }, error: null }) } as unknown as SupabaseClient
  const port = createSupabaseOAuthPort(client)
  const result = await Promise.all([port.details('one'), port.details('one')])
  expect(result).toEqual([{ redirect_url: 'https://chatgpt.com/callback?code=once' }, { redirect_url: 'https://chatgpt.com/callback?code=once' }])
  expect(get).toHaveBeenCalledTimes(1)
})

it('does not resume a revoked native grant even when the provider auto-approved an old consent', async () => {
  const revoke = vi.fn().mockResolvedValue({ error: null })
  const client = { auth: { oauth: { getAuthorizationDetails: vi.fn().mockResolvedValue({ data: { redirect_url: 'https://chatgpt.com/callback' }, error: null }), revokeGrant: revoke } },
    rpc: vi.fn().mockResolvedValue({ data: { resumable: false, client_id: 'client' }, error: null }) } as unknown as SupabaseClient
  await expect(createSupabaseOAuthPort(client).details('old')).rejects.toThrow('widerrufen')
  expect(revoke).toHaveBeenCalledWith({ clientId: 'client' })
})

it('records limited Prio permissions before approving OAuth and revokes the native grant first', async () => {
  const events: string[] = []
  const client = { auth: { oauth: { approveAuthorization: vi.fn(async () => { events.push('oauth-approve'); return { data: { redirect_url: 'https://chatgpt.com/callback' }, error: null } }),
    revokeGrant: vi.fn(async () => { events.push('oauth-revoke'); return { error: null } }) } },
    rpc: vi.fn(async (_name, { p_action }) => { events.push(p_action); return { data: {}, error: null } }) } as unknown as SupabaseClient
  const port = createSupabaseOAuthPort(client)
  await port.approve('one', { can_write: true, can_share: false, time_zone: 'Europe/Berlin' })
  await port.revoke('client')
  expect(events).toEqual(['authorize', 'oauth-approve', 'revoke', 'oauth-revoke'])
})
