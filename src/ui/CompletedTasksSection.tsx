import { useState } from 'react'
import { DelayedLoading } from './components/DelayedLoading'
import { useCompletedTaskCount, useCompletedTasks } from '../app/hooks'
import { SectionHeader } from './SectionHeader'
import { Button } from './components/Button'
import { compareRestorable } from '../domain/ordering'
import type { LocalList } from '../domain/types'
import { useView } from './useView'
import { TaskRow } from './TaskRow'
import { matchesTags } from '../domain/tags'

export function CompletedTasksSection({ lists, currentUserId, showOrigin = false, overview = false }: { lists: LocalList[]; currentUserId: string; showOrigin?: boolean; overview?: boolean }) {
  const { setTaskDetail, tagFilter } = useView()
  const [open, setOpen] = useState(false)
  const ids = lists.map(list => list.id)
  const count = useCompletedTaskCount(ids, tagFilter)
  const query = useCompletedTasks(open ? ids : [])
  const tasks = query.tasks.filter(task => matchesTags(task.tags, tagFilter))
  return <section aria-label="Erledigt" className="mt-2 border-t border-line pt-1">
    <SectionHeader name="Erledigt" muted anzahl={count.count} offen={open} onToggle={() => setOpen(value => !value)} />
    {open && query.status === 'loading' ? <DelayedLoading>Erledigte Aufgaben werden geladen …</DelayedLoading> : null}
    {count.status === 'error' || open && query.status === 'error' ? <div className="space-y-2">
      <p role="alert">Erledigte Aufgaben ließen sich nicht laden.</p>
      <Button variant="secondary" onClick={() => { count.retry(); query.retry() }}>Erneut versuchen</Button>
    </div> : null}
    {open && query.status === 'ready' ? tasks.length === 0 ? <p className="py-3 text-body text-ink-muted">{tagFilter.length ? 'Keine passenden erledigten Aufgaben.' : 'Noch nichts erledigt.'}</p> : <ul>
      {[...tasks].sort(compareRestorable).map(task => <TaskRow key={task.id} task={task} currentUserId={currentUserId}
        ratingsEnabled={lists.find(list => list.id === task.list_id)?.ratings_enabled}
        origin={showOrigin ? lists.find(list => list.id === task.list_id)?.name : undefined}
        onOpen={row => setTaskDetail({ taskId: row.id, listId: row.list_id, fromOverview: overview })} />)}
    </ul> : null}
  </section>
}
