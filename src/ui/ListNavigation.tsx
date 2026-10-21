import { useEffect, useMemo, useRef, useState } from 'react'
import { useSortable } from '@dnd-kit/react/sortable'
import { useDragOperation, useDroppable } from '@dnd-kit/react'
import { pointerIntersection } from '@dnd-kit/collision'
import { CollisionPriority } from '@dnd-kit/abstract'
import { isKeyboardEvent } from '@dnd-kit/dom/utilities'
import { move } from '@dnd-kit/helpers'
import type { LocalList } from '../domain/types'
import { useWorkspace } from '../app/useWorkspace'
import { useView } from './useView'
import { useTaskDragHandlers } from './useTaskDragHandlers'
import { groupOfTask, projectTaskPointer, sidebarDropId, sidebarDropListId, type DragGroups } from './taskDrag'
import { ChevronIcon, EyeOffIcon } from './icons'
import { ListIcon } from './ListIcon'
import { focusRing, errorBox } from './styles'
import { Hint } from './components/Hint'
import { leerListen } from './emptyTexts'
import { useIsDesktop } from '../app/useIsDesktop'

const visibleGroup = 'navigation:visible'
const hiddenGroup = 'navigation:hidden'
interface Preview { groups: DragGroups; activeId: string | null; saved: boolean; preferences: unknown; lists: LocalList[] }

/** Derselbe sortierbare Listenbestand in Seitenleiste und mobilem Menü. */
export function ListNavigation({ lists, selectedListId, onSelect, currentUserId }: {
  lists: LocalList[]; selectedListId: string | null; onSelect: (id: string) => void; currentUserId: string
}) {
  const { overview } = useView()
  const desktop = useIsDesktop()
  const { repositories } = useWorkspace()
  const { source: dragSource, target: dragTarget } = useDragOperation()
  const [expanded, setExpanded] = useState(false)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const current = useRef<Preview | null>(null)
  useEffect(() => {
    if (dragSource?.type !== 'task' || dragTarget?.id !== hiddenGroup) return
    const timer = setTimeout(() => setExpanded(true), 550)
    return () => clearTimeout(timer)
  }, [dragSource?.type, dragTarget?.id])
  const base = useMemo<DragGroups>(() => {
    const hidden = new Set(overview.preferences.filter(row => row.hidden).map(row => row.list_id))
    return {
      [visibleGroup]: lists.filter(row => !hidden.has(row.id)).map(row => sidebarDropId(row.id)),
      [hiddenGroup]: lists.filter(row => hidden.has(row.id)).map(row => sidebarDropId(row.id)),
    }
  }, [lists, overview.preferences])
  const settled = preview?.saved && preview.preferences !== overview.preferences
  if (settled) setPreview(null)
  const shown = settled ? null : preview
  const groups = shown?.groups ?? base
  const byId = new Map((shown?.lists ?? lists).map(row => [sidebarDropId(row.id), row]))
  const update = (value: Preview | null) => { current.current = value; setPreview(value) }
  const project = (source: string | number | undefined, target: string | number | undefined, y: number, center: number | undefined) => {
    if (!current.current || typeof source !== 'string' || typeof target !== 'string' || center === undefined) return
    const next = projectTaskPointer(current.current.groups, source, target, y > center)
    if (next !== current.current.groups) update({ ...current.current, groups: next })
  }
  useTaskDragHandlers({
    onDragStart: ({ operation }) => {
      if (!lists.some(row => sidebarDropId(row.id) === operation.source?.id)) return
      setError(null)
      update({ groups: base, activeId: String(operation.source!.id), saved: false, preferences: overview.preferences, lists })
    },
    onDragOver: event => {
      if (!current.current) return
      if (event.operation.activatorEvent && !isKeyboardEvent(event.operation.activatorEvent)) {
        project(event.operation.source?.id, event.operation.target?.id, event.operation.position.current.y, event.operation.target?.shape?.center.y)
      } else update({ ...current.current, groups: move(current.current.groups, event) })
      // React hält die Gruppen; das Sortierplugin animiert die neuen Plätze.
      event.preventDefault()
    },
    onDragMove: event => {
      if (!event.to || !event.nativeEvent || isKeyboardEvent(event.nativeEvent) || !event.operation.target?.shape?.containsPoint(event.to)) return
      project(event.operation.source?.id, event.operation.target?.id, event.to.y, event.operation.target?.shape?.center.y)
    },
    onDragEnd: event => {
      const state = current.current
      const active = state?.activeId
      if (!state || !active || event.canceled || !event.operation.target) { update(null); return }
      const group = groupOfTask(state.groups, active)
      if (!group) { update(null); return }
      const ids = state.groups[group]
      const beforeListId = sidebarDropListId(ids[ids.indexOf(active) + 1])
      const listId = sidebarDropListId(active)!
      if (Object.keys(base).every(key => base[key].join(',') === state.groups[key].join(','))) { update(null); return }
      update({ ...state, activeId: null, saved: true })
      void repositories.placeList(listId, currentUserId, { hidden: group === hiddenGroup, beforeListId })
        .catch(cause => { update(null); setError(cause instanceof Error ? cause.message : 'Die Liste konnte nicht verschoben werden.') })
    },
  }, 'list')
  return <nav aria-label="Listennavigation" aria-busy={shown?.saved ?? false}>
    {error ? <p role="alert" className={errorBox}>{error}</p> : null}
    <NavigationGroup id={visibleGroup} active={shown?.activeId !== null && shown !== null}>
      <ul className="space-y-1" data-testid="list-of-lists">{groups[visibleGroup].map((id, index) => {
        const list = byId.get(id)
        return list ? <NavigationItem key={id} list={list} index={index} group={visibleGroup} selected={list.id === selectedListId} onSelect={onSelect} /> : null
      })}{lists.length === 0 ? <li className="px-3 py-1 text-body text-ink-faint">{leerListen(desktop ? 'breit' : 'mobil')}</li> : null}</ul>
    </NavigationGroup>
    <NavigationGroup id={hiddenGroup} active={shown?.activeId !== null && shown !== null}>
      <button type="button" onClick={() => setExpanded(value => !value)} aria-expanded={expanded}
        className={`${focusRing} mt-2 flex min-h-11 w-full items-center gap-2 rounded-control px-3 text-meta ${groups[hiddenGroup].length ? 'text-ink-muted' : 'text-ink-faint/40 hover:text-ink-muted focus-visible:text-ink-muted'} hover:bg-surface active:bg-raised`}>
        <ChevronIcon offen={expanded} className="size-icon-meta shrink-0" /><EyeOffIcon className="size-icon-meta shrink-0" />
        Versteckt<span className="ml-auto">{groups[hiddenGroup].length}</span>
      </button>
      {expanded || (shown?.activeId && groups[hiddenGroup].includes(shown.activeId)) ? <ul aria-label="Versteckte Listen" className="space-y-1">
        {groups[hiddenGroup].map((id, index) => {
          const list = byId.get(id)
          return list ? <NavigationItem key={id} list={list} index={index} group={hiddenGroup} selected={list.id === selectedListId} onSelect={onSelect} /> : null
        })}
      </ul> : null}
    </NavigationGroup>
  </nav>
}

function NavigationGroup({ id, active, children }: { id: string; active: boolean; children: React.ReactNode }) {
  const { source } = useDragOperation()
  const { ref, isDropTarget } = useDroppable({ id, type: 'navigation-group', accept: id === hiddenGroup ? ['list', 'task'] : 'list',
    collisionPriority: source?.type === 'task' ? CollisionPriority.High : CollisionPriority.Low, collisionDetector: pointerIntersection })
  return <div ref={ref} data-navigation-group={id} className={`${active ? 'min-h-11' : ''} ${isDropTarget ? 'rounded-control bg-brand-tint/40' : ''}`}>{children}</div>
}

function NavigationItem({ list, selected, onSelect, index, group }: {
  list: LocalList; selected: boolean; onSelect: (id: string) => void; index: number; group: string
}) {
  const { source } = useDragOperation()
  const { ref, handleRef, isDragging, isDropTarget } = useSortable({ id: sidebarDropId(list.id), index, group, type: 'list', accept: ['list', 'task'], data: { listId: list.id },
    collisionPriority: source?.type === 'task' ? CollisionPriority.Highest : CollisionPriority.Normal, collisionDetector: pointerIntersection })
  const taskTarget = source?.type === 'task' && source.data.listId !== list.id && isDropTarget
  return <li ref={ref} data-navigation-list={list.id} className={isDragging ? 'rounded-control bg-surface shadow-lg shadow-page/30' : ''}>
    <Hint text={taskTarget ? `In „${list.name}“ verschieben: am Ende ohne Bereich.` : list.name}>
      <button ref={handleRef} type="button" onClick={() => { if (!isDragging) onSelect(list.id) }} aria-current={selected ? 'true' : undefined}
        data-sidebar-list={list.id} data-drop-target={taskTarget ? 'true' : undefined}
        className={`${focusRing} flex min-h-11 w-full items-center justify-between gap-2 rounded-control px-3 py-2 text-left text-body ${
          taskTarget ? 'bg-brand-tint text-brand-faint ring-1 ring-brand-soft' : selected ? 'bg-brand-tint text-brand-faint' : 'text-ink-soft hover:bg-surface hover:text-ink active:bg-raised'
        }`}>
        <span className="flex min-w-0 items-center gap-2"><ListIcon icon={list.icon} className="size-icon shrink-0" /><span className="truncate">{list.name}</span></span>
        {list.is_shared ? <span className="shrink-0 text-meta text-brand-soft">geteilt</span> : null}
      </button>
    </Hint>
  </li>
}
