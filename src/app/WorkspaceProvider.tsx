import { useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react'
import type { NetworkMonitor } from '../sync/network'
import type { RemoteGateway } from '../sync/remoteGateway'
import { WorkspaceLoading } from '../ui/WorkspaceLoading'
import { WorkspaceContext, type WorkspaceValue } from './workspaceContext'
import { createWorkspaceRuntime, type WorkspaceRuntime } from './workspaceRuntime'

/**
 * Reicht den Arbeitsbereich eines angemeldeten Benutzers an die Oberfläche.
 *
 * Die Arbeit selbst steckt in `createWorkspaceRuntime` (React-frei: Datenbank,
 * Sync, Erinnerungen, Timer). Diese Komponente öffnet sie, abonniert ihre
 * Momentaufnahme und stellt sie dem Kontext bereit – mehr nicht.
 *
 * Hinweis zur Umsetzung: Der Effekt spiegelt ein externes System (IndexedDB)
 * nach React. Die Lint-Regel `react/set-state-in-effect` ist deshalb für diese
 * Datei abgeschaltet – siehe „Bewusste Entscheidungen“ in der README.
 */
export function WorkspaceProvider({
  userId,
  gateway,
  network,
  children,
}: {
  userId: string
  gateway: RemoteGateway
  network: NetworkMonitor
  children: ReactNode
}) {
  const [runtime, setRuntime] = useState<WorkspaceRuntime | null>(null)

  useEffect(() => {
    let aktiv = true
    let erzeugt: WorkspaceRuntime | null = null
    createWorkspaceRuntime({ userId, gateway, network })
      .then((laufzeit) => {
        if (!aktiv) {
          // StrictMode baut zweimal auf; die erste Laufzeit wird sofort beendet.
          laufzeit.schliessen()
          return
        }
        erzeugt = laufzeit
        setRuntime(laufzeit)
      })
      .catch(() => {
        if (aktiv) setRuntime(null)
      })
    return () => {
      aktiv = false
      erzeugt?.schliessen()
    }
  }, [userId, gateway, network])

  // Die Oberfläche erscheint, sobald die lokale Datenbank offen ist. Der erste
  // Abgleich läuft bewusst im Hintergrund weiter – die App darf nie auf eine
  // Serverantwort warten.
  if (!runtime) return <WorkspaceLoading />

  return <Bereit runtime={runtime}>{children}</Bereit>
}

/** Abonniert die Laufzeit und gibt sie als Kontext weiter. */
function Bereit({ runtime, children }: { runtime: WorkspaceRuntime; children: ReactNode }) {
  const zustand = useSyncExternalStore(runtime.abonnieren, runtime.zustand)

  const value = useMemo<WorkspaceValue>(
    () => ({
      repositories: runtime.repositories,
      dataVersion: zustand.datenVersion,
      syncStatus: zustand.syncStatus,
      pendingCount: zustand.pendingCount,
      rejectedCount: zustand.rejectedCount,
      syncing: zustand.syncing,
      reminderStatus: zustand.reminderStatus,
      runSync: runtime.synchronisieren,
      enableReminders: runtime.erinnerungenErlauben,
      shareListByEmail: runtime.shareListByEmail,
    }),
    [runtime, zustand],
  )

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
}
