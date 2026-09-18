import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createRepositories } from '../db/repositories'
import { openLocalDatabase, type LocalDatabase } from '../db/localDb'
import { createSyncEngine, type SyncEngine, type SyncResult } from '../sync/syncEngine'
import { createShareListAction } from '../sync/shareList'
import { countDirty, META_LAST_SYNC_AT, readMeta } from '../sync/syncStore'
import type { NetworkMonitor } from '../sync/network'
import type { RemoteGateway } from '../sync/remoteGateway'
import { withChangeTracking } from './trackedRepositories'
import { WorkspaceContext, type WorkspaceValue } from './workspaceContext'

/**
 * Arbeitsbereich eines angemeldeten Benutzers.
 *
 * Hier wird alles zusammengesteckt, was nur mit einem Benutzer existiert:
 * lokale Datenbank, Geschäftslogik, Sync-Engine und der Status der
 * Synchronisation. Die UI-Komponenten bekommen davon nur noch das Nötige.
 *
 * Nebenläufigkeit: Ein Sync läuft nie zweimal gleichzeitig (siehe
 * `syncEngine.ts`). Lokale Änderungen lösen einen Sync aus, der kurz
 * entprellt wird, damit schnelles Tippen nicht viele Anfragen erzeugt.
 *
 * Hinweis zur Umsetzung: Die Effekte spiegeln den Zustand externer Systeme
 * (IndexedDB, Netzwerk, Sync-Engine) nach React. Die Lint-Regel
 * `react/set-state-in-effect` ist deshalb in `.oxlintrc.json` abgeschaltet –
 * siehe „Bewusste Entscheidungen“ in der README.
 */

const LOCAL_CHANGE_DEBOUNCE_MS = 400
const PERIODIC_SYNC_MS = 30_000

interface ReadyWorkspace {
  database: LocalDatabase
  engine: SyncEngine
}

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
  const [ready, setReady] = useState<ReadyWorkspace | null>(null)
  /**
   * Zwei getrennte Zähler – das ist wichtig:
   *
   *  - `dataVersion` erhöht sich bei jeder Änderung der lokalen Daten, egal ob
   *    durch den Benutzer oder durch einen Pull. Die Lese-Hooks hängen daran.
   *  - `localRevision` erhöht sich NUR bei lokalen Benutzeränderungen und ist
   *    der Auslöser für einen Sync.
   *
   * Würde der Pull ebenfalls einen Sync auslösen, entstünde eine Endlosschleife
   * (Pull → Zähler → Sync → Pull → …).
   */
  const [dataVersion, setDataVersion] = useState(0)
  const [localRevision, setLocalRevision] = useState(0)
  const [syncStatus, setSyncStatus] = useState<SyncResult | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null)
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Lokale Datenbank öffnen und Sync-Engine aufbauen.
  useEffect(() => {
    let active = true
    openLocalDatabase(userId)
      .then((database) => {
        if (!active) return
        const engine = createSyncEngine({
          db: database,
          gateway,
          currentUserId: userId,
          isOnline: () => network.isOnline(),
        })
        setReady({ database, engine })
      })
      .catch(() => {
        if (active) setReady(null)
      })
    return () => {
      active = false
    }
  }, [userId, gateway, network])

  const repositories = useMemo(() => {
    if (!ready) return null
    return withChangeTracking(createRepositories(ready.database), () => {
      setDataVersion((value) => value + 1)
      setLocalRevision((value) => value + 1)
    })
  }, [ready])

  const refreshDerivedState = useCallback(async () => {
    if (!ready) return
    setPendingCount(await countDirty(ready.database))
    setLastSyncedAt(await readMeta(ready.database, META_LAST_SYNC_AT))
  }, [ready])

  const runSync = useCallback(async () => {
    if (!ready) return
    setSyncing(true)
    try {
      const result = await ready.engine.sync()
      setSyncStatus(result)
      // Nach einem Pull kann sich lokal etwas geändert haben – die Anzeige
      // muss neu lesen, aber ohne einen weiteren Sync auszulösen.
      if (result.pulled > 0) setDataVersion((value) => value + 1)
    } finally {
      setSyncing(false)
      await refreshDerivedState()
    }
  }, [ready, refreshDerivedState])

  // Nach jeder lokalen Änderung: offene Änderungen zählen und Sync anstoßen.
  useEffect(() => {
    if (!ready || localRevision === 0) return
    void refreshDerivedState()
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(() => {
      void runSync()
    }, LOCAL_CHANGE_DEBOUNCE_MS)
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current)
    }
  }, [localRevision, ready, refreshDerivedState, runSync])

  // Erster Sync nach dem Anmelden, danach regelmäßig und bei "wieder online".
  useEffect(() => {
    if (!ready) return
    void runSync()
    const interval = setInterval(() => {
      if (network.isOnline()) void runSync()
    }, PERIODIC_SYNC_MS)
    const unsubscribe = network.subscribe((online) => {
      if (online) void runSync()
    })
    return () => {
      clearInterval(interval)
      unsubscribe()
    }
  }, [ready, runSync, network])

  const shareListByEmail = useMemo(() => {
    if (!repositories) return null
    return createShareListAction({ gateway, repositories, sync: runSync })
  }, [gateway, repositories, runSync])

  const value = useMemo<WorkspaceValue | null>(() => {
    if (!repositories || !shareListByEmail) return null
    return {
      repositories,
      dataVersion,
      syncStatus,
      pendingCount,
      syncing,
      lastSyncedAt,
      runSync,
      shareListByEmail,
    }
  }, [repositories, dataVersion, syncStatus, pendingCount, syncing, lastSyncedAt, runSync, shareListByEmail])

  // Die Oberfläche erscheint, sobald die lokale Datenbank offen ist. Der erste
  // Sync läuft bewusst im Hintergrund weiter – die App darf nie auf eine
  // Serverantwort warten.
  if (!value) {
    return <WorkspaceLoading />
  }

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
}

function WorkspaceLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-950 text-neutral-400">
      Lokale Daten werden geladen…
    </div>
  )
}
