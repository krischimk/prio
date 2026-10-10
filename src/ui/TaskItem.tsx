import type { LocalTask } from '../domain/types'
import { TaskDescription } from './TaskDescription'
import { TaskFacts } from './TaskFacts'
import { TaskCheckbox } from './TaskCheckbox'
import { useView } from './useView'
import { focusRing } from './styles'
import { EditIcon } from './icons'

/** Ruhige Aufgabenzeile; sämtliche Details und Aktionen stehen im Editor. */
export function TaskItem({ task, currentUserId }: { task: LocalTask; currentUserId: string }) {
  const { setTaskDetail } = useView()
  return <li className="flex min-w-0 items-start gap-2 border-b border-line-soft py-2 last:border-b-0">
    <TaskCheckbox task={task} />
    <div className="min-w-0 flex-1">
      <button type="button" aria-label="Bearbeiten" data-focus-key={`task:${task.id}`}
        className={`${focusRing} group flex min-h-11 w-full items-start gap-4 rounded-control py-2 text-left`}
        onClick={() => setTaskDetail({ taskId: task.id, listId: task.list_id })}>
        <span className="min-w-0 flex-1"><TaskFacts task={task} currentUserId={currentUserId} /></span>
        <EditIcon className="mt-1 h-4 w-4 shrink-0 text-ink-faint group-hover:text-brand-soft" />
      </button>
      {task.description ? <TaskDescription text={task.description} className="pb-2" /> : null}
    </div>
  </li>
}
