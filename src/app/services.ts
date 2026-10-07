import type { AuthPort } from '../auth/authPort'
import type { RemoteGateway } from '../sync/remoteGateway'
import { createBrowserNetworkMonitor, type NetworkMonitor } from '../sync/network'
import {
  createSupabaseAuthPort,
  createSupabaseClient,
  readSupabaseConfig,
  type SupabaseConfig,
} from '../auth/supabaseAuth'
import { createSupabaseGateway } from '../sync/supabaseGateway'

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
    auth: createSupabaseAuthPort(client),
    gateway: createSupabaseGateway(client),
    network: createBrowserNetworkMonitor(),
    backendUrl: config.url,
  }
}

export { readSupabaseConfig }
