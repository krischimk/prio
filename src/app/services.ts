import type { AuthPort } from '../auth/authPort'
import type { RemoteGateway } from '../sync/remoteGateway'
import { createBrowserNetworkMonitor, type NetworkMonitor } from '../sync/network'
import {
  createSupabaseAuthPort,
  createSupabaseClient,
  readSupabaseConfig,
  type SupabaseConfig,
} from '../auth/supabaseAuth'
import { isNativeApp } from './platform'
import { createSupabaseGateway } from '../sync/supabaseGateway'
import type { OAuthPort } from '../auth/oauthPort'
import { createSupabaseOAuthPort } from '../auth/supabaseOAuth'

/**
 * Zusammensetzung der Anwendung aus ihren austauschbaren Teilen.
 *
 * `App` bekommt diese Abhängigkeiten als Prop. Im Produktivbetrieb kommen sie
 * aus Supabase (siehe `main.tsx`), in Tests aus Fakes. Es gibt bewusst keinen
 * globalen Zustand und keinen Zugriff auf `import.meta.env` innerhalb der
 * Komponenten – auch die Anzeige des Datenziels kommt von hier (`backendUrl`).
 */
export interface AppServices {
  auth: AuthPort
  oauth?: OAuthPort
  gateway: RemoteGateway
  network: NetworkMonitor
  /**
   * Das Datenziel dieser Fassung, für die Anzeige (`BackendLabel`).
   *
   * `null`, wenn keine Konfiguration vorliegt. Wichtig: Der Wert kommt aus der
   * Zusammensetzung, **nicht** aus `import.meta.env` in der Komponente – sonst
   * zeigte die Anzeige in Tests gegen eine Attrappe das echte Projekt.
   */
  backendUrl: string | null
}

export function createSupabaseServices(config: SupabaseConfig): AppServices {
  const client = createSupabaseClient(config)
  return {
    oauth: createSupabaseOAuthPort(client),
    auth: createSupabaseAuthPort(client, new URL('/konto/passwort', isNativeApp()
      ? import.meta.env.VITE_PUBLIC_APP_URL?.trim() || 'https://prio-krischi.pages.dev' : window.location.origin).href),
    gateway: createSupabaseGateway(client),
    network: createBrowserNetworkMonitor(),
    backendUrl: config.url,
  }
}

export { readSupabaseConfig }
