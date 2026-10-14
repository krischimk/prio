import type { LocalList } from '../domain/types'
import { ListIcon } from './ListIcon'
import { focusRing } from './styles'
import { appBackground } from './styles'
import { leerListen } from './emptyTexts'
import { OverviewIcon } from './icons'
import { useDragOperation, useDroppable } from '@dnd-kit/react'
import { pointerIntersection } from '@dnd-kit/collision'
import { isNativeApp } from '../app/platform'
import { sidebarDropId } from './taskDrag'
import { Hint } from './components/Hint'
import { AppBrand } from './AppBrand'
import { NewListComposer } from './NewListComposer'

/**
 * Seitenleiste mit allen sichtbaren Listen.
 *
 * Sichtbar sind genau die Listen, die lokal in der Datenbank des Benutzers
 * liegen – also die, die die Server-Policies freigegeben haben (eigene Listen
 * und gemeinsame Listen mit Mitgliedschaft).
 */
export function Sidebar({
  lists,
  selectedListId,
  onSelect,
  currentUserId,
}: {
  lists: LocalList[]
  selectedListId: string | null
  onSelect: (listId: string | null) => void
  currentUserId: string
}) {
  return (
    <aside
      className={`h-screen w-64 shrink-0 overflow-y-auto border-r border-line ${appBackground} p-5`}
      aria-label="Listen"
    >
      <div className="mb-8 flex items-center gap-3 px-2">
        <AppBrand />
      </div>
      <button type="button" onClick={() => onSelect(null)} aria-current={selectedListId === null ? 'page' : undefined}
        className={`${focusRing} mb-6 flex min-h-11 w-full items-center gap-3 rounded-control px-3 py-3 text-left text-body ${selectedListId === null ? 'bg-brand-tint text-brand-faint' : 'text-ink-soft hover:bg-surface'}`}>
        <OverviewIcon />Gesamtansicht
      </button>
      <h2 className="mb-3 text-meta font-semibold uppercase tracking-wide text-ink-faint">Listen</h2>

      <ul className="mb-4 space-y-1" data-testid="list-of-lists">
        {lists.map(list => <SidebarList key={list.id} list={list} selected={list.id === selectedListId} onSelect={onSelect} />)}
        {lists.length === 0 ? (
          <li className="px-2 py-1 text-body text-ink-faint">{leerListen('breit')}</li>
        ) : null}
      </ul>

      <NewListComposer currentUserId={currentUserId} onCreated={onSelect} />

    </aside>
  )
}

function SidebarList({ list, selected, onSelect }: { list: LocalList; selected: boolean; onSelect: (id: string) => void }) {
  const { source } = useDragOperation()
  const { ref, isDropTarget } = useDroppable({ id: sidebarDropId(list.id), type: 'sidebar-list', accept: 'task',
    collisionDetector: pointerIntersection, disabled: isNativeApp() || source?.data.listId === list.id })
  return <li>
    <Hint text={isDropTarget ? `In „${list.name}“ verschieben: am Ende ohne Bereich.` : list.name}>
      <button ref={ref} type="button" onClick={() => onSelect(list.id)} aria-current={selected ? 'true' : undefined}
        data-sidebar-list={list.id} data-drop-target={isDropTarget ? 'true' : undefined}
        className={`${focusRing} flex min-h-11 w-full items-center justify-between gap-2 rounded-control px-3 py-2 text-left text-body ${
          isDropTarget ? 'bg-brand-tint text-brand-faint ring-1 ring-brand-soft' : selected ? 'bg-brand-tint text-brand-faint' : 'text-ink-soft hover:bg-surface hover:text-ink'
        }`}>
        <span className="flex min-w-0 items-center gap-2"><ListIcon icon={list.icon} className="h-4 w-4 shrink-0" /><span className="truncate">{list.name}</span></span>
        {list.is_shared ? <span className="shrink-0 text-meta text-brand-soft" title="Gemeinsame Liste">geteilt</span> : null}
      </button>
    </Hint>
  </li>
}
