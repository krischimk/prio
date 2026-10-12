import { useState } from 'react'
import { useCompletedTasks } from '../app/hooks'
import { useWorkspace } from '../app/useWorkspace'
import { SectionHeader } from './SectionHeader'
import { Button } from './components/Button'
import { compareRestorable } from '../domain/ordering'
import type { LocalList } from '../domain/types'
import { useView } from './useView'
import { TaskRow } from './TaskRow'

export function CompletedTasksSection({ lists, currentUserId, showOrigin = false, overview = false }: { lists: LocalList[]; currentUserId: string; showOrigin?: boolean; overview?: boolean }) {
  const { repositories } = useWorkspace()
  const { setTaskDetail } = useView()
  const query = useCompletedTasks(lists.map(list => list.id))
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
      {[...query.tasks].sort(compareRestorable).map(task => <TaskRow key={task.id} task={task} currentUserId={currentUserId}
        origin={showOrigin ? lists.find(list => list.id === task.list_id)?.name : undefined}
        onOpen={row => setTaskDetail({ taskId: row.id, listId: row.list_id, fromOverview: overview })}
        action={<Button variant="secondary" size="sm" disabled={busyId !== null} onClick={() => void reopen(task.id)}>Wieder öffnen</Button>} />)}
    </ul> : null}
    {error ? <p role="alert">{error}</p> : null}
  </section>
}
