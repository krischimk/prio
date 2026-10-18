// @vitest-environment node
import { expect, it } from 'vitest'
import { generateKeyPair, SignJWT } from 'jose'
import { createOAuthFacade, tokenHash, vaultCipher, type VaultPort } from '../../server/mcp/oauth'

it('encrypts server credentials and gives the client only opaque, revocable Prio tokens', async () => {
  const { publicKey, privateKey } = await generateKeyPair('ES256')
  const config = { supabaseUrl: 'https://test.supabase.co', publishableKey: 'public', resourceUrl: 'https://prio.test/mcp', version: 'test' }
  const id = crypto.randomUUID(), actor = crypto.randomUUID(), session = crypto.randomUUID()
  const jwt = await new SignJWT({ role: 'authenticated', client_id: id, session_id: session }).setProtectedHeader({ alg: 'ES256' }).setIssuer(`${config.supabaseUrl}/auth/v1`).setAudience('authenticated').setSubject(actor).setIssuedAt().setExpirationTime('1h').sign(privateKey)
  const clients = new Map<string, Record<string, unknown>>()
  const tokens = new Map<string, Record<string, unknown>>()
  let revoked = false; let exchanges = 0
  const vault: VaultPort = async <T,>(operation: string, data: Record<string, unknown>) => {
    let result: unknown = null
    if (operation === 'client_put') { clients.set(data.id as string, data); result = data.metadata }
    if (operation === 'client_get') result = clients.get(data.id as string) ?? null
    if (operation === 'token_put') { tokens.set(data.access_hash as string, data); tokens.set(data.refresh_hash as string, data); result = { stored: true } }
    if (operation === 'access_get' && !revoked) { const row = tokens.get(data.hash as string); result = row ? { cipher: row.bundle_cipher } : null }
    if (operation === 'refresh_get' && !revoked) { const row = tokens.get(data.hash as string); result = row ? { cipher: row.bundle_cipher, replay: false } : null }
    return result as T
  }
  const fetcher: typeof fetch = async (url, init) => {
    if (String(url).endsWith('/clients/register')) {
      expect(JSON.parse(init!.body as string).token_endpoint_auth_method).toBe('client_secret_basic')
      return Response.json({ client_id: id, client_secret: 'server-confidential-secret' }, { status: 201 })
    }
    expect(new Headers(init!.headers).get('Authorization')).toBe(`Basic ${btoa(`${id}:server-confidential-secret`)}`)
    const params = new URLSearchParams(init!.body as string)
    if (params.get('grant_type') === 'refresh_token') expect(params.get('refresh_token')).toBe('upstream-refresh-private')
    exchanges++
    return Response.json({ access_token: jwt, refresh_token: 'upstream-refresh-private', scope: 'profile offline_access', id_token: 'NEVER RETURN PROVIDER TOKENS' })
  }
  const facade = createOAuthFacade(config, 'secret', { vault, fetcher, key: async () => publicKey })
  const post = (path: string, body: unknown, form = false) => facade.fetch(new Request(`https://prio.test${path}`, { method: 'POST', headers: { 'Content-Type': form ? 'application/x-www-form-urlencoded' : 'application/json' }, body: form ? new URLSearchParams(body as Record<string,string>).toString() : JSON.stringify(body) }))
  const registered = await (await post('/oauth/register', { redirect_uris: ['https://chatgpt.com/callback'], client_name: 'ChatGPT', token_endpoint_auth_method: 'none' })).json()
  expect(registered.client_id).toBe(id); expect(registered.token_endpoint_auth_method).toBe('none'); expect(registered.client_secret).toBeUndefined()
  expect(JSON.stringify([...clients.values()])).not.toContain('server-confidential-secret')
  const params = { client_id: id, code: 'provider-code', code_verifier: 'v'.repeat(43), grant_type: 'authorization_code', redirect_uri: 'https://chatgpt.com/callback', resource: config.resourceUrl }
  const token = await (await post('/oauth/token', params, true)).json()
  expect(token.access_token).toMatch(/^prio_access_/); expect(token.refresh_token).toMatch(/^prio_refresh_/)
  expect(JSON.stringify(token)).not.toContain(jwt); expect(token.id_token).toBeUndefined()
  expect(await facade.accessToken(token.access_token)).toBe(jwt)
  expect(await facade.accessToken(jwt)).toBeNull()
  expect(JSON.stringify([...tokens.values()])).not.toContain(jwt)
  expect(tokens.has(await tokenHash(token.access_token))).toBe(true)
  const refreshed = await (await post('/oauth/token', { client_id: id, grant_type: 'refresh_token', refresh_token: token.refresh_token }, true)).json()
  expect(refreshed.access_token).not.toBe(token.access_token); expect(exchanges).toBe(2)
  revoked = true
  expect(await facade.accessToken(refreshed.access_token)).toBeNull()
  expect((await post('/oauth/token', { ...params, resource: 'https://evil.test/mcp' }, true)).status).toBe(400)
  expect((await post('/oauth/register', { redirect_uris: ['javascript:alert(1)'] })).status).toBe(400)
  expect((await post('/oauth/register', null)).status).toBe(400)
})

it('authenticates ciphertext context and key, so client-secret and token bundles cannot be substituted', async () => {
  const cipher = await vaultCipher('secret', 'tokens')
  const value = await cipher.seal({ token: 'private' })
  expect(await cipher.open(value)).toEqual({ token: 'private' })
  await expect((await vaultCipher('secret', 'client')).open(value)).rejects.toThrow()
  await expect((await vaultCipher('wrong-key', 'tokens')).open(value)).rejects.toThrow()
})
