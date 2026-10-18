import { createMcpHandler } from '@modelcontextprotocol/server'
import { createRemoteJWKSet, jwtVerify, errors, type JWTVerifyGetKey } from 'jose'
import { createServer } from './server'
import { createCloudPort, readConnection } from './cloud'
import type { CloudPort, Connection, McpConfig } from './types'
import { CommandError } from './types'

export interface HttpDependencies { accessToken?: (opaque: string) => Promise<string | null>; key?: JWTVerifyGetKey; connection?: (token: string) => Promise<Connection>; port?: (token: string, connection: Connection) => CloudPort }
export function createMcpEndpoint(config: McpConfig, secret: string, dependencies: HttpDependencies = {}) {
  const issuer = `${config.supabaseUrl}/auth/v1`
  const keys = dependencies.key ?? createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`), { timeoutDuration: 10_000, cooldownDuration: 30_000 })
  const resource = new URL(config.resourceUrl)
  const metadata = new URL(`/.well-known/oauth-protected-resource${resource.pathname}`, resource.origin).href
  const allowedOrigins = new Set([resource.origin, 'https://chatgpt.com', 'https://claude.ai'])
  const json = (data: unknown, status = 200, extra: Record<string, string> = {}) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store', ...extra } })
  return async (request: Request) => {
    const url = new URL(request.url); const origin = request.headers.get('Origin')
    if (url.host !== resource.host || (request.headers.get('Host') && request.headers.get('Host') !== resource.host)) return json({ error: 'invalid_host' }, 403)
    const publicMetadata = url.pathname === '/.well-known/oauth-protected-resource' || url.pathname === new URL(metadata).pathname
    if (publicMetadata) return json({ resource: config.resourceUrl, authorization_servers: [resource.origin], bearer_methods_supported: ['header'], scopes_supported: ['profile', 'offline_access'], resource_name: 'Prio' }, 200, { 'Access-Control-Allow-Origin': '*' })
    if (url.pathname !== resource.pathname) return json({ error: 'not_found' }, 404)
    if (origin && !allowedOrigins.has(origin)) return json({ error: 'invalid_origin' }, 403)
    const cors: Record<string, string> = origin ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin', 'Access-Control-Expose-Headers': 'WWW-Authenticate, MCP-Protocol-Version, Mcp-Session-Id' } : {}
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { ...cors, 'Access-Control-Allow-Methods': 'POST, GET, DELETE, OPTIONS', 'Access-Control-Allow-Headers': 'Authorization, Content-Type, Accept, MCP-Protocol-Version, Mcp-Session-Id, Last-Event-ID' } })
    const challenge = (error?: string) => `Bearer resource_metadata="${metadata}"${error ? `, error="${error}"` : ''}`
    const presented = request.headers.get('Authorization')?.match(/^Bearer ([^\s]+)$/i)?.[1]
    if (!presented) return json({ error: 'authentication_required' }, 401, { ...cors, 'WWW-Authenticate': challenge() })
    let connection: Connection
    let expiresAt: number
    let token: string
    try {
      const upstream = await dependencies.accessToken?.(presented)
      if (!upstream) throw new Error('Invalid Prio token')
      token = upstream
      const { payload } = await jwtVerify(token, keys, { issuer, audience: 'authenticated', algorithms: ['ES256', 'RS256'], requiredClaims: ['exp', 'iat', 'sub', 'client_id', 'session_id'] })
      if (payload.role !== 'authenticated' || typeof payload.client_id !== 'string' || typeof payload.session_id !== 'string' || typeof payload.sub !== 'string') throw new Error('Wrong token type')
      connection = await (dependencies.connection ?? (token => readConnection(config, token)))(token)
      // Supabase tokens currently have aud=authenticated. Recipient binding is
      // an explicit native grant for this client AND this canonical resource.
      if (connection.resource !== config.resourceUrl || connection.client_id !== payload.client_id || connection.user_id !== payload.sub) throw new Error('Recipient mismatch')
      expiresAt = payload.exp!
    } catch (error) {
      if (error instanceof errors.JWKSTimeout || error instanceof TypeError) return json({ error: 'temporarily_unavailable' }, 503, cors)
      if (error instanceof CommandError && error.code !== 'permission_denied') return json({ error: 'temporarily_unavailable' }, 503, cors)
      return json({ error: 'invalid_token_or_revoked_connection' }, 401, { ...cors, 'WWW-Authenticate': challenge('invalid_token') })
    }
    const port = dependencies.port?.(token, connection) ?? createCloudPort(config, token, secret, connection)
    const handler = createMcpHandler(() => createServer(port, connection, config), { legacy: 'stateless', responseMode: 'auto', maxSubscriptions: 0, maxRequestBodySize: 2 * 1024 * 1024 })
    try {
      const response = await handler.fetch(request, { authInfo: { token, clientId: connection.client_id, scopes: ['openid', 'profile'], expiresAt, resource, resourceMetadataUrl: metadata } })
      const headers = new Headers(response.headers); headers.set('Cache-Control', 'no-store')
      Object.entries(cors).forEach(([key, value]) => headers.set(key, value))
      return new Response(response.body, { status: response.status, headers })
    } catch { return json({ error: 'temporarily_unavailable' }, 503, cors) }
    finally { await handler.close() }
  }
}
