import type { ReactNode, Ref } from 'react'
import { useIsDesktop } from '../app/useIsDesktop'
import type { LocalTask } from '../domain/types'
import { TaskCheckbox } from './TaskCheckbox'
import { TaskFacts } from './TaskFacts'
import { TaskDescription } from './TaskDescription'
import { EditIcon } from './icons'
import { appBackground, focusRing } from './styles'
import { formatCompletedLabel } from './datetime'

/** Die Aufgabenzeile ist in Einzel- und Gesamtansicht dieselbe. */
export function TaskRow({ task, currentUserId, onOpen, origin, overview = false, elementRef, activatorRef, dragging = false, action }: {
  task: LocalTask; currentUserId: string; onOpen: (task: LocalTask) => void
  origin?: string; overview?: boolean
  elementRef?: Ref<HTMLLIElement>; activatorRef?: Ref<HTMLButtonElement>
  dragging?: boolean
  action?: ReactNode
}) {
  const desktop = useIsDesktop()
  return <li ref={elementRef} data-task-row="true" data-id={task.id}
    data-completed={task.completed ? 'true' : undefined} data-dragging={dragging ? 'true' : undefined}
    data-testid={overview ? 'overview-task' : undefined}
    className={`flex min-w-0 items-start gap-2 border-b border-line-soft ${appBackground} py-2 last:border-b-0 ${dragging ? 'rounded-control ring-1 ring-brand-soft shadow-lg shadow-page/50' : ''}`}>
    <TaskCheckbox task={task} />
    <div className="min-w-0 flex-1">
      <button type="button" ref={activatorRef}
        aria-label={task.completed ? `Aufgabe bearbeiten: ${task.title}` : desktop ? 'Bearbeiten' : undefined}
        data-testid="task-row" data-focus-key={`task:${task.id}`}
        className={`${focusRing} group flex min-h-11 w-full min-w-0 items-start gap-4 rounded-control py-2 text-left`}
        onClick={event => { if (!event.defaultPrevented && !dragging) onOpen(task) }}>
        <span className="min-w-0 flex-1"><TaskFacts task={task} currentUserId={currentUserId} />
          {origin ? <span className="mt-1 block break-words text-meta text-ink-muted">{origin}</span> : null}
        </span>
        {desktop ? <EditIcon className="mt-1 h-4 w-4 shrink-0 text-ink-faint group-hover:text-brand-soft" /> : null}
      </button>
      {task.description ? <TaskDescription text={task.description} className="pb-2" /> : null}
      {task.completed_at ? <p className="text-meta text-ink-faint">{formatCompletedLabel(task.completed_at)}</p> : null}
    </div>
    {action}
  </li>
}
