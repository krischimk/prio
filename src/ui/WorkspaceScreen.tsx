import { useAuth } from '../auth/useAuth'
import { useIsDesktop } from '../app/useIsDesktop'
import { ViewProvider } from './ViewProvider'
import { useView } from './useView'
import { MobileWorkspace } from './mobile/MobileWorkspace'
import { BackendLabel } from './BackendLabel'
import { RestoreTasksPanel } from './RestoreTasksPanel'
import { describeUpdateState } from '../updates/updateStatus'
import { useUpdate } from './useUpdate'
import { ReminderIndicator } from './ReminderIndicator'
import { Sidebar } from './Sidebar'
import { SyncIndicator } from './SyncIndicator'
import { TaskPanel } from './TaskPanel'
import { appBackground } from './styles'
import { Button } from './components/Button'

/**
 * Wählt zwischen den beiden Oberflächen.
 *
 * Die Umschaltung passiert in JavaScript statt über CSS-Klassen: Sonst wären
 * beide Ansichten gleichzeitig im DOM, mit doppelten Bedienelementen und
 * doppelt angemeldeten Ebenen im Back-Stack der Zurück-Taste.
 */
export function WorkspaceScreen() {
  const isDesktop = useIsDesktop()
  // Der Ansichtszustand liegt **über** der Verzweigung: Beim Wechsel der Breite
  // tauscht React den Baum aus, und ohne diese Ebene fiele die gewählte Liste
  // auf die erste zurück.
  return (
    <ViewProvider>{isDesktop ? <DesktopWorkspace /> : <MobileWorkspace />}</ViewProvider>
  )
}

/** Breite Ansicht: Listen links, Aufgaben rechts. */
function DesktopWorkspace() {
  const { state, signOut } = useAuth()
  const { lists, selected, selectedListId, selectList, restoreOpen, setRestoreOpen } = useView()
  const { state: update, check, install, installing } = useUpdate()
  const updateBeschreibung = describeUpdateState(update)
  const updateVerfuegbar = update.status === 'available'

  const user = state.status === 'authenticated' ? state.user : null

  return (
    <div className={`flex h-screen flex-row ${appBackground} text-ink`}>
      <Sidebar
        lists={lists}
        selectedListId={selectedListId}
        onSelect={selectList}
        currentUserId={user?.id ?? ''}
      />

      <div className="flex min-h-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-line px-4 py-3">
          <div className="flex items-baseline gap-2">
            <span className="font-semibold tracking-tight">Prio</span>
            <span className="text-meta text-ink-faint" data-testid="current-user">
              {user?.email}
            </span>
            <BackendLabel />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <ReminderIndicator />
            <SyncIndicator />
            <Button
              variant="ghost" size="sm"
              onClick={() => setRestoreOpen(true)}
            >
              Wiederherstellen
            </Button>
            {/*
              Ein Knopf statt eines eigenen Fensters: Ist eine Fassung
              verfügbar, wird sie von hier aus gleich installiert. Der Zustand
              steht als Titel bereit (Vorleseprogramme, Mauszeiger).
            */}
            <Button
              data-testid="update-button"
              title={updateBeschreibung.text}
              variant={updateVerfuegbar ? 'attention' : 'ghost'} size="sm"
              disabled={installing || update.status === 'checking'}
              onClick={() => {
                void (updateVerfuegbar ? install() : check())
              }}
            >
              {updateVerfuegbar
                ? `Update ${update.release.version} installieren`
                : update.status === 'checking'
                  ? 'Suche …'
                  : 'Nach Updates suchen'}
            </Button>
            <Button
              variant="ghost" size="sm"
              onClick={() => {
                void signOut()
              }}
            >
              Abmelden
            </Button>
          </div>
        </header>

        {selected ? (
          <TaskPanel list={selected} currentUserId={user?.id ?? ''} lists={lists} />
        ) : (
          <div className="flex flex-1 items-center justify-center p-6 text-center text-body text-ink-faint">
            Lege links eine Liste an, um Aufgaben zu erfassen.
          </div>
        )}
      </div>

      <RestoreTasksPanel open={restoreOpen} onClose={() => setRestoreOpen(false)} />
    </div>
  )
}
