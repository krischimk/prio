import { ListHeading } from './ListHeading'
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
import { SectionsIcon, SettingsIcon } from './icons'
import { IconButton } from './components/IconButton'
import { ListSettingsSheet } from './ListSettingsSheet'
import { TaskViewOptions, ActiveTagFilters } from './TaskViewOptions'
import { matchesTags } from '../domain/tags'

export function TaskPanel({ list, currentUserId }: { list: LocalList; currentUserId: string }) {
  const query = useTasksQuery([list.id])
  const desktop = useIsDesktop()
  const { setListSettingsId, tagFilter, overview } = useView()
  const { repositories } = useWorkspace()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sectionsOpen, setSectionsOpen] = useState(false)
  const mode = list.ratings_enabled ? overview.preferences.find(row => row.list_id === list.id)?.sort_mode ?? 'manual' : 'manual'
  const changeSort = async (value: ListSortMode) => {
    setBusy(true); setError(null)
    try { await repositories.setListSortMode(list.id, currentUserId, value) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Die Sortierung konnte nicht gespeichert werden.') }
    finally { setBusy(false) }
  }
  return <section className={`mx-auto flex min-h-0 w-full max-w-4xl flex-1 flex-col ${desktop ? 'gap-5 p-rand' : 'pb-3'}`} aria-label="Aufgaben">
    {desktop ? <header className="flex shrink-0 items-start justify-between gap-4">
      <div className="min-w-0 flex-1">
        <ListHeading list={list} currentUserId={currentUserId} main />
      </div>
      {desktop ? <Button variant="secondary" data-focus-key={`settings:list:${list.id}`} onClick={() => setListSettingsId(list.id)}>
        <SettingsIcon />Liste verwalten
      </Button> : null}
    </header> : null}
    {desktop ? <TaskComposer listId={list.id} /> : null}
    <div className="flex min-h-0 flex-1 flex-col">
    <div className={desktop ? undefined : 'px-rand pt-2'}>
      <div className="flex items-center justify-between gap-2">
        <p className={`text-label text-ink-muted ${numeric}`}>{formatOpenTasks(query.tasks.filter(task => matchesTags(task.tags, tagFilter)).length, tagFilter.length ? query.tasks.length : undefined)}{list.is_shared ? ' · Geteilte Liste' : ''}</p>
        <div className="flex items-center">
          {list.owner_id === currentUserId ? <IconButton size={desktop ? 'iconSm' : 'toolbarIcon'} aria-label="Bereiche verwalten"
            title="Bereiche dieser Liste anlegen, umbenennen und umsortieren." onClick={() => setSectionsOpen(true)}><SectionsIcon className="size-icon-meta" /></IconButton> : null}
          <TaskViewOptions tags={query.tasks.flatMap(task => task.tags)} listMode={list.ratings_enabled ? mode : undefined}
            hasSections={list.sections.length > 0} busy={busy} onListModeChange={value => void changeSort(value)} />
        </div>
      </div>
      <ActiveTagFilters />
      {error ? <p role="alert" className={errorBox}>{error}</p> : null}
    </div>
    {query.status === 'loading' ? <DelayedLoading>Aufgaben werden geladen …</DelayedLoading>
      : query.status === 'error' ? <div className="space-y-3"><p role="alert" className={errorBox}>Die Aufgaben konnten nicht geladen werden.</p>
        <Button variant="secondary" onClick={query.retry}>Erneut versuchen</Button></div>
      : <TaskList key={`${list.id}:${mode}`} lists={[list]} tasks={query.tasks} currentUserId={currentUserId} listMode={mode} mode={mode === 'priority_flat' ? 'priority' : 'by_list'} />}
    </div>
    {sectionsOpen ? <ListSettingsSheet list={list} currentUserId={currentUserId} initialMode="bereiche" onClose={() => setSectionsOpen(false)} /> : null}
  </section>
}
