import type { CloudPort, CommandRecord, CommandResult, Connection, McpConfig, Plan, Snapshot, SnapshotFilter } from './types'
import { CommandError } from './types'

const encoder = new TextEncoder()
export async function signRequest(request: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return [...new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(request)))].map(byte => byte.toString(16).padStart(2, '0')).join('')
}

/** Ein Benutzer-Token, keine Admin-Rechte. Die Attestation gilt nur Fachbefehlen. */
export function createCloudPort(config: McpConfig, token: string, secret: string, connection: Connection, fetcher: typeof fetch = fetch): CloudPort {
  async function rpc<T>(name: string, body: unknown = {}): Promise<T> {
    let response: Response
    try {
      response = await fetcher(`${config.supabaseUrl}/rest/v1/rpc/${name}`, {
        method: 'POST', headers: { apikey: config.publishableKey, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body), signal: AbortSignal.timeout(20_000),
      })
    } catch { throw new CommandError('temporarily_unavailable', 'Prio could not reach its database. Retry with the same request_id; do not claim the action succeeded.') }
    const reader = response.body?.getReader()
    const chunks: Uint8Array[] = []; let size = 0
    if (reader) {
      try {
        for (;;) {
          const chunk = await reader.read(); if (chunk.done) break
          size += chunk.value.length
          if (size > 16 * 1024 * 1024) { await reader.cancel(); throw new CommandError('too_many_results', 'The selection is too large. Narrow it to specific lists or tasks.') }
          chunks.push(chunk.value)
        }
      } finally { reader.releaseLock() }
    }
    const raw = new Uint8Array(size); let at = 0
    for (const chunk of chunks) { raw.set(chunk, at); at += chunk.length }
    let data: unknown
    try { data = JSON.parse(new TextDecoder().decode(raw)) } catch { throw new CommandError('temporarily_unavailable', 'Prio returned an unreadable database response.') }
    if (!response.ok) {
      const failure = data as { code?: string; message?: string }
      throw new CommandError(response.status === 401 || response.status === 403 || failure.code === '42501' ? 'permission_denied' : 'database_error',
        failure.message ?? 'Prio rejected the request.')
    }
    return data as T
  }
  return {
    context: () => rpc<Connection>('mcp_context'),
    snapshot: (filter: SnapshotFilter = {}) => rpc<Snapshot>('mcp_snapshot', { p_filter: filter }),
    replay: (requestId, input) => rpc<CommandResult | null>('mcp_replay', { p_request_id: requestId, p_input: input }),
    async commit(requestId: string, action: string, input: unknown, plan: Plan) {
      if (!secret) throw new CommandError('unavailable', 'MCP writing is not configured. No changes were made.')
      const request = JSON.stringify({ user_id: connection.user_id, client_id: connection.client_id, resource: config.resourceUrl,
        issued_at: Math.floor(Date.now() / 1000), request_id: requestId, action, input, ...plan })
      return rpc<CommandResult>('mcp_commit', { p_request: request, p_proof: await signRequest(request, secret) })
    },
    history: (id, limit = 20) => rpc<CommandRecord | null>('mcp_history', { p_request_id: id ?? null, p_limit: limit }),
    resolveUser: username => rpc<{ id: string; username: string } | null>('mcp_resolve_user', { p_username: username }),
  }
}

export async function readConnection(config: McpConfig, token: string, fetcher: typeof fetch = fetch): Promise<Connection> {
  // Die leere Verbindung wird nur zum Aufruf des Rechte-RPC benötigt; niemals
  // für einen Schreibbefehl. Der zurückgegebene Stand ist serverseitig geprüft.
  return createCloudPort(config, token, '', {} as Connection, fetcher).context()
}
