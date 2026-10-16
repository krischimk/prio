import { useRef, useState } from 'react'
import { useWorkspace } from '../app/useWorkspace'
import { useIsDesktop } from '../app/useIsDesktop'
import { useTasksQuery } from '../app/hooks'
import type { OverviewMode } from '../domain/types'
import { useView } from './useView'
import { Button } from './components/Button'
import { errorBox, emptyState, numeric } from './styles'
import { formatOpenTasks } from './taskCount'
import { OverviewTitle } from './OverviewTitle'
import { TaskList } from './TaskList'
import { DelayedLoading } from './components/DelayedLoading'
import { TaskComposer } from './TaskComposer'
import { TaskViewOptions, ActiveTagFilters } from './TaskViewOptions'
import { matchesTags } from '../domain/tags'

export function OverviewPanel({ currentUserId }: { currentUserId: string }) {
  const desktop = useIsDesktop()
  const { overview, tagFilter } = useView()
  const { repositories } = useWorkspace()
  const included = new Set(overview.preferences.filter(row => row.include_in_overview).map(row => row.list_id))
  const lists = overview.lists.filter(list => included.has(list.id))
  const query = useTasksQuery(lists.map(list => list.id))
  const mode = overview.userPreference?.overview_mode ?? 'by_list'
  const [busy, setBusy] = useState(false)
  const writing = useRef(false)
  const [error, setError] = useState<string | null>(null)
  const write = async (overviewMode: OverviewMode) => {
    if (writing.current) return
    writing.current = true; setBusy(true); setError(null)
    try { await repositories.updateUserPreferences(currentUserId, { overviewMode }) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Die Änderung konnte nicht gespeichert werden.') }
    finally { writing.current = false; setBusy(false) }
  }
  return <section aria-label="Gesamtansicht" className={`mx-auto flex min-h-0 w-full max-w-4xl flex-1 flex-col gap-3 ${desktop ? 'p-rand' : 'px-rand py-3'}`}>
    <header>
      {desktop ? <h1 aria-label="Gesamtansicht" className="text-heading font-semibold tracking-tight"><OverviewTitle /></h1> : null}
      <div className="flex items-center justify-between gap-2">
        <p className={`text-meta text-ink-muted ${numeric}`}>{formatOpenTasks(query.tasks.filter(task => matchesTags(task.tags, tagFilter)).length, tagFilter.length ? query.tasks.length : undefined)} · {lists.length} {lists.length === 1 ? 'Liste' : 'Listen'}</p>
        {overview.status === 'ready' ? <TaskViewOptions tags={query.tasks.flatMap(task => task.tags)} mode={mode} busy={busy} onModeChange={mode => void write(mode)} /> : null}
      </div>
      <ActiveTagFilters />
      {error ? <p role="alert" className={errorBox}>{error}</p> : null}
    </header>
    {desktop && overview.status === 'ready' && overview.lists.length > 0 ? <TaskComposer /> : null}
    {overview.status === 'loading' || query.status === 'loading' ? <DelayedLoading>Gesamtansicht wird geladen …</DelayedLoading>
      : overview.status === 'error' || query.status === 'error' ? <div className="space-y-3 py-6">
        <p role="alert" className={errorBox}>Die Gesamtansicht konnte nicht geladen werden.</p>
        <Button variant="secondary" onClick={() => { overview.retry(); query.retry() }}>Erneut versuchen</Button>
      </div>
      : overview.lists.length === 0 ? <p className={emptyState}>
        {desktop ? 'Lege links eine Liste an, um Aufgaben zu erfassen.' : 'Öffne oben links das Menü und lege eine Liste an.'}
      </p>
      : lists.length === 0 ? <div className={`${emptyState} space-y-4`}>
        <p>Noch keine Listen ausgewählt. Öffne die Auswahl über den Titel „Gesamtansicht“.</p>
      </div>
      : <TaskList key={mode} lists={lists} tasks={query.tasks} currentUserId={currentUserId} overview mode={mode} />}
  </section>
}
