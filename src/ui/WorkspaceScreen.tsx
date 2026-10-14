import { useAuth } from '../auth/useAuth'
import { useIsDesktop } from '../app/useIsDesktop'
import { ViewProvider } from './ViewProvider'
import { TaskDraftProvider } from './TaskDraftProvider'
import { useView } from './useView'
import { MobileWorkspace } from './mobile/MobileWorkspace'
import { AccountSheet } from './AccountSheet'
import { RestoreTasksPanel } from './RestoreTasksPanel'
import { describeUpdateState } from './status/updateStatus'
import { useUpdate } from './useUpdate'
import { ReminderIndicator } from './ReminderIndicator'
import { Sidebar } from './Sidebar'
import { SyncIndicator } from './SyncIndicator'
import { TaskPanel } from './TaskPanel'
import { appBackground } from './styles'
import { IconButton } from './components/IconButton'
import { CloudConflictsSheet } from './CloudConflictsSheet'
import { OverviewPanel } from './OverviewPanel'
import { OverviewDialogs } from './OverviewDialogs'
import { TaskDialogs } from './TaskDialogs'
import { TaskDragProvider } from './TaskDragProvider'
import { DownloadIcon, RestoreIcon, UserIcon } from './icons'
import { isNativeApp } from '../app/platform'

/**
 * Wählt zwischen den beiden Oberflächen.
 *
 * Die Umschaltung passiert in JavaScript statt über CSS-Klassen: Sonst wären
 * beide Ansichten gleichzeitig im DOM, mit doppelten Bedienelementen und
 * doppelt angemeldeten Ebenen im Back-Stack der Zurück-Taste.
 */
export function WorkspaceScreen() {
  const isDesktop = useIsDesktop()
  const { state } = useAuth()
  const userId = state.status === 'authenticated' ? state.user.id : ''
  // Der Ansichtszustand liegt **über** der Verzweigung: Beim Wechsel der Breite
  // tauscht React den Baum aus, und ohne diese Ebene fiele die gewählte Liste
  // auf die erste zurück.
  return (
    <TaskDraftProvider key={userId}>
      <ViewProvider userId={userId}><WorkspaceViews isDesktop={isDesktop} /></ViewProvider>
    </TaskDraftProvider>
  )
}

function WorkspaceViews({ isDesktop }: { isDesktop: boolean }) {
  const { cloudConflicts, conflictsOpen, setConflictsOpen, accountOpen, setAccountOpen } = useView()
  return <TaskDragProvider>
    <div>{isDesktop ? <DesktopWorkspace /> : <MobileWorkspace />}</div>
    <OverviewDialogs />
    <TaskDialogs />
    {accountOpen ? <AccountSheet onClose={() => setAccountOpen(false)} /> : null}
    <CloudConflictsSheet conflicts={cloudConflicts} open={conflictsOpen} onClose={() => setConflictsOpen(false)} />
  </TaskDragProvider>
}

/** Breite Ansicht: Listen links, Aufgaben rechts. */
function DesktopWorkspace() {
  const { state } = useAuth()
  const { lists, selected, selectedListId, selectList, restoreOpen, setRestoreOpen, setAccountOpen } = useView()
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

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2 border-b border-line px-4 py-3">
          <div className="flex flex-wrap items-center gap-3">
            <ReminderIndicator />
            <SyncIndicator />
            <IconButton
              aria-label="Wiederherstellen"
              title="Abgehakte und gelöschte Aufgaben wiederherstellen"
              onClick={() => setRestoreOpen(true)}
            >
              <RestoreIcon />
            </IconButton>
            {/*
              Ein Knopf statt eines eigenen Fensters: Ist eine Fassung
              verfügbar, wird sie von hier aus gleich installiert. Der Zustand
              steht als Titel bereit (Vorleseprogramme, Mauszeiger).
            */}
            {isNativeApp() ? <IconButton
              data-testid="update-button"
              aria-label={updateVerfuegbar ? `Update ${update.release.version} installieren` : 'Nach Updates suchen'}
              title={updateBeschreibung.text}
              variant={updateVerfuegbar ? 'attention' : 'icon'}
              disabled={installing || update.status === 'checking'}
              onClick={() => {
                void (updateVerfuegbar ? install() : check())
              }}
            >
              <DownloadIcon />
            </IconButton> : null}
            <IconButton aria-label="Konto" title={`Angemeldet als @${user?.username}. Konto öffnen.`} onClick={() => setAccountOpen(true)} data-testid="current-user">
              <UserIcon /><span className="sr-only">{user?.email}</span>
            </IconButton>
          </div>
        </header>

        <main key={selectedListId ?? 'overview'} className="scroll-area min-h-0 flex-1 overflow-y-auto">
        {selected ? (
          <TaskPanel key={selected.id} list={selected} currentUserId={user?.id ?? ''} />
        ) : (
          <OverviewPanel currentUserId={user?.id ?? ''} />
        )}
        </main>
      </div>

      <RestoreTasksPanel open={restoreOpen} onClose={() => setRestoreOpen(false)} />
    </div>
  )
}
