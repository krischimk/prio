import { memo, useContext, type Ref } from 'react'
import { useIsDesktop } from '../app/useIsDesktop'
import type { LocalList, LocalTask } from '../domain/types'
import { TaskCheckbox } from './TaskCheckbox'
import { TaskFacts } from './TaskFacts'
import { TaskDescription } from './TaskDescription'
import { appBackground, focusRing } from './styles'
import { formatCompletedLabel } from './datetime'
import { Hint, HintProvider } from './components/Hint'
import { TaskDeleteButton } from './TaskDeleteButton'
import { TaskChecklist } from './TaskChecklist'
import { useTaskExpansion } from './useTaskExpansion'
import { BulletListIcon, TagIcon } from './icons'
import { ListIcon } from './ListIcon'
import { TaskPriorityBar, TaskRatingSummary } from './TaskRating'
import { PriorityRanksContext } from './priorityRanksContext'
import { visibleChecklistItems } from '../domain/checklist'

/** Die Aufgabenzeile ist in Einzel- und Gesamtansicht dieselbe. */
export function TaskRow({ task, currentUserId, onOpen, origin, originList, overview = false, elementRef, activatorRef, dragging = false, ratingsEnabled = false }: {
  task: LocalTask; currentUserId: string; onOpen: (task: LocalTask) => void
  origin?: string; overview?: boolean
  originList?: Pick<LocalList, 'name' | 'icon'>
  elementRef?: Ref<HTMLLIElement>; activatorRef?: Ref<HTMLDivElement>
  dragging?: boolean
  ratingsEnabled?: boolean
}) {
  const desktop = useIsDesktop()
  const rank = useContext(PriorityRanksContext).get(task.id)
  const note = useTaskExpansion(currentUserId, task.id, 'note')
  return <TaskRowContent task={task} currentUserId={currentUserId} onOpen={onOpen} origin={origin} originList={originList} overview={overview}
    elementRef={elementRef} activatorRef={activatorRef} dragging={dragging} ratingsEnabled={ratingsEnabled} desktop={desktop} rank={rank}
    noteOpen={note.open} noteBusy={note.busy} noteError={note.error} toggleNote={note.toggle} />
}

/** Kontextänderungen betreffen den Leser oben; unveränderte Zeilen bleiben stehen. */
const TaskRowContent = memo(function TaskRowContent({ task, currentUserId, onOpen, origin, originList, overview, elementRef, activatorRef, dragging = false, ratingsEnabled, desktop, rank,
  noteOpen, noteBusy, noteError, toggleNote }: Parameters<typeof TaskRow>[0] & {
    desktop: boolean; rank?: 1 | 2 | 3; noteOpen: boolean; noteBusy: boolean; noteError: string | null; toggleNote: () => Promise<void>
  }) {
  const checklist = visibleChecklistItems(task.checklist, task.checklist_hide_completed).length > 0
  const tags = task.tags.length ? <Hint text={`Tags: ${task.tags.join(', ')}`}>
    <span aria-label={`Tags: ${task.tags.join(', ')}`} className="ml-auto inline-flex max-w-[40%] min-w-0 shrink-0 items-center gap-1 text-meta text-ink-muted">
      <TagIcon className="size-icon-meta shrink-0" /><span className="truncate">{task.tags.join(' · ')}</span>
    </span>
  </Hint> : null
  const content = <div data-testid="task-row"
        className={`col-span-3 col-start-1 row-start-1 w-full min-w-0 rounded-control pl-14 ${desktop ? 'pr-14' : 'pr-3'} ${checklist || task.description ? 'min-h-11 pt-3 pb-0' : 'min-h-14 pt-4 pb-3'} text-left`}>
        <div className="flex min-w-0 items-end gap-3"><div className="min-w-0 flex-1">
        <TaskFacts task={task} currentUserId={currentUserId} titleTrailing={originList ? <Hint text={`${originList.name}${origin ? ` · ${origin}` : ''}`}>
          <span role="img" aria-label={`Liste: ${originList.name}${origin ? ` · ${origin}` : ''}`} className="mt-1 inline-flex shrink-0 text-ink-muted">
            {originList.icon ? <ListIcon icon={originList.icon} className="size-icon-meta" /> : <BulletListIcon className="size-icon-meta" />}
          </span>
        </Hint> : null} afterTitle={ratingsEnabled && task.rating ? <TaskPriorityBar rating={task.rating} dueAt={task.due_at} checklist={task.checklist} rank={rank} /> : null} />
          {origin && !originList ? <span className="mt-1 block break-words text-meta text-ink-muted">{origin}</span> : null}
        {ratingsEnabled && task.rating ? <TaskRatingSummary rating={task.rating} dueAt={task.due_at} checklist={task.checklist} includePriority={false} /> : null}
        </div>{!checklist && !task.description ? tags : null}</div>
      </div>
  return <HintProvider><li ref={elementRef} data-task-row="true" data-id={task.id}
    data-completed={task.completed ? 'true' : undefined} data-dragging={dragging ? 'true' : undefined}
    data-testid={overview ? 'overview-task' : undefined}
    className={`task-card group/row min-w-0 border-b border-line-soft ${appBackground} transition-colors last:border-b-0 ${dragging ? 'ring-1 ring-brand-soft shadow-lg shadow-page/50' : ''}`}>
    <div ref={activatorRef} role="button" tabIndex={0} data-focus-key={`task:${task.id}`}
      aria-label={task.completed ? `Aufgabe bearbeiten: ${task.title}` : desktop ? 'Bearbeiten' : undefined}
      className={`${focusRing} grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] rounded-control`}
      onKeyDown={event => {
        if (event.target !== event.currentTarget || event.defaultPrevented || dragging) return
        if (event.key === 'Enter' || (!activatorRef && event.key === ' ')) { event.preventDefault(); onOpen(task) }
      }}
      onClick={event => { if (!event.defaultPrevented && !dragging && !(event.target as HTMLElement).closest('button,input,select,textarea,label,a,[data-no-drag]')) onOpen(task) }}>
    {noteError ? <p role="alert" className="text-meta text-danger">{noteError}</p> : null}
    {task.completed_at ? <Hint text={formatCompletedLabel(task.completed_at)}>{content}</Hint> : content}
    <div className="pointer-events-none col-start-1 row-start-1 flex items-center"><TaskCheckbox task={task} /></div>
    {desktop ? <div className="pointer-events-none col-start-3 row-start-1 flex items-center"><TaskDeleteButton task={task} disabled={dragging} /></div> : null}
    {task.description ? <div className={`col-span-3 col-start-1 row-start-2 mt-1 flex min-w-0 items-end gap-3 pl-14 ${desktop ? 'pr-14' : 'pr-3'} ${checklist ? '' : 'pb-3'}`}>
      <TaskDescription text={task.description} className="min-w-0 flex-1" open={noteOpen} busy={noteBusy} onToggle={toggleNote} />
      {!checklist ? tags : null}
    </div> : null}
    {checklist ? <div className={`col-span-3 col-start-1 row-start-3 -mt-1 min-w-0 pl-14 ${desktop ? 'pr-14' : 'pr-3'} pb-2`}><TaskChecklist task={task} currentUserId={currentUserId} trailing={tags} /></div> : null}
    </div>
  </li></HintProvider>
})
