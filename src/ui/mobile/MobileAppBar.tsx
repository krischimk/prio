import { useWorkspace } from '../../app/useWorkspace'
import { describeSyncState } from '../status/syncStatus'
import { focusRing, layer, appBackground, attentionDot, numeric, statusTone } from '../styles'
import { useUpdate } from '../useUpdate'
import { MenuIcon, SettingsIcon } from '../icons'
import { ListIcon } from '../ListIcon'
import { IconButton } from '../components/IconButton'
import { useView } from '../useView'

/**
 * Obere Leiste der mobilen Ansicht.
 *
 * Links das Menü, in der Mitte der Name der aktuellen Liste, rechts ein
 * kleiner Punkt für den Sync-Zustand. Der Punkt ist gleichzeitig der Knopf
 * "jetzt synchronisieren" beziehungsweise der Zugang zu offenen Konflikten.
 */
export function MobileAppBar({
  listId,
  listName,
  listIcon,
  onOpenMenu,
  onOpenList,
}: {
  listId: string | null
  listName: string | null
  listIcon: string | null
  onOpenMenu: () => void
  /** Öffnet die Verwaltung der aktuellen Liste. Nur sinnvoll mit Auswahl. */
  onOpenList: () => void
}) {
  const { syncStatus, pendingCount, rejectedCount, syncing, runSync } = useWorkspace()
  const { cloudConflicts, setConflictsOpen } = useView()
  const { tone, text } = describeSyncState(syncStatus, pendingCount, syncing, rejectedCount, cloudConflicts.length)
  /**
   * Was neben dem Punkt steht: die Zahl der wartenden Änderungen oder ein
   * Ausrufezeichen. `null` heißt „nichts zu sagen" – dann bleibt nur der Punkt.
   */
  const zeichen = tone === 'error' ? '!' : pendingCount > 0 ? String(pendingCount) : null
  const farben = statusTone[tone]
  const { state: update } = useUpdate()
  const updateVerfuegbar = update.status === 'available'

  return (
    <header className={`safe-top fixed inset-x-0 top-0 ${layer.appBar} border-b border-line ${appBackground}`}>
      <div className="flex h-app-bar items-center gap-1 px-2">
        <IconButton
          onClick={onOpenMenu}
          aria-label={updateVerfuegbar ? 'Menü öffnen – neue Version verfügbar' : 'Menü öffnen'}
          variant="iconBright" layout="relative"
        >
          <MenuIcon />
          {/* Kleiner Hinweis, damit eine neue Fassung auffällt, ohne das Menü zu öffnen. */}
          {updateVerfuegbar ? (
            <span
              data-testid="update-badge"
              className={`absolute right-1 top-1 h-2 w-2 rounded-full ${attentionDot}`}
              aria-hidden="true"
            />
          ) : null}
        </IconButton>

        {listName === null ? (
          <span
            className="min-w-0 flex-1 truncate text-center text-title font-medium text-ink"
            data-testid="app-bar-title"
          >
            Gesamtansicht
          </span>
        ) : (
          /*
            Der Listenname ist der Zugang zur Listenverwaltung – wie beim Tippen
            auf eine Aufgabe die Detailansicht aufgeht.
          */
          <button
            type="button"
            data-focus-key={`settings:list:${listId}`}
            onClick={onOpenList}
            aria-label={`Liste „${listName}“ verwalten`}
            className={`${focusRing} flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-control px-2 py-1 text-title font-medium text-ink active:bg-raised`}
            data-testid="app-bar-title"
          >
            <ListIcon icon={listIcon} className="h-4 w-4 shrink-0" />
            <span className="truncate">{listName}</span>
            <SettingsIcon className="ml-auto h-4 w-4 shrink-0 text-ink-muted" />
          </button>
        )}

        <button
          type="button"
          onClick={() => {
            if (cloudConflicts.length > 0) setConflictsOpen(true)
            else void runSync()
          }}
          aria-label={cloudConflicts.length > 0 ? `${text} Konflikte klären` : `${farben.label} – jetzt synchronisieren`}
          title={text}
          className={`${focusRing} rounded-control p-3 active:bg-raised`}
        >
          {/*
            Neben der Farbe trägt auch eine Form die Aussage (P14): der Punkt
            allein sagt einem farbenblinden Auge nichts. Deshalb die Zahl der
            wartenden Änderungen bzw. ein Ausrufezeichen im Fehlerfall.
          */}
          <span className="flex items-center gap-1">
            {zeichen !== null ? (
              <span
                aria-hidden="true"
                className={`text-label font-semibold ${numeric} ${farben.text}`}
              >
                {zeichen}
              </span>
            ) : null}
            <span className={`block h-2.5 w-2.5 rounded-full ${farben.dot}`} />
          </span>
        </button>
      </div>
    </header>
  )
}
