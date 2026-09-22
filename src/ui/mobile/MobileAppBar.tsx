import { useWorkspace } from '../../app/useWorkspace'
import { describeSyncState } from '../../sync/syncStatus'
import { statusTone } from '../styles'
import { MenuIcon } from './icons'

/**
 * Obere Leiste der mobilen Ansicht.
 *
 * Links das Menü, in der Mitte der Name der aktuellen Liste, rechts ein
 * kleiner Punkt für den Sync-Zustand. Der Punkt ist gleichzeitig der Knopf
 * "jetzt synchronisieren" – auf dem Telefon ist das die einzige Stelle, an der
 * man den Zustand sehen muss.
 */
export function MobileAppBar({ listName, onOpenMenu }: { listName: string | null; onOpenMenu: () => void }) {
  const { syncStatus, pendingCount, syncing, runSync } = useWorkspace()
  const { tone, text } = describeSyncState(syncStatus, pendingCount, syncing)
  const farben = statusTone[tone]

  return (
    <header className="safe-top fixed inset-x-0 top-0 z-30 border-b border-neutral-800 bg-neutral-950">
      <div className="flex h-14 items-center gap-1 px-2">
        <button
          type="button"
          onClick={onOpenMenu}
          aria-label="Menü öffnen"
          className="rounded-md p-2 text-neutral-300 active:bg-neutral-800"
        >
          <MenuIcon />
        </button>

        <h1 className="min-w-0 flex-1 truncate text-center text-base font-medium text-neutral-100" data-testid="app-bar-title">
          {listName ?? 'prio'}
        </h1>

        <button
          type="button"
          onClick={() => {
            void runSync()
          }}
          aria-label={`${farben.label} – jetzt synchronisieren`}
          title={text}
          className="rounded-md p-3 active:bg-neutral-800"
        >
          <span className={`block h-2.5 w-2.5 rounded-full ${farben.dot}`} />
        </button>
      </div>
    </header>
  )
}
