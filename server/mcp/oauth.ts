import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose'
import type { McpConfig } from './types'
import { CommandError } from './types'
import { signRequest } from './cloud'

const enc = new TextEncoder()
const base64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
const unbase64 = (value: string) => Uint8Array.from(atob(value.replaceAll('-', '+').replaceAll('_', '/')), value => value.charCodeAt(0))
export async function tokenHash(value: string) { return [...new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(value)))].map(byte => byte.toString(16).padStart(2, '0')).join('') }
export async function vaultCipher(secret: string, purpose: string) {
  const raw = await crypto.subtle.digest('SHA-256', enc.encode(`prio-mcp-vault-v1\0${secret}`))
  const key = await crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt'])
  return {
    async seal(value: unknown) {
      const iv = crypto.getRandomValues(new Uint8Array(12))
      const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: enc.encode(purpose) }, key, enc.encode(JSON.stringify(value)))
      return `${base64(iv)}.${base64(new Uint8Array(encrypted))}`
    },
    async open<T>(value: string): Promise<T> {
      const [iv, body] = value.split('.')
      return JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unbase64(iv), additionalData: enc.encode(purpose) }, key, unbase64(body)))) as T
    },
  }
}
interface RegisteredClient { id: string; secret_cipher: string; metadata: { client_id: string; redirect_uris: string[] } }
interface Bundle { upstream_access_token: string; upstream_refresh_token: string; access_token: string; refresh_token: string; client_id: string; expires_at: number; scope: string }
interface VaultToken { cipher?: string; replay?: boolean; busy?: boolean }
export type VaultPort = <T>(operation: string, data: Record<string, unknown>) => Promise<T>

export function createOAuthFacade(config: McpConfig, secret: string, options: { fetcher?: typeof fetch; vault?: VaultPort; key?: JWTVerifyGetKey } = {}) {
  const fetcher = options.fetcher ?? fetch
  const origin = new URL(config.resourceUrl).origin
  const issuer = `${config.supabaseUrl}/auth/v1`
  const jwks = options.key ?? createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`))
  const vault: VaultPort = options.vault ?? (async <T>(operation: string, data: Record<string, unknown>) => {
    if (!secret) throw new Error('MCP not configured')
    const request = JSON.stringify({ purpose: 'prio-mcp-vault-v1', resource: config.resourceUrl, issued_at: Math.floor(Date.now() / 1000), operation, data })
    const result = await fetcher(`${config.supabaseUrl}/rest/v1/rpc/mcp_vault`, { method: 'POST', headers: { apikey: config.publishableKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_request: request, p_proof: await signRequest(request, secret) }), signal: AbortSignal.timeout(10_000) })
    if (!result.ok) throw new CommandError('temporarily_unavailable', 'Connection store unavailable.')
    return await result.json() as T
  })
  async function client(id: string) {
    if (!/^[a-f0-9-]{36}$/i.test(id)) return null
    return vault<RegisteredClient | null>('client_get', { id })
  }
  const clientCipher = (id: string) => vaultCipher(secret, `${config.resourceUrl}:client:${id}`)
  const bundleCipher = () => vaultCipher(secret, `${config.resourceUrl}:tokens`)
  const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*', Pragma: 'no-cache' } })
  const error = (code: string, status = 400) => json({ error: code }, status)
  function publicTokens(bundle: Bundle) { return { access_token: bundle.access_token, refresh_token: bundle.refresh_token, token_type: 'Bearer', expires_in: Math.max(0, bundle.expires_at - Math.floor(Date.now() / 1000)), scope: bundle.scope } }
  return {
    async accessToken(token: string): Promise<string | null> {
      if (!/^prio_access_[A-Za-z0-9_-]{43}$/.test(token)) return null
      const stored = await vault<VaultToken | null>('access_get', { hash: await tokenHash(token) })
      if (!stored?.cipher) return null
      return (await (await bundleCipher()).open<Bundle>(stored.cipher)).upstream_access_token
    },
    async fetch(request: Request): Promise<Response> {
      const url = new URL(request.url)
      if (url.origin !== origin || request.headers.has('Host') && request.headers.get('Host') !== url.host) return error('invalid_host', 403)
      if (url.pathname === '/.well-known/oauth-authorization-server') return json({ issuer: origin, authorization_endpoint: `${origin}/oauth/authorize`, token_endpoint: `${origin}/oauth/token`, registration_endpoint: `${origin}/oauth/register`,
        response_types_supported: ['code'], grant_types_supported: ['authorization_code', 'refresh_token'], code_challenge_methods_supported: ['S256'], token_endpoint_auth_methods_supported: ['none'], scopes_supported: ['profile', 'offline_access'] })
      if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' } })
      try {
        if (url.pathname === '/oauth/register' && request.method === 'POST') {
          if (Number(request.headers.get('Content-Length') ?? 0) > 10000) return error('invalid_client_metadata')
          const raw = await limitedBody(request)
          let data: { redirect_uris?: unknown; client_name?: unknown; token_endpoint_auth_method?: unknown }
          try { data = JSON.parse(raw) as typeof data } catch { return error('invalid_client_metadata') }
          if (!data || typeof data !== 'object') return error('invalid_client_metadata')
          if (!Array.isArray(data.redirect_uris) || !data.redirect_uris.length || data.redirect_uris.length > 10 || data.redirect_uris.some(value => {
            if (typeof value !== 'string' || value.length > 2000) return true
            try { const redirect = new URL(value); return !!redirect.hash || !!redirect.username || !!redirect.password || !(redirect.protocol === 'https:' || redirect.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(redirect.hostname)) } catch { return true }
          }) || data.token_endpoint_auth_method && data.token_endpoint_auth_method !== 'none') return error('invalid_client_metadata')
          const name = typeof data.client_name === 'string' ? data.client_name.trim().slice(0, 200) || 'Prio client' : 'Prio client'
          const upstream = await fetcher(`${issuer}/oauth/clients/register`, { method: 'POST', headers: { apikey: config.publishableKey, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(10_000),
            body: JSON.stringify({ client_name: name, redirect_uris: data.redirect_uris, token_endpoint_auth_method: 'client_secret_basic', grant_types: ['authorization_code', 'refresh_token'], response_types: ['code'] }) })
          if (!upstream.ok) return error('temporarily_unavailable', 503)
          const result = await upstream.json() as { client_id: string; client_secret: string }
          if (!result.client_id || !result.client_secret) return error('temporarily_unavailable', 503)
          const metadata = { client_id: result.client_id, client_name: name, redirect_uris: data.redirect_uris, token_endpoint_auth_method: 'none', grant_types: ['authorization_code', 'refresh_token'], response_types: ['code'] }
          await vault('client_put', { id: result.client_id, secret_cipher: await (await clientCipher(result.client_id)).seal(result.client_secret), metadata })
          return json(metadata, 201)
        }
        if (url.pathname === '/oauth/authorize' && request.method === 'GET') {
          const params = url.searchParams
          if (params.get('response_type') !== 'code' || params.get('code_challenge_method') !== 'S256' || !/^[A-Za-z0-9_-]{43}$/.test(params.get('code_challenge') ?? '')) return error('invalid_request')
          const registered = await client(params.get('client_id') ?? '')
          if (!registered || !registered.metadata.redirect_uris.includes(params.get('redirect_uri') ?? '')) return error('invalid_client')
          if (params.has('resource') && params.getAll('resource').some(value => value !== config.resourceUrl)) return error('invalid_target')
          const destination = new URL(`${issuer}/oauth/authorize`)
          for (const key of ['client_id', 'redirect_uri', 'response_type', 'code_challenge', 'code_challenge_method', 'state', 'scope']) if (params.has(key)) destination.searchParams.set(key, params.get(key)!)
          destination.searchParams.set('resource', config.resourceUrl)
          return new Response(null, { status: 302, headers: { Location: destination.href, 'Cache-Control': 'no-store' } })
        }
        if (url.pathname !== '/oauth/token' || request.method !== 'POST') return error('invalid_request')
        if (!request.headers.get('Content-Type')?.startsWith('application/x-www-form-urlencoded')) return error('invalid_request')
        const raw = await limitedBody(request)
        const params = new URLSearchParams(raw)
        const registered = await client(params.get('client_id') ?? '')
        if (!registered || request.headers.has('Authorization') || params.get('client_secret')) return error('invalid_client', 401)
        if (params.has('resource') && params.getAll('resource').some(value => value !== config.resourceUrl)) return error('invalid_target')
        const grant = params.get('grant_type')
        let oldHash: string | undefined; const lease = crypto.randomUUID()
        if (grant === 'refresh_token') {
          const opaque = params.get('refresh_token') ?? ''
          if (!/^prio_refresh_[A-Za-z0-9_-]{43}$/.test(opaque)) return error('invalid_grant')
          oldHash = await tokenHash(opaque)
          const stored = await vault<VaultToken | null>('refresh_get', { hash: oldHash, client_id: registered.id, lease })
          if (stored?.busy) return error('temporarily_unavailable', 503)
          if (!stored?.cipher) return error('invalid_grant')
          const bundle = await (await bundleCipher()).open<Bundle>(stored.cipher)
          if (stored.replay) return json(publicTokens(bundle))
          params.set('refresh_token', bundle.upstream_refresh_token)
        } else if (grant !== 'authorization_code' || !/^[A-Za-z0-9._~-]{43,128}$/.test(params.get('code_verifier') ?? '') || !registered.metadata.redirect_uris.includes(params.get('redirect_uri') ?? '') || !params.get('code')) return error('invalid_grant')
        params.delete('client_secret'); params.set('resource', config.resourceUrl)
        const upstreamSecret = await (await clientCipher(registered.id)).open<string>(registered.secret_cipher)
        try {
          const upstream = await fetcher(`${issuer}/oauth/token`, { method: 'POST', headers: { apikey: config.publishableKey, Authorization: `Basic ${btoa(`${registered.id}:${upstreamSecret}`)}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body: params.toString(), signal: AbortSignal.timeout(15_000) })
          if (!upstream.ok) return error(upstream.status >= 500 ? 'temporarily_unavailable' : 'invalid_grant', upstream.status >= 500 ? 503 : 400)
          const result = await upstream.json() as { access_token: string; refresh_token: string; scope?: string }
          const { payload } = await jwtVerify(result.access_token, jwks, { issuer, audience: 'authenticated', algorithms: ['ES256', 'RS256'], requiredClaims: ['sub', 'client_id', 'session_id', 'exp'] })
          if (payload.client_id !== registered.id || payload.role !== 'authenticated' || !result.refresh_token) return error('invalid_grant')
          const bundle: Bundle = { upstream_access_token: result.access_token, upstream_refresh_token: result.refresh_token, client_id: registered.id,
            access_token: `prio_access_${base64(crypto.getRandomValues(new Uint8Array(32)))}`, refresh_token: `prio_refresh_${base64(crypto.getRandomValues(new Uint8Array(32)))}`, expires_at: payload.exp!, scope: result.scope ?? 'profile offline_access' }
          await vault('token_put', { access_hash: await tokenHash(bundle.access_token), refresh_hash: await tokenHash(bundle.refresh_token), bundle_cipher: await (await bundleCipher()).seal(bundle),
            user_id: payload.sub, client_id: registered.id, session_id: payload.session_id, expires_at: new Date(payload.exp! * 1000).toISOString(), old_refresh_hash: oldHash, lease })
          return json(publicTokens(bundle))
        } finally { if (oldHash) await vault('refresh_release', { hash: oldHash, lease }).catch(() => {}) }
      } catch { return error('temporarily_unavailable', 503) }
    },
  }
}

async function limitedBody(request: Request) {
  const reader = request.body?.getReader(); if (!reader) return ''
  let size = 0; const chunks: Uint8Array[] = []
  try {
    for (;;) { const part = await reader.read(); if (part.done) break; size += part.value.length
      if (size > 10000) { await reader.cancel(); throw new Error('Request too large') }; chunks.push(part.value) }
  } finally { reader.releaseLock() }
  const bytes = new Uint8Array(size); let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length }
  return new TextDecoder().decode(bytes)
}
