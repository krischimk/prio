import { useState } from 'react'
import { useAuth } from '../../auth/useAuth'
import { useView } from '../useView'
import { MobileAppBar } from './MobileAppBar'
import { MobileDrawer } from './MobileDrawer'
import { RestoreTasksPanel } from '../RestoreTasksPanel'
import { PlusIcon } from '../icons'
import { focusRing, layer, appBackground } from '../styles'
import { OverviewPanel } from '../OverviewPanel'
import { TaskPanel } from '../TaskPanel'

/** Telefonansicht; Editor und Listenverwaltung liegen über der Ansichtsverzweigung. */
export function MobileWorkspace() {
  const { state } = useAuth()
  const { lists, selected, selectedListId, selectList, restoreOpen, setRestoreOpen, setTaskDetail, setListSettingsId, overview, setOverviewCreating } = useView()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const create = () => {
    if (selected) { setTaskDetail({ taskId: null, listId: selected.id }); return }
    const defaultId = overview.userPreference?.default_list_id
    if (defaultId && overview.lists.some(list => list.id === defaultId)) setTaskDetail({ taskId: null, listId: defaultId, fromOverview: true })
    else setOverviewCreating(true)
  }
  const userId = state.status === 'authenticated' ? state.user.id : ''
  return <div className={`min-h-screen ${appBackground} text-ink`}>
    <MobileAppBar listId={selected?.id ?? null} listName={selected?.name ?? null} listIcon={selected?.icon ?? null}
      onOpenMenu={() => setDrawerOpen(true)} onOpenList={() => { if (selected) setListSettingsId(selected.id) }} />
    <main className="app-bar-offset fab-offset">
      {selected === null ? <OverviewPanel currentUserId={userId} /> : <TaskPanel list={selected} currentUserId={userId} />}
    </main>
    {selected !== null || (overview.status === 'ready' && overview.lists.length > 0) ? <div className={`safe-bottom pointer-events-none fixed bottom-0 right-5 ${layer.fab}`}>
      <button type="button" data-focus-key={selected ? `new:${selected.id}` : 'overview-create'} onClick={create} aria-label="Neue Aufgabe"
        className={`${focusRing} pointer-events-auto mb-fab-gap flex h-fab items-center gap-2 rounded-full bg-brand px-5 text-body font-medium text-on-brand shadow-lg shadow-page/40 active:bg-brand-hover`}>
        <PlusIcon className="h-5 w-5" />Neue Aufgabe
      </button>
    </div> : null}
    <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} lists={lists} selectedListId={selectedListId}
      onSelectList={selectList} currentUserId={userId} onOpenRestore={() => { setDrawerOpen(false); setRestoreOpen(true) }} />
    <RestoreTasksPanel open={restoreOpen} onClose={() => setRestoreOpen(false)} />
  </div>
}
