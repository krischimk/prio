import { useState } from 'react'
import { useCompletedTasks } from '../app/hooks'
import { useWorkspace } from '../app/useWorkspace'
import { SectionHeader } from './SectionHeader'
import { Button } from './components/Button'
import { formatCompletedLabel } from './datetime'
import { useView } from './useView'
import { focusRing } from './styles'

export function CompletedTasksSection({ listId }: { listId: string }) {
  const { repositories } = useWorkspace()
  const { setTaskDetail } = useView()
  const query = useCompletedTasks(listId)
  const [open, setOpen] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  async function reopen(id: string) {
    setBusyId(id); setError(null)
    try { await repositories.setTaskCompleted(id, false) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Die Aufgabe ließ sich nicht wieder öffnen.') }
    finally { setBusyId(null) }
  }
  return <section aria-label="Abgehakt" className="mt-4 border-t border-line pt-3">
    <SectionHeader name="Abgehakt" anzahl={query.tasks.length} offen={open} onToggle={() => setOpen(value => !value)} />
    {query.status === 'loading' ? <p role="status" className="text-meta text-ink-muted">Erledigte Aufgaben werden geladen …</p> : null}
    {query.status === 'error' ? <div className="space-y-2">
      <p role="alert">Erledigte Aufgaben ließen sich nicht laden.</p>
      <Button variant="secondary" onClick={query.retry}>Erneut versuchen</Button>
    </div> : null}
    {open && query.status === 'ready' ? query.tasks.length === 0 ? <p className="py-3 text-body text-ink-muted">Noch nichts abgehakt.</p> : <ul>
      {query.tasks.map(task => <li key={task.id} className="flex items-start gap-3 border-b border-line py-3 last:border-b-0">
        <div className="min-w-0 flex-1">
          <button type="button" data-focus-key={`task:${task.id}`} aria-label={`Aufgabe bearbeiten: ${task.title}`}
            className={`${focusRing} min-h-11 w-full rounded-control text-left text-body text-ink-muted`}
            onClick={() => setTaskDetail({ taskId: task.id, listId: task.list_id })}>
            <span className="break-words">{task.title}</span>
          </button>
          {task.completed_at ? <p className="text-meta text-ink-faint">{formatCompletedLabel(task.completed_at)}</p> : null}
        </div>
        <Button variant="secondary" size="sm" disabled={busyId !== null} onClick={() => void reopen(task.id)}>Wieder öffnen</Button>
      </li>)}
    </ul> : null}
    {error ? <p role="alert">{error}</p> : null}
  </section>
}
