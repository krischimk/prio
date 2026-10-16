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
import { TaskChecklist } from './TaskChecklist'
import { TagIcon } from './icons'
import { TaskRatingSummary } from './TaskRating'

/** Die Aufgabenzeile ist in Einzel- und Gesamtansicht dieselbe. */
export function TaskRow({ task, currentUserId, onOpen, origin, overview = false, elementRef, activatorRef, dragging = false, ratingsEnabled = false }: {
  task: LocalTask; currentUserId: string; onOpen: (task: LocalTask) => void
  origin?: string; overview?: boolean
  elementRef?: Ref<HTMLLIElement>; activatorRef?: Ref<HTMLDivElement>
  dragging?: boolean
  ratingsEnabled?: boolean
}) {
  const desktop = useIsDesktop()
  const content = <div data-testid="task-row"
        className={`col-span-3 col-start-1 row-start-1 min-h-14 w-full min-w-0 rounded-control pl-14 ${desktop ? 'pr-14' : 'pr-3'} pt-4 pb-3 text-left`}>
        <TaskFacts task={task} currentUserId={currentUserId} />
          {origin ? <span className="mt-1 block break-words text-meta text-ink-muted">{origin}</span> : null}
        {task.description ? <TaskDescription text={task.description} className="mt-1" /> : null}
        {task.tags.length ? <span aria-label={`Tags: ${task.tags.join(', ')}`} className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-meta text-ink-muted">
          <TagIcon className="size-icon-meta" />{task.tags.map(tag => <span key={tag} className="min-w-0 max-w-full break-words">{tag}</span>)}
        </span> : null}
        {ratingsEnabled && task.rating ? <TaskRatingSummary rating={task.rating} dueAt={task.due_at} checklist={task.checklist} /> : null}
      </div>
  return <li ref={elementRef} data-task-row="true" data-id={task.id}
    data-completed={task.completed ? 'true' : undefined} data-dragging={dragging ? 'true' : undefined}
    data-testid={overview ? 'overview-task' : undefined}
    className={`group/row min-w-0 rounded-control border-b border-line-soft ${appBackground} transition-colors hover:bg-surface active:bg-raised last:border-b-0 ${dragging ? 'ring-1 ring-brand-soft shadow-lg shadow-page/50' : ''}`}>
    <div ref={activatorRef} role="button" tabIndex={0} data-focus-key={`task:${task.id}`}
      aria-label={task.completed ? `Aufgabe bearbeiten: ${task.title}` : desktop ? 'Bearbeiten' : undefined}
      className={`${focusRing} grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] rounded-control`}
      onKeyDown={event => {
        if (event.target !== event.currentTarget || event.defaultPrevented || dragging) return
        if (event.key === 'Enter' || (!activatorRef && event.key === ' ')) { event.preventDefault(); onOpen(task) }
      }}
      onClick={event => { if (!event.defaultPrevented && !dragging && !(event.target as HTMLElement).closest('button,input,select,textarea,label,a,[data-no-drag]')) onOpen(task) }}>
    {task.completed_at ? <Hint text={formatCompletedLabel(task.completed_at)}>{content}</Hint> : content}
    <div className="pointer-events-none col-start-1 row-start-1 flex items-center"><TaskCheckbox task={task} /></div>
    {desktop ? <div className="pointer-events-none col-start-3 row-start-1 flex items-center"><TaskDeleteButton task={task} disabled={dragging} /></div> : null}
    {task.checklist.some(item => item.deleted_at === null) ? <div className="col-span-3 col-start-1 row-start-2 min-w-0 pl-14 pr-3 pb-2"><TaskChecklist task={task} /></div> : null}
    </div>
  </li>
}
