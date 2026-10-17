import { useAuth } from '../../auth/useAuth'
import { useView } from '../useView'
import { MobileAppBar } from './MobileAppBar'
import { MobileDrawer } from './MobileDrawer'
import { RestoreTasksPanel } from '../RestoreTasksPanel'
import { PlusIcon } from '../icons'
import { focusRing, layer, appBackground } from '../styles'
import { OverviewPanel } from '../OverviewPanel'
import { TaskPanel } from '../TaskPanel'
import { useDrawerSwipe } from './useDrawerSwipe'
import { useDialog } from '../components/useDialog'

/** Telefonansicht; Editor und Listenverwaltung liegen über der Ansichtsverzweigung. */
export function MobileWorkspace() {
  const { state } = useAuth()
  const { lists, selected, selectedListId, selectList, restoreOpen, setRestoreOpen, setTaskDetail, setListSettingsId, overview, setOverviewCreating, drawerMode, setDrawerMode } = useView()
  const motion = useDrawerSwipe(drawerMode !== 'closed', open => setDrawerMode(open ? 'open' : 'closed'))
  const dialog = useDialog({ active: drawerMode === 'open', onClose: () => setDrawerMode('closed'), panelRef: motion.root })
  const create = () => {
    if (selected) { setTaskDetail({ taskId: null, listId: selected.id }); return }
    setOverviewCreating(true)
  }
  const userId = state.status === 'authenticated' ? state.user.id : ''
  return <div {...motion.handlers} className={`mobile-workspace min-h-screen ${appBackground} text-ink`}>
    <MobileAppBar listId={selected?.id ?? null} listName={selected?.name ?? null} listIcon={selected?.icon ?? null}
      onOpenMenu={() => setDrawerMode('open')} onOpenList={() => { if (selected) setListSettingsId(selected.id) }} />
    <main className="app-bar-offset fab-offset flex min-h-screen flex-col">
      {selected === null ? <OverviewPanel currentUserId={userId} /> : <TaskPanel list={selected} currentUserId={userId} />}
    </main>
    {selected !== null || (overview.status === 'ready' && overview.lists.length > 0) ? <div className={`safe-bottom pointer-events-none fixed bottom-0 right-3 ${layer.fab}`}>
      <button type="button" data-focus-key={selected ? `new:${selected.id}` : 'overview-create'} onClick={create} aria-label="Neue Aufgabe"
        className={`${focusRing} button-primary pointer-events-auto mb-fab-gap flex h-fab items-center gap-2 rounded-full bg-brand px-5 text-body font-medium text-on-brand shadow-lg shadow-page/40 hover:bg-brand-hover active:bg-brand-hover`}>
        <PlusIcon className="h-5 w-5" />Neue Aufgabe
      </button>
    </div> : null}
    <MobileDrawer panelRef={motion.root} sheetRef={motion.sheet} visible={motion.visible} onKeyDown={dialog.onKeyDown} open={drawerMode !== 'closed'} draggingTask={drawerMode === 'drag'} onClose={() => setDrawerMode('closed')} lists={lists} selectedListId={selectedListId}
      onSelectList={selectList} currentUserId={userId} onOpenRestore={() => { setDrawerMode('closed'); setRestoreOpen(true) }} />
    <RestoreTasksPanel open={restoreOpen} onClose={() => setRestoreOpen(false)} />
  </div>
}
