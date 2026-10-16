import { useEffect, useMemo, useRef, useState } from 'react'
import { useDraggable, useDroppable } from '@dnd-kit/react'
import { useSortable } from '@dnd-kit/react/sortable'
import { CollisionPriority } from '@dnd-kit/abstract'
import { move } from '@dnd-kit/helpers'
import { pointerIntersection } from '@dnd-kit/collision'
import { useWorkspace } from '../app/useWorkspace'
import { useIsDesktop } from '../app/useIsDesktop'
import type { LocalList, LocalTask, OverviewMode } from '../domain/types'
import { taskLocation } from '../domain/taskPlacement'
import { groupTasks } from '../domain/sections'
import { useView } from './useView'
import { useCollapsedSections } from './collapsedSections'
import { dragGroups, groupOfTask, projectTaskPointer, sidebarDropListId, taskGroupId, taskGroupLocation, taskEndId, isTaskEnd, type DragGroups } from './taskDrag'
import { SectionHeader } from './SectionHeader'
import { TaskRow } from './TaskRow'
import { ListIcon } from './ListIcon'
import { CompletedTasksSection } from './CompletedTasksSection'
import { emptyState, errorBox, focusRing, numeric } from './styles'
import { leerAufgaben } from './emptyTexts'
import { useTaskDragHandlers } from './useTaskDragHandlers'
import { isKeyboardEvent } from '@dnd-kit/dom/utilities'
import { matchesTags } from '../domain/tags'
import { orderOverviewTasks } from '../domain/overviewOrdering'

interface DragPreview {
  lists: LocalList[]
  tasks: LocalTask[]
  groups: DragGroups
  activeId: string | null
  saving: boolean
  saved?: LocalTask
  awaitingTasks?: LocalTask[]
}

/** Ein Listenbaustein für Einzel- und Gesamtansicht, auf Telefon und Desktop. */
export function TaskList({ lists, tasks: allTasks, currentUserId, overview = false, mode = 'by_list' }: {
  lists: LocalList[]; tasks: LocalTask[]; currentUserId: string; overview?: boolean; mode?: OverviewMode
}) {
  const { repositories, nowMs } = useWorkspace()
  const { setTaskDetail, selectList, tagFilter } = useView()
  const tasks = useMemo(() => tagFilter.length ? allTasks.filter(task => matchesTags(task.tags, tagFilter)) : allTasks, [allTasks, tagFilter])
  const base = useMemo(() => dragGroups(lists, tasks), [lists, tasks])
  const [preview, setPreview] = useState<DragPreview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const current = useRef<DragPreview | null>(null)
  const latestTasks = useRef(tasks)
  const initial = useRef<LocalTask | null>(null)
  const saved = preview?.saved
  const settled = saved && (tasks !== preview.awaitingTasks || tasks.some(task => task.id === saved.id
    && task.list_id === saved.list_id && task.section_id === saved.section_id && task.position === saved.position))
  // Die bestätigte Leseantwort beendet die Vorschau; eine spätere externe
  // Verschiebung oder Erledigung darf sie dabei ebenfalls ablösen.
  if (settled) setPreview(null)
  const shown = settled ? null : preview
  const visibleTasks = shown?.tasks ?? tasks
  const visibleLists = shown?.lists ?? lists
  const groups = shown?.groups ?? base
  const byId = new Map(visibleTasks.map(task => [task.id, task]))
  const open = (task: LocalTask) => {
    if (!current.current) setTaskDetail({ taskId: task.id, listId: task.list_id, fromOverview: overview })
  }
  const updatePreview = (value: DragPreview | null) => { current.current = value; setPreview(value) }
  const projectPointer = (sourceId: string | number | undefined, targetId: string | number | undefined, y: number, centerY: number | undefined) => {
    const state = current.current
    if (!state || typeof sourceId !== 'string' || typeof targetId !== 'string' || centerY === undefined || sidebarDropListId(targetId)) return
    const next = projectTaskPointer(state.groups, sourceId, targetId, y > centerY)
    if (next !== state.groups) updatePreview({ ...state, groups: next })
  }

  // Abgleiche dürfen die vom Sortierplugin bewegten DOM-Zeilen während des
  // Ziehens nicht ersetzen. Nur diese Interaktion hält eine Momentaufnahme;
  // danach kommt der Bestand wieder ausschließlich aus dem Datenbank-Hook.
  useEffect(() => { latestTasks.current = tasks }, [tasks])
  useEffect(() => { if (!preview) current.current = null }, [preview])

  useTaskDragHandlers({
    onBeforeDragStart: event => { if (current.current) event.preventDefault() },
    onDragStart: ({ operation }) => {
      const task = tasks.find(row => row.id === operation.source?.id)
      if (!task) return
      initial.current = task; setError(null)
      updatePreview({ lists, tasks, groups: base, activeId: task.id, saving: false })
    },
    onDragOver: event => {
      // Auch leere Container erhalten sofort eine Zeile. Beim Zeiger entscheidet
      // seine Hälfte des Ziels, bei der Tastatur die Sortierlogik der Bibliothek.
      const state = current.current
      if (!state) return
      if (sidebarDropListId(event.operation.target?.id)) { event.preventDefault(); return }
      if (isTaskEnd(event.operation.target?.id) && event.operation.source) {
        const next = projectTaskPointer(state.groups, String(event.operation.source.id), event.operation.target.id, true)
        if (next !== state.groups) updatePreview({ ...state, groups: next })
        event.preventDefault(); return
      }
      const pointerGesture = event.operation.activatorEvent && !isKeyboardEvent(event.operation.activatorEvent)
      if (pointerGesture) {
        projectPointer(event.operation.source?.id, event.operation.target?.id, event.operation.position.current.y, event.operation.target?.shape?.center.y)
      } else {
        const next = move(state.groups, event)
        if (next !== state.groups) updatePreview({ ...state, groups: next })
      }
      // React verwaltet die Gruppen. Das Plugin darf dieselben DOM-Zeilen
      // nicht zusätzlich umhängen; useSortable animiert die neuen Positionen.
      event.preventDefault()
    },
    onDragMove: event => {
      if (!event.to || !event.nativeEvent || isKeyboardEvent(event.nativeEvent)) return
      // dragmove wird vor dem Aktualisieren von position.current ausgelöst.
      // event.to enthält bereits die neue Position, auch beim letzten Schritt.
      if (!event.operation.target?.shape?.containsPoint(event.to)) return
      projectPointer(event.operation.source?.id, event.operation.target?.id, event.to.y, event.operation.target?.shape?.center.y)
    },
    onDragEnd: event => {
      const state = current.current
      const original = initial.current
      initial.current = null
      if (event.canceled || !event.operation.target || !state || !original) { updatePreview(null); return }
      const sidebarListId = sidebarDropListId(event.operation.target.id)
      if (sidebarListId) {
        if (sidebarListId === original.list_id) { updatePreview(null); return }
        updatePreview({ ...state, activeId: null, saving: true })
        void repositories.placeTask(original.id, { listId: sidebarListId, sectionId: null, beforeTaskId: null, expected: taskLocation(original) })
          .then(saved => { if (current.current) updatePreview({ ...current.current, saving: false, saved, awaitingTasks: latestTasks.current }) })
          .catch(cause => { updatePreview(null); setError(cause instanceof Error ? cause.message : 'Die Aufgabe konnte nicht verschoben werden.') })
        return
      }
      // Loslassen übernimmt die bereits sichtbare Vorschau. Ein zweites move
      // hat beim Touch-Ende die Aufgabe nochmals hinter ihren Nachbarn gesetzt.
      const next = state.groups
      const destination = groupOfTask(next, original.id)
      if (!destination) { updatePreview(null); return }
      const ids = next[destination]
      const starting = dragGroups(state.lists, state.tasks)
      const sourceGroup = groupOfTask(starting, original.id)!
      if (destination === sourceGroup && ids.join('\0') === starting[sourceGroup].join('\0')) { updatePreview(null); return }
      updatePreview({ ...state, groups: next, activeId: null, saving: true })
      const beforeTaskId = ids[ids.indexOf(original.id) + 1] ?? null
      void repositories.placeTask(original.id, { ...taskGroupLocation(destination), beforeTaskId, expected: taskLocation(original) })
        .then(saved => { if (current.current) updatePreview({ ...current.current, saving: false, saved, awaitingTasks: latestTasks.current }) })
        .catch(cause => { updatePreview(null); setError(cause instanceof Error ? cause.message : 'Die Aufgabe konnte nicht verschoben werden.') })
    },
  })
  return <>
    {error ? <p role="alert" className={errorBox}>{error}</p> : null}
    {shown?.saving ? <p role="status" className="sr-only">Position wird gespeichert …</p> : null}
    <div data-testid="task-list" className="flex flex-1 flex-col space-y-abschnitt">
      {mode !== 'by_list' ? <ul aria-label="Aufgaben in der Gesamtansicht">
        {orderOverviewTasks(visibleTasks, visibleLists, mode, nowMs).map(task => {
          const list = visibleLists.find(entry => entry.id === task.list_id)!
          const section = list.sections.find(entry => entry.id === task.section_id)
          return <NewestTaskRow key={task.id} task={task} currentUserId={currentUserId} overview={overview}
            ratingsEnabled={list.ratings_enabled}
            origin={`${list.name}${section ? ` · ${section.name}` : ''}`} onOpen={open} />
        })}
        {tasks.length === 0 ? <li className={emptyState}>{tagFilter.length ? 'Keine passenden Aufgaben.' : 'Keine offenen Aufgaben.'}</li> : null}
      </ul> : visibleLists.map(list => <ListBlock key={list.id} list={list} groups={groups} byId={byId} currentUserId={currentUserId}
        overview={overview} activeId={shown?.activeId ?? null} onOpen={open} onSelectList={selectList} />)}
    </div>
    {mode !== 'by_list' && lists.some(list => list.keep_completed) ? <CompletedTasksSection lists={lists.filter(list => list.keep_completed)} currentUserId={currentUserId} showOrigin overview={overview} /> : null}
  </>
}

/** Berechnete Ansicht: Ziehen wechselt nur die Liste, nicht die Sortierung. */
function NewestTaskRow(props: { task: LocalTask; currentUserId: string; overview: boolean; origin: string; ratingsEnabled: boolean; onOpen: (task: LocalTask) => void }) {
  const { ref, handleRef, isDragging } = useDraggable({ id: props.task.id, type: 'task', data: { listId: props.task.list_id } })
  return <TaskRow {...props} elementRef={ref} activatorRef={handleRef} dragging={isDragging} />
}

function ListBlock({ list, groups, byId, currentUserId, overview, activeId, onOpen, onSelectList }: {
  list: LocalList; groups: DragGroups; byId: Map<string, LocalTask>; currentUserId: string; overview: boolean
  activeId: string | null; onOpen: (task: LocalTask) => void; onSelectList: (id: string) => void
}) {
  const { zugeklappt, umschalten } = useCollapsedSections(list.id)
  const desktop = useIsDesktop()
  const count = groupTasks([], list.sections).reduce((sum, group) => sum + (groups[taskGroupId(list.id, group.section?.id ?? null)]?.length ?? 0), 0)
  return <section aria-label={overview ? `Aufgaben aus ${list.name}` : `Aufgaben in ${list.name}`} className="flex min-w-0 shrink-0 flex-col last:flex-1">
    {overview ? <div className="mb-2 flex items-center justify-between gap-3 border-b border-line py-2">
      <h2 className="min-w-0"><button type="button" aria-label={`Liste ${list.name} öffnen`} onClick={() => onSelectList(list.id)}
        className={`${focusRing} flex min-h-11 items-center gap-2 rounded-control text-list-heading font-semibold text-ink-strong hover:text-brand-soft`}>
        <ListIcon icon={list.icon} className="h-4 w-4 shrink-0 text-brand-soft" /><span className="break-words">{list.name}</span>
      </button></h2><span className={`text-meta text-ink-muted ${numeric}`}>{count}</span>
    </div> : null}
    {groupTasks([], list.sections).map(group => {
      const id = taskGroupId(list.id, group.section?.id ?? null)
      const ids = groups[id] ?? []
      return <TaskGroup key={id} id={id} ids={ids} name={group.section?.name} sectionId={group.section?.id}
        open={group.section === null || !zugeklappt.has(group.id) || (activeId !== null && ids.includes(activeId))}
        onToggle={() => umschalten(group.id)} byId={byId} currentUserId={currentUserId} overview={overview}
        ratingsEnabled={list.ratings_enabled}
        activeId={activeId} onOpen={onOpen} />
    })}
    <ListEndDrop listId={list.id} active={activeId !== null} />
    {count === 0 && activeId === null ? <p className={emptyState}>{overview ? 'Keine offenen Aufgaben in dieser Liste.' : leerAufgaben(desktop ? 'breit' : 'mobil')}</p> : null}
    {list.keep_completed ? <CompletedTasksSection lists={[list]} currentUserId={currentUserId} overview={overview} /> : null}
  </section>
}

function TaskGroup({ id, ids, name, sectionId, open, onToggle, byId, currentUserId, overview, activeId, onOpen, ratingsEnabled }: {
  id: string; ids: string[]; name?: string; sectionId?: string; open: boolean; onToggle: () => void
  byId: Map<string, LocalTask>; currentUserId: string; overview: boolean; activeId: string | null; onOpen: (task: LocalTask) => void
  ratingsEnabled: boolean
}) {
  // Container haben geringere Priorität als Aufgaben. So trifft man konkrete
  // Nachbarn und erreicht auch leere, kopflose Gruppen.
  const { ref, isDropTarget } = useDroppable({ id, type: 'group', accept: 'task', collisionPriority: CollisionPriority.Low, collisionDetector: pointerIntersection })
  return <div ref={ref} data-task-group={id} className={`min-w-0 ${activeId && isDropTarget ? 'rounded-control bg-brand-tint/40' : ''}`}>
    {name ? <SectionHeader name={name} anzahl={ids.length} offen={open} onToggle={onToggle} abschnittId={sectionId}
      gruppe={id} hervorgehoben={activeId !== null && isDropTarget} /> : null}
    {open ? <ul>{ids.map((taskId, index) => {
      const task = byId.get(taskId)
      return task ? <SortableTaskRow key={task.id} task={task} index={index} group={id} currentUserId={currentUserId} overview={overview} onOpen={onOpen} ratingsEnabled={ratingsEnabled} /> : null
    })}</ul> : null}
    {activeId !== null && (ids.length === 0 || !open) ? <div className="min-h-11 rounded-control border border-dashed border-line-strong" data-testid="gruppe-leer" aria-hidden="true" /> : null}
  </div>
}

function ListEndDrop({ listId, active }: { listId: string; active: boolean }) {
  // Eigenes, eindeutiges Ziel mit Zeigerschnitt; es konkurriert weder mit
  // Aufgaben noch mit der Seitenleiste. Platz existiert nur während des Ziehens.
  const { ref, isDropTarget } = useDroppable({ id: taskEndId(listId), type: 'group', accept: 'task', disabled: !active,
    collisionPriority: CollisionPriority.Low, collisionDetector: pointerIntersection })
  return <div ref={ref} data-list-end={listId} aria-hidden="true"
    className={active ? `min-h-24 flex-1 rounded-control ${isDropTarget ? 'bg-brand-tint/40' : ''}` : 'h-0'} />
}

function SortableTaskRow({ task, index, group, currentUserId, overview, onOpen, ratingsEnabled }: {
  task: LocalTask; index: number; group: string; currentUserId: string; overview: boolean; onOpen: (task: LocalTask) => void
  ratingsEnabled: boolean
}) {
  const { ref, handleRef, isDragging } = useSortable({ id: task.id, index, group, type: 'task', accept: 'task', data: { listId: task.list_id }, collisionDetector: pointerIntersection })
  return <TaskRow task={task} currentUserId={currentUserId} overview={overview} onOpen={onOpen}
    ratingsEnabled={ratingsEnabled}
    elementRef={ref} activatorRef={handleRef} dragging={isDragging} />
}
