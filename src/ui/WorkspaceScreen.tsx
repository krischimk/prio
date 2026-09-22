import { useState } from 'react'
import { useAuth } from '../auth/useAuth'
import { useLists, useSelectedListId } from '../app/hooks'
import { useIsDesktop } from '../app/useIsDesktop'
import { MobileWorkspace } from './mobile/MobileWorkspace'
import { RestoreTasksPanel } from './RestoreTasksPanel'
import { UpdatePanel } from './UpdatePanel'
import { useUpdate } from './useUpdate'
import { ReminderIndicator } from './ReminderIndicator'
import { Sidebar } from './Sidebar'
import { SyncIndicator } from './SyncIndicator'
import { TaskPanel } from './TaskPanel'
import { attentionText, ghostButton } from './styles'

/**
 * Wählt zwischen den beiden Oberflächen.
 *
 * Die Umschaltung passiert in JavaScript statt über CSS-Klassen: Sonst wären
 * beide Ansichten gleichzeitig im DOM, mit doppelten Bedienelementen und
 * doppelt angemeldeten Ebenen im Back-Stack der Zurück-Taste.
 */
export function WorkspaceScreen() {
  const isDesktop = useIsDesktop()
  return isDesktop ? <DesktopWorkspace /> : <MobileWorkspace />
}

/** Breite Ansicht: Listen links, Aufgaben rechts. */
function DesktopWorkspace() {
  const { state, signOut } = useAuth()
  const lists = useLists()
  const [selectedListId, selectList] = useSelectedListId(lists)
  const [restoreOpen, setRestoreOpen] = useState(false)
  const [updateOpen, setUpdateOpen] = useState(false)
  const { state: update } = useUpdate()

  const user = state.status === 'authenticated' ? state.user : null
  const selected = lists.find((list) => list.id === selectedListId) ?? null

  return (
    <div className="flex min-h-screen flex-col bg-neutral-950 text-neutral-100 md:h-screen md:flex-row">
      <Sidebar
        lists={lists}
        selectedListId={selectedListId}
        onSelect={selectList}
        currentUserId={user?.id ?? ''}
      />

      <div className="flex min-h-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-neutral-800 px-4 py-3">
          <div className="flex items-baseline gap-2">
            <span className="font-semibold tracking-tight">prio</span>
            <span className="text-xs text-neutral-500" data-testid="current-user">
              {user?.email}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <ReminderIndicator />
            <SyncIndicator />
            <button
              type="button"
              className={`${ghostButton} px-2 py-1 text-xs`}
              onClick={() => setRestoreOpen(true)}
            >
              Wiederherstellen
            </button>
            <button
              type="button"
              className={`${ghostButton} px-2 py-1 text-xs ${
                update.status === 'available' ? attentionText : ''
              }`}
              onClick={() => setUpdateOpen(true)}
            >
              {update.status === 'available'
                ? `Update ${update.release.version}`
                : 'Nach Updates suchen'}
            </button>
            <button
              type="button"
              className={`${ghostButton} px-2 py-1 text-xs`}
              onClick={() => {
                void signOut()
              }}
            >
              Abmelden
            </button>
          </div>
        </header>

        {selected ? (
          <TaskPanel list={selected} currentUserId={user?.id ?? ''} />
        ) : (
          <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-neutral-500">
            Lege links eine Liste an, um Aufgaben zu erfassen.
          </div>
        )}
      </div>

      <RestoreTasksPanel open={restoreOpen} onClose={() => setRestoreOpen(false)} />
      <UpdatePanel open={updateOpen} onClose={() => setUpdateOpen(false)} />
    </div>
  )
}
