import type { SupabaseClient } from '@supabase/supabase-js'
import type { AgentConnection, OAuthPort, OAuthRequest } from './oauthPort'

export function createSupabaseOAuthPort(client: SupabaseClient): OAuthPort {
  // Der Anbieter kann beim Lesen bereits eine frühere Freigabe abschließen.
  // Mehrere React-Abonnenten müssen deshalb dieselbe Antwort bekommen.
  const requests = new Map<string, Promise<OAuthRequest | { redirect_url: string }>>()
  async function manage(action: string, data = {}) {
    const result = await client.rpc('mcp_manage', { p_action: action, p_data: data })
    if (result.error) throw new Error(result.error.message)
    return result.data
  }
  async function readDetails(id: string): Promise<OAuthRequest | { redirect_url: string }> {
      const result = await client.auth.oauth.getAuthorizationDetails(id)
      if (result.error || !result.data) throw new Error(result.error?.message ?? 'Die Anfrage ist bereits abgeschlossen oder abgelaufen.')
      if ('redirect_url' in result.data) {
        const resume = await manage('resume', { authorization_id: id }) as { resumable: boolean; client_id: string }
        if (!resume.resumable) {
          await client.auth.oauth.revokeGrant({ clientId: resume.client_id })
          throw new Error('Die frühere Verbindung wurde widerrufen. Starte die Verbindung aus deinem KI-Programm erneut, um sie neu freizugeben.')
        }
        return { redirect_url: result.data.redirect_url }
      }
      return result.data as OAuthRequest
  }
  return {
    details(id) {
      const existing = requests.get(id)
      if (existing) return existing
      const request = readDetails(id).catch(cause => { requests.delete(id); throw cause })
      requests.set(id, request)
      if (requests.size > 10) requests.delete(requests.keys().next().value!)
      return request
    },
    async approve(id, permissions) {
      // Erst die eigene Datenfreigabe, dann das OAuth-Token. Ein Fehler vor
      // der Tokenausgabe kann damit keine unautorisierte Verbindung öffnen.
      await manage('authorize', { authorization_id: id, ...permissions })
      const result = await client.auth.oauth.approveAuthorization(id, { skipBrowserRedirect: true })
      if (result.error || !result.data?.redirect_url) throw new Error(result.error?.message ?? 'Die Freigabe konnte nicht abgeschlossen werden.')
      return result.data.redirect_url
    },
    async deny(id) {
      const result = await client.auth.oauth.denyAuthorization(id, { skipBrowserRedirect: true })
      if (result.error || !result.data?.redirect_url) throw new Error(result.error?.message ?? 'Die Ablehnung konnte nicht abgeschlossen werden.')
      return result.data.redirect_url
    },
    connections: async () => await manage('list') as AgentConnection[],
    async permissions(clientId, permissions) { await manage('permissions', { client_id: clientId, ...permissions }) },
    async revoke(clientId) {
      // Die lokale Serverfreigabe zuerst widerrufen: bereits ausgegebene
      // Access-Tokens werden sofort abgewiesen, auch wenn Auth offline ist.
      await manage('revoke', { client_id: clientId })
      await client.auth.oauth.revokeGrant({ clientId })
    },
  }
}
