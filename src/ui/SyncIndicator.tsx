import { useWorkspace } from '../app/useWorkspace'
import { describeSyncState, type SyncTone } from '../sync/syncStatus'
import { ghostButton } from './styles'

const toneClasses: Record<SyncTone, string> = {
  ok: 'text-emerald-400',
  pending: 'text-amber-400',
  error: 'text-red-400',
}

const dotClasses: Record<SyncTone, string> = {
  ok: 'bg-emerald-400',
  pending: 'bg-amber-400',
  error: 'bg-red-400',
}

/**
 * Statusanzeige der Synchronisation.
 *
 * Zeigt auch an, wie viele lokale Änderungen noch nicht übertragen wurden –
 * das ist die wichtigste Information, wenn Supabase gerade nicht erreichbar ist.
 */
export function SyncIndicator() {
  const { syncStatus, pendingCount, syncing, runSync } = useWorkspace()
  const { text, tone } = describeSyncState(syncStatus, pendingCount, syncing)

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
      <span className="flex items-center gap-2">
        <span className={`h-2 w-2 shrink-0 rounded-full ${dotClasses[tone]}`} aria-hidden="true" />
        <span data-testid="sync-status" className={toneClasses[tone]}>
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
