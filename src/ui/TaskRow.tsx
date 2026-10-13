import type { Ref } from 'react'
import { useIsDesktop } from '../app/useIsDesktop'
import type { LocalTask } from '../domain/types'
import { TaskCheckbox } from './TaskCheckbox'
import { TaskFacts } from './TaskFacts'
import { TaskDescription } from './TaskDescription'
import { appBackground, focusRing } from './styles'
import { formatCompletedLabel } from './datetime'
import { Hint } from './components/Hint'
import { TaskDeleteButton } from './TaskDeleteButton'

/** Die Aufgabenzeile ist in Einzel- und Gesamtansicht dieselbe. */
export function TaskRow({ task, currentUserId, onOpen, origin, overview = false, elementRef, activatorRef, dragging = false }: {
  task: LocalTask; currentUserId: string; onOpen: (task: LocalTask) => void
  origin?: string; overview?: boolean
  elementRef?: Ref<HTMLLIElement>; activatorRef?: Ref<HTMLDivElement>
  dragging?: boolean
}) {
  const desktop = useIsDesktop()
  const content = <div role="button" tabIndex={0} ref={activatorRef}
        aria-label={task.completed ? `Aufgabe bearbeiten: ${task.title}` : desktop ? 'Bearbeiten' : undefined}
        data-testid="task-row" data-focus-key={`task:${task.id}`}
        className={`${focusRing} min-h-11 w-full min-w-0 rounded-control px-2 py-2 text-left transition-colors hover:bg-surface active:bg-raised`}
        onClick={event => { if (!event.defaultPrevented && !dragging && !(event.target as HTMLElement).closest('button')) onOpen(task) }}
        onKeyDown={event => {
          if (event.target !== event.currentTarget || event.defaultPrevented || dragging) return
          if (event.key === 'Enter' || (!activatorRef && event.key === ' ')) { event.preventDefault(); onOpen(task) }
        }}>
        <TaskFacts task={task} currentUserId={currentUserId} />
          {origin ? <span className="mt-1 block break-words text-meta text-ink-muted">{origin}</span> : null}
        {task.description ? <TaskDescription text={task.description} className="mt-1" /> : null}
      </div>
  return <li ref={elementRef} data-task-row="true" data-id={task.id}
    data-completed={task.completed ? 'true' : undefined} data-dragging={dragging ? 'true' : undefined}
    data-testid={overview ? 'overview-task' : undefined}
    className={`group/row flex min-w-0 items-start gap-2 border-b border-line-soft ${appBackground} py-2 last:border-b-0 ${dragging ? 'rounded-control ring-1 ring-brand-soft shadow-lg shadow-page/50' : ''}`}>
    <TaskCheckbox task={task} />
    <div className="min-w-0 flex-1">
      {task.completed_at ? <Hint text={formatCompletedLabel(task.completed_at)}>{content}</Hint> : content}
    </div>
    {desktop ? <TaskDeleteButton task={task} disabled={dragging} /> : null}
  </li>
}
