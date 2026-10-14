import { useRef, useState } from 'react'
import { useWorkspace } from '../app/useWorkspace'
import { useIsDesktop } from '../app/useIsDesktop'
import { useTasksQuery } from '../app/hooks'
import type { OverviewMode } from '../domain/types'
import { useView } from './useView'
import { Button } from './components/Button'
import { errorBox, emptyState, input, numeric } from './styles'
import { formatOpenTasks } from './taskCount'
import { SortIcon } from './icons'
import { OverviewTitle } from './OverviewTitle'
import { TaskList } from './TaskList'
import { TaskComposer } from './TaskComposer'
import { IconButton } from './components/IconButton'
import { Popover } from '@ark-ui/react/popover'
import { useBackLayer } from '../app/useBackLayer'
import { layer } from './styles'

export function OverviewPanel({ currentUserId }: { currentUserId: string }) {
  const desktop = useIsDesktop()
  const { overview } = useView()
  const { repositories } = useWorkspace()
  const included = new Set(overview.preferences.filter(row => row.include_in_overview).map(row => row.list_id))
  const lists = overview.lists.filter(list => included.has(list.id))
  const query = useTasksQuery(lists.map(list => list.id))
  const mode = overview.userPreference?.overview_mode ?? 'by_list'
  const [busy, setBusy] = useState(false)
  const writing = useRef(false)
  const [error, setError] = useState<string | null>(null)
  const [sortOpen, setSortOpen] = useState(false)
  useBackLayer(sortOpen, () => setSortOpen(false), 'gesamtansicht-sortierung')
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
        <p className={`text-meta text-ink-muted ${numeric}`}>{formatOpenTasks(query.tasks.length)} · {lists.length} {lists.length === 1 ? 'Liste' : 'Listen'}</p>
    {overview.status === 'ready' ? <div>
      <Popover.Root open={sortOpen} onOpenChange={details => setSortOpen(details.open)} onEscapeKeyDown={event => { event.preventDefault(); setSortOpen(false) }} positioning={{ strategy: 'fixed', placement: 'bottom-end' }} lazyMount unmountOnExit>
        <Popover.Trigger asChild><IconButton aria-label="Sortierung ändern" title={`Ansicht: ${mode === 'by_list' ? 'Nach Listen gruppiert' : 'Neueste zuerst'}. Sortierung ändern.`}><SortIcon /></IconButton></Popover.Trigger>
        <Popover.Positioner className={layer.raised}><Popover.Content className="w-72 max-w-[calc(100vw-2rem)] rounded-card border border-line-strong bg-raised p-3 shadow-lg shadow-page/50">
          <label className="text-meta text-ink-muted"><span className="sr-only">Ansicht der Gesamtansicht</span>
            <select aria-label="Ansicht der Gesamtansicht" className={input} value={mode} disabled={busy} onChange={event => { void write(event.target.value as OverviewMode); setSortOpen(false) }}>
              <option value="by_list">Nach Listen gruppiert</option><option value="newest">Neueste zuerst</option>
            </select>
          </label>
        </Popover.Content></Popover.Positioner>
      </Popover.Root>
    </div> : null}
      </div>
      {error ? <p role="alert" className={errorBox}>{error}</p> : null}
    </header>
    {desktop && overview.status === 'ready' && overview.lists.length > 0 ? <TaskComposer /> : null}
    {overview.status === 'loading' || query.status === 'loading' ? <p role="status" className="py-6 text-body text-ink-muted">Gesamtansicht wird geladen …</p>
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
