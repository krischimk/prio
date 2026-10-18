export interface AgentConnection {
  client_id: string; name: string; redirect_uri: string; resource: string
  can_write: boolean; can_share: boolean; time_zone: string; approved_at: string; revoked_at: string | null
}
export interface OAuthRequest { client: { id: string; name: string }; redirect_uri: string; scope: string }
/** Online-Sicherheitszustand wie die Sitzung; keine lokal gecachte Berechtigung. */
export interface OAuthPort {
  details(id: string): Promise<OAuthRequest | { redirect_url: string }>
  approve(id: string, permissions: { can_write: boolean; can_share: boolean; time_zone: string }): Promise<string>
  deny(id: string): Promise<string>
  connections(): Promise<AgentConnection[]>
  permissions(clientId: string, permissions: { can_write: boolean; can_share: boolean }): Promise<void>
  revoke(clientId: string): Promise<void>
}
