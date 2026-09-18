import { useWorkspace } from '../../app/useWorkspace'
import type { LocalTask } from '../../domain/types'
import { formatDateTime, isOverdue } from '../datetime'
import { useLongPress } from './useLongPress'

/**
 * Aufgabenliste der mobilen Ansicht.
 *
 * Bewusst ohne Bearbeiten- und Löschen-Knöpfe: Die Zeile selbst ist der Knopf.
 * Antippen öffnet die Detailansicht, Gedrückthalten öffnet die Auswahl zum
 * Verschieben. Die Checkbox steht links und ist ein eigenes Bedienelement,
 * damit sie nicht das Öffnen auslöst.
 */
export function MobileTaskList({
  tasks,
  onOpenTask,
  onMoveTask,
}: {
  tasks: LocalTask[]
  onOpenTask: (task: LocalTask) => void
  onMoveTask: (task: LocalTask) => void
}) {
  if (tasks.length === 0) {
    return (
      <p className="px-4 py-10 text-center text-sm text-neutral-500" data-testid="empty-tasks">
        Noch keine Aufgaben in dieser Liste.
      </p>
    )
  }

  return (
    <ul data-testid="task-list">
      {tasks.map((task) => (
        <MobileTaskRow key={task.id} task={task} onOpen={onOpenTask} onMove={onMoveTask} />
      ))}
    </ul>
  )
}

function MobileTaskRow({
  task,
  onOpen,
  onMove,
}: {
  task: LocalTask
  onOpen: (task: LocalTask) => void
  onMove: (task: LocalTask) => void
}) {
  const { repositories } = useWorkspace()
  const longPress = useLongPress(() => onMove(task))
  const overdue = task.due_at !== null && !task.completed && isOverdue(task.due_at)

  return (
    <li className="flex items-start gap-3 border-b border-neutral-900 px-4 py-3">
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
        {...longPress.handlers}
        onClick={() => {
          // Nach einem Langdruck folgt trotzdem ein Klick – der darf die
          // Detailansicht nicht zusätzlich öffnen.
          if (longPress.wasLongPress()) return
          onOpen(task)
        }}
        className="min-w-0 flex-1 select-none text-left"
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
        {task.due_at ? (
          <span className={`mt-0.5 block text-xs ${overdue ? 'text-red-400' : 'text-neutral-500'}`}>
            {formatDateTime(task.due_at)}
            {overdue ? ' · überfällig' : ''}
          </span>
        ) : null}
      </button>
    </li>
  )
}
