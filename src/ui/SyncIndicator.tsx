import { useWorkspace } from '../app/useWorkspace'
import { describeSyncState } from '../sync/syncStatus'
import { ghostButton, statusTone } from './styles'

/**
 * Statusanzeige der Synchronisation.
 *
 * Zeigt auch an, wie viele lokale Änderungen noch nicht übertragen wurden –
 * das ist die wichtigste Information, wenn Supabase gerade nicht erreichbar ist.
 */
export function SyncIndicator() {
  const { syncStatus, pendingCount, syncing, runSync } = useWorkspace()
  const { text, tone } = describeSyncState(syncStatus, pendingCount, syncing)
  const farben = statusTone[tone]

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
      {/*
        `min-w-0` ist hier entscheidend: Ein Flex-Element schrumpft sonst nicht
        unter die Breite seines längsten Wortes. Servermeldungen können ein
        solches Wort sein – dann ließ sich die Leiste nur seitlich lesen.
        `break-words` erlaubt zusätzlich den Umbruch mitten im Wort.
      */}
      <span className="flex min-w-0 items-center gap-2">
        <span className={`h-2 w-2 shrink-0 rounded-full ${farben.dot}`} aria-hidden="true" />
        <span data-testid="sync-status" className={`min-w-0 break-words ${farben.text}`}>
          {text}
        </span>
      </span>
      <button
        type="button"
        className={`${ghostButton} px-2 py-1 text-xs`}
        onClick={() => {
          void runSync()
        }}
        disabled={syncing}
      >
        Jetzt synchronisieren
      </button>
    </div>
  )
}
