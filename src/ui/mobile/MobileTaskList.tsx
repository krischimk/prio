import { Fragment, useRef } from 'react'
import { useWorkspace } from '../../app/useWorkspace'
import type { LocalTask } from '../../domain/types'
import { formatDueLabel } from '../datetime'
import { dangerText } from '../styles'
import { useReorderDrag, type ReorderDrag } from './useReorderDrag'

/**
 * Aufgabenliste der mobilen Ansicht.
 *
 * Bewusst ohne Bearbeiten- und Löschen-Knöpfe: Die Zeile selbst ist der Knopf
 * und öffnet die Detailansicht. Dort gibt es auch das Verschieben in eine
 * andere Liste.
 *
 * Umsortieren: Die Zeile gedrückt halten (rund 0,4 s), dann ziehen. Während des
 * Ziehens zeigt eine Linie, wo die Aufgabe landen würde. Kurzes Wischen scrollt
 * weiterhin die Liste.
 */
export function MobileTaskList({
  tasks,
  onOpenTask,
  onReorder,
}: {
  tasks: LocalTask[]
  onOpenTask: (task: LocalTask) => void
  onReorder: (orderedTaskIds: string[]) => void
}) {
  const listRef = useRef<HTMLUListElement>(null)
  const drag = useReorderDrag({
    itemIds: tasks.map((task) => task.id),
    onReorder,
    containerRef: listRef,
  })

  if (tasks.length === 0) {
    return (
      <p className="px-4 py-10 text-center text-sm text-neutral-500" data-testid="empty-tasks">
        Noch keine Aufgaben in dieser Liste.
      </p>
    )
  }

  return (
    <ul ref={listRef} data-testid="task-list">
      {tasks.map((task, index) => (
        <Fragment key={task.id}>
          {drag.draggingId !== null && drag.dropIndex === index ? <DropIndicator /> : null}
          <MobileTaskRow
            task={task}
            index={index}
            drag={drag}
            onOpen={onOpenTask}
            isDragging={drag.draggingId === task.id}
          />
        </Fragment>
      ))}
      {drag.draggingId !== null && drag.dropIndex === tasks.length ? <DropIndicator /> : null}
    </ul>
  )
}

function DropIndicator() {
  return <li aria-hidden="true" data-testid="drop-indicator" className="h-0.5 bg-indigo-500" />
}

function MobileTaskRow({
  task,
  index,
  drag,
  onOpen,
  isDragging,
}: {
  task: LocalTask
  index: number
  drag: ReorderDrag
  onOpen: (task: LocalTask) => void
  isDragging: boolean
}) {
  const { repositories } = useWorkspace()
  const due = task.due_at === null ? null : formatDueLabel(task.due_at, task.completed)
  const handlers = drag.getRowHandlers(task.id, index)

  return (
    <li
      data-task-row
      className={`flex items-start gap-3 border-b border-neutral-900 bg-neutral-950 px-4 py-3 ${
        isDragging ? 'relative z-10 shadow-lg shadow-black/50' : ''
      }`}
      style={isDragging ? { transform: `translateY(${drag.offsetY}px)` } : undefined}
    >
      <input
        type="checkbox"
        className="mt-0.5 h-5 w-5 shrink-0 accent-indigo-500"
        checked={task.completed}
        aria-label={`Aufgabe erledigen: ${task.title}`}
        onChange={(event) => {
          void repositories.setTaskCompleted(task.id, event.target.checked)
        }}
      />

      <button
        type="button"
        {...handlers}
        onClick={() => {
          // Nach einem Ziehen folgt trotzdem ein Klick – der darf die
          // Detailansicht nicht zusätzlich öffnen.
          if (drag.wasDragging()) return
          onOpen(task)
        }}
        className="min-w-0 flex-1 touch-manipulation text-left select-none"
        data-testid="task-row"
      >
        <span
          className={`block break-words text-[15px] leading-snug ${
            task.completed ? 'text-neutral-500 line-through' : 'text-neutral-100'
          }`}
        >
          {task.title}
        </span>
        {task.description ? (
          <span className="mt-0.5 block truncate text-xs text-neutral-500">{task.description}</span>
        ) : null}
        {due ? (
          <span className={`mt-0.5 block text-xs ${due.overdue ? dangerText : 'text-neutral-500'}`}>
            {due.text}
          </span>
        ) : null}
      </button>
    </li>
  )
}
