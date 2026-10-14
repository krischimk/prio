import { useWorkspace } from '../app/useWorkspace'
import { describeSyncState } from './status/syncStatus'
import { statusTone } from './styles'
import { useView } from './useView'
import { IconButton } from './components/IconButton'
import { AlertIcon } from './icons'

/**
 * Statusanzeige der Synchronisation.
 *
 * Zeigt auch an, wie viele lokale Änderungen noch nicht übertragen wurden –
 * das ist die wichtigste Information, wenn Supabase gerade nicht erreichbar ist.
 */
export function SyncIndicator() {
  const { syncStatus, pendingCount, rejectedCount, syncing, runSync } = useWorkspace()
  const { cloudConflicts: conflicts, setConflictsOpen } = useView()
  const { text, tone } = describeSyncState(syncStatus, pendingCount, syncing, rejectedCount, conflicts.length)
  const farben = statusTone[tone]

  return <div className="flex items-center gap-1">
    <span data-testid="sync-status" role="status" className="sr-only">{text}</span>
    <IconButton aria-label="Jetzt synchronisieren"
      title={`${text} Klicken, um jetzt zu synchronisieren.`}
      disabled={syncing}
      onClick={() => { void runSync() }}>
      <span className={`h-2.5 w-2.5 rounded-full ${farben.dot} ${syncing ? 'animate-pulse' : ''}`} aria-hidden="true" />
    </IconButton>
    {conflicts.length > 0 ? <IconButton aria-label="Konflikte klären" variant="attention"
      title={`${conflicts.length} offene ${conflicts.length === 1 ? 'Änderung' : 'Änderungen'} prüfen und entscheiden, welche Fassung erhalten bleibt.`}
      onClick={() => setConflictsOpen(true)}><AlertIcon /></IconButton> : null}
  </div>
}
