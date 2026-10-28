import { Activity, memo, useMemo, useRef, useState } from 'react'
import { useNowMs, useRepositories } from '../app/useWorkspace'
import { useIsDesktop } from '../app/useIsDesktop'
import { useTasksQuery } from '../app/hooks'
import type { OverviewMode } from '../domain/types'
import { useTaskView } from './useView'
import { Button } from './components/Button'
import { errorBox, emptyState, numeric } from './styles'
import { formatOpenTasks } from './taskCount'
import { OverviewTitle } from './OverviewTitle'
import { TaskList } from './TaskList'
import { DelayedLoading } from './components/DelayedLoading'
import { TaskComposer } from './TaskComposer'
import { TaskViewOptions, ActiveTagFilters } from './TaskViewOptions'
import { matchesTags } from '../domain/tags'
import { parseCalendarPreferences } from '../domain/calendar'
import { isTaskVisible } from '../domain/routine'
import { OverviewCalendar } from './OverviewCalendar'
import { IconButton } from './components/IconButton'
import { CalendarIcon } from './icons'

export const OverviewPanel = memo(function OverviewPanel({ currentUserId }: { currentUserId: string }) {
  const desktop = useIsDesktop()
  const { overview, tagFilter } = useTaskView()
  const repositories = useRepositories()
  const lists = useMemo(() => {
    const included = new Set(overview.preferences.filter(row => row.include_in_overview).map(row => row.list_id))
    return overview.lists.filter(list => included.has(list.id))
  }, [overview.lists, overview.preferences])
  const query = useTasksQuery(lists.map(list => list.id), true)
  const nowMs = useNowMs()
  const visibleTasks = useMemo(() => query.tasks.filter(task => isTaskVisible(task, nowMs)), [query.tasks, nowMs])
  const calendar = parseCalendarPreferences(overview.userPreference?.calendar_preferences)
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
  return <section aria-label="Gesamtansicht" className={`mx-auto flex min-h-0 w-full max-w-4xl flex-1 flex-col ${desktop ? 'gap-3 p-rand' : 'pb-3'}`}>
    {desktop ? <header><h1 aria-label="Gesamtansicht" className="text-heading font-semibold tracking-tight"><OverviewTitle /></h1></header> : null}
    {desktop && overview.status === 'ready' && overview.lists.length > 0 ? <TaskComposer /> : null}
    <div className="flex min-h-0 flex-1 flex-col">
    <div className={desktop ? undefined : 'px-rand pt-2'}>
      <div className="flex items-center justify-between gap-2">
        <p className={`text-label text-ink-muted ${numeric}`}>{formatOpenTasks(visibleTasks.filter(task => matchesTags(task.tags, tagFilter)).length, tagFilter.length ? visibleTasks.length : undefined)} · {lists.length} {lists.length === 1 ? 'Liste' : 'Listen'}</p>
        <div className="flex items-center gap-1">
        <IconButton size="toolbarIcon" aria-label={calendar.open ? 'Kalender schließen' : 'Kalender anzeigen'} variant={calendar.open ? 'iconActive' : 'iconMuted'} aria-pressed={calendar.open}
          onClick={() => void repositories.updateUserPreferences(currentUserId, { calendar: { open: !calendar.open } }).catch(() => setError('Die Ansicht konnte nicht gespeichert werden.'))}><CalendarIcon className="size-icon-meta" /></IconButton>
        {overview.status === 'ready' ? <TaskViewOptions tags={query.tasks.flatMap(task => task.tags)} mode={mode} busy={busy} onModeChange={mode => void write(mode)} /> : null}
        </div>
      </div>
      <ActiveTagFilters />
      {error ? <p role="alert" className={errorBox}>{error}</p> : null}
    </div>
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
      : <>
        {/* Activity erhält die Listen-DOM; verborgen werden Effekte und Zieh-Handler abgemeldet. */}
        <Activity mode={calendar.open ? 'hidden' : 'visible'}>
          <TaskList lists={lists} tasks={visibleTasks} currentUserId={currentUserId} overview mode={mode} />
        </Activity>
        {calendar.open ? <OverviewCalendar tasks={query.tasks.filter(task => matchesTags(task.tags, tagFilter))} lists={lists} currentUserId={currentUserId} /> : null}
      </>}
    </div>
  </section>
})
