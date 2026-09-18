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
 * Komponenten.
 */
export interface AppServices {
  auth: AuthPort
  gateway: RemoteGateway
  network: NetworkMonitor
}

export function createSupabaseServices(config: SupabaseConfig): AppServices {
  const client = createSupabaseClient(config)
  return {
    auth: createSupabaseAuthPort(client),
    gateway: createSupabaseGateway(client),
    network: createBrowserNetworkMonitor(),
  }
}

export { readSupabaseConfig }
