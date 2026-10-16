import { ListIcon } from './ListIcon'
import { useTasksQuery } from '../app/hooks'
import { useIsDesktop } from '../app/useIsDesktop'
import type { LocalList, ListSortMode } from '../domain/types'
import { useState } from 'react'
import { useWorkspace } from '../app/useWorkspace'
import { TaskComposer } from './TaskComposer'
import { TaskList } from './TaskList'
import { DelayedLoading } from './components/DelayedLoading'
import { errorBox, numeric } from './styles'
import { formatOpenTasks } from './taskCount'
import { Button } from './components/Button'
import { useView } from './useView'
import { SettingsIcon } from './icons'
import { TaskViewOptions, ActiveTagFilters } from './TaskViewOptions'
import { matchesTags } from '../domain/tags'

export function TaskPanel({ list, currentUserId }: { list: LocalList; currentUserId: string }) {
  const query = useTasksQuery([list.id])
  const desktop = useIsDesktop()
  const { setListSettingsId, tagFilter, overview } = useView()
  const { repositories } = useWorkspace()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const mode = list.ratings_enabled ? overview.preferences.find(row => row.list_id === list.id)?.sort_mode ?? 'manual' : 'manual'
  const changeSort = async (value: ListSortMode) => {
    setBusy(true); setError(null)
    try { await repositories.setListSortMode(list.id, currentUserId, value) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Die Sortierung konnte nicht gespeichert werden.') }
    finally { setBusy(false) }
  }
  return <section className="mx-auto flex min-h-0 w-full max-w-4xl flex-1 flex-col gap-5 p-rand" aria-label="Aufgaben">
    {desktop ? <header className="flex shrink-0 items-start justify-between gap-4">
      <div className="min-w-0 flex-1">
        {desktop ? <div className="flex min-w-0 items-center gap-3">
          <ListIcon icon={list.icon} className="h-7 w-7 shrink-0 text-brand-soft" />
          <h1 className="break-words text-heading font-semibold tracking-tight text-ink-strong" data-testid="list-title">{list.name}</h1>
        </div> : null}
      </div>
      {desktop ? <Button variant="secondary" data-focus-key={`settings:list:${list.id}`} onClick={() => setListSettingsId(list.id)}>
        <SettingsIcon />Liste verwalten
      </Button> : null}
    </header> : null}
    {desktop ? <TaskComposer listId={list.id} /> : null}
    <div>
      <div className="flex items-center justify-between gap-2">
        <p className={`text-meta text-ink-muted ${numeric}`}>{formatOpenTasks(query.tasks.filter(task => matchesTags(task.tags, tagFilter)).length, tagFilter.length ? query.tasks.length : undefined)}{list.is_shared ? ' · Geteilte Liste' : ''}</p>
        <TaskViewOptions tags={query.tasks.flatMap(task => task.tags)} listMode={list.ratings_enabled ? mode : undefined}
          hasSections={list.sections.length > 0} busy={busy} onListModeChange={value => void changeSort(value)} />
      </div>
      <ActiveTagFilters />
      {error ? <p role="alert" className={errorBox}>{error}</p> : null}
    </div>
    {query.status === 'loading' ? <DelayedLoading>Aufgaben werden geladen …</DelayedLoading>
      : query.status === 'error' ? <div className="space-y-3"><p role="alert" className={errorBox}>Die Aufgaben konnten nicht geladen werden.</p>
        <Button variant="secondary" onClick={query.retry}>Erneut versuchen</Button></div>
      : <TaskList key={`${list.id}:${mode}`} lists={[list]} tasks={query.tasks} currentUserId={currentUserId} listMode={mode} mode={mode === 'priority_flat' ? 'priority' : 'by_list'} />}
  </section>
}
