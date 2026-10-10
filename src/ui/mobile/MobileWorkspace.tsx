import { useState } from 'react'
import { useAuth } from '../../auth/useAuth'
import { useWorkspace } from '../../app/useWorkspace'
import { useView } from '../useView'
import { useTasks } from '../../app/hooks'
import { MobileAppBar } from './MobileAppBar'
import { MobileDrawer } from './MobileDrawer'
import { MobileTaskList } from './MobileTaskList'
import { RestoreTasksPanel } from '../RestoreTasksPanel'
import { PlusIcon } from '../icons'
import { formatOpenTasks } from '../taskCount'
import { focusRing, layer, appBackground, numeric } from '../styles'
import { OverviewPanel } from '../OverviewPanel'
import { CompletedTasksSection } from '../CompletedTasksSection'

/** Telefonansicht; Editor und Listenverwaltung liegen über der Ansichtsverzweigung. */
export function MobileWorkspace() {
  const { state } = useAuth()
  const { repositories } = useWorkspace()
  const { lists, selected, selectedListId, selectList, restoreOpen, setRestoreOpen, setTaskDetail, setListSettingsId } = useView()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const tasks = useTasks(selectedListId)
  const userId = state.status === 'authenticated' ? state.user.id : ''
  return <div className={`min-h-screen ${appBackground} text-ink`}>
    <MobileAppBar listId={selected?.id ?? null} listName={selected?.name ?? null} listIcon={selected?.icon ?? null}
      onOpenMenu={() => setDrawerOpen(true)} onOpenList={() => { if (selected) setListSettingsId(selected.id) }} />
    <main className="app-bar-offset fab-offset">
      {selected === null ? <OverviewPanel currentUserId={userId} /> : <div className="mx-auto max-w-4xl">
        <p className={`px-5 pb-2 pt-5 text-meta text-ink-muted ${numeric}`}>{formatOpenTasks(tasks.length)}{selected.is_shared ? ' · Geteilte Liste' : ''}</p>
        <MobileTaskList key={selected.id} tasks={tasks} sections={selected.sections} currentUserId={userId}
          onOpenTask={task => setTaskDetail({ taskId: task.id, listId: task.list_id })}
          onReorder={(ids, sectionOf) => { void repositories.reorderTasks(selected.id, ids, sectionOf) }} />
        {selected.keep_completed ? <div className="px-5"><CompletedTasksSection key={selected.id} listId={selected.id} /></div> : null}
      </div>}
    </main>
    {selected !== null ? <div className={`safe-bottom pointer-events-none fixed bottom-0 right-5 ${layer.fab}`}>
      <button type="button" data-focus-key={`new:${selected.id}`} onClick={() => setTaskDetail({ taskId: null, listId: selected.id })} aria-label="Neue Aufgabe"
        className={`${focusRing} pointer-events-auto mb-fab-gap flex h-fab items-center gap-2 rounded-full bg-brand px-5 text-body font-medium text-on-brand shadow-lg shadow-page/40 active:bg-brand-hover`}>
        <PlusIcon className="h-5 w-5" />Neue Aufgabe
      </button>
    </div> : null}
    <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} lists={lists} selectedListId={selectedListId}
      onSelectList={selectList} currentUserId={userId} onOpenRestore={() => { setDrawerOpen(false); setRestoreOpen(true) }} />
    <RestoreTasksPanel open={restoreOpen} onClose={() => setRestoreOpen(false)} />
  </div>
}
