import { Fragment, useRef } from 'react'
import { useWorkspace } from '../../app/useWorkspace'
import { useUndo } from '../useUndo'
import type { LocalTask } from '../../domain/types'
import { formatDueLabel } from '../datetime'
import { BellIcon, BellOffIcon, RepeatIcon } from '../icons'
import { describeRecurrence } from '../recurrence'
import { describeReminders } from '../reminder'
import { TaskDescription } from '../TaskDescription'
import { appBackground, attentionText, dangerText } from '../styles'
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
  currentUserId,
  onOpenTask,
  onReorder,
}: {
  tasks: LocalTask[]
  onOpenTask: (task: LocalTask) => void
  onReorder: (orderedTaskIds: string[]) => void
  currentUserId: string
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
            currentUserId={currentUserId}
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
  currentUserId,
}: {
  task: LocalTask
  index: number
  drag: ReorderDrag
  onOpen: (task: LocalTask) => void
  isDragging: boolean
  currentUserId: string
}) {
  const { repositories } = useWorkspace()
  const { offerUndo } = useUndo()
  const due = task.due_at === null ? null : formatDueLabel(task.due_at, task.completed)
  const wiederholung = describeRecurrence(task.recurrence)
  const erinnerungen = describeReminders(task, currentUserId)
  const handlers = drag.getRowHandlers(task.id, index)

  return (
    <li
      data-task-row
      className={`flex items-start gap-3 border-b border-neutral-900 ${appBackground} px-4 py-3 ${
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
          if (event.target.checked) offerUndo(task)
        }}
      />

      {/*
        Ein Knopf kann keinen Knopf enthalten – deshalb liegt die Beschreibung
        unter dem Knopf „Aufgabe öffnen", in einem eigenen Bereich. Sonst würde
        der Schalter „Mehr" die Detailansicht mit öffnen.
      */}
      {/*
        Die Zieh-Griffe und der Klick zum Öffnen liegen auf dem ganzen Bereich
        rechts vom Kästchen – nicht nur auf Titel und Angaben. Mit Beschreibung
        war die Fläche sonst klein, und ein langer Druck daneben markierte Text
        statt die Aufgabe aufzunehmen.
      */}
      <div
        {...handlers}
        onClick={() => {
          // Nach einem Ziehen folgt trotzdem ein Klick – der darf die
          // Detailansicht nicht zusätzlich öffnen.
          if (drag.wasDragging()) return
          onOpen(task)
        }}
        className="flex min-w-0 flex-1 flex-col touch-manipulation select-none text-left"
      >
        <button
          type="button"
          onClick={() => {
            if (drag.wasDragging()) return
            onOpen(task)
          }}
          className="min-w-0 text-left select-none"
          data-testid="task-row"
        >
          <span
            className={`block break-words text-[15px] leading-snug ${
              task.completed ? 'text-neutral-500 line-through' : 'text-neutral-100'
            }`}
          >
            {task.title}
          </span>
          {due ? (
            <span className={`mt-0.5 block text-xs ${due.overdue ? dangerText : 'text-neutral-500'}`}>
              {due.text}
            </span>
          ) : null}
          {wiederholung ? (
            <span className="mt-0.5 flex items-center gap-1 text-xs text-neutral-500">
              <RepeatIcon className="h-3 w-3 shrink-0" />
              {wiederholung}
            </span>
          ) : null}
          {erinnerungen.map((erinnerung, index) => (
            <span
              key={index}
              className={`mt-0.5 flex items-center gap-1 text-xs ${
                erinnerung.afterDue && !erinnerung.muted ? attentionText : 'text-neutral-500'
              }`}
            >
              {erinnerung.muted ? <BellOffIcon className="h-3 w-3 shrink-0" /> : <BellIcon className="h-3 w-3 shrink-0" />}
              {erinnerung.text}
            </span>
          ))}
        </button>
      {task.description ? <TaskDescription text={task.description} className="mt-0.5" /> : null}
      </div>
    </li>
  )
}
