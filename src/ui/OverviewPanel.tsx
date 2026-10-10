import { useRef, useState } from 'react'
import { useWorkspace } from '../app/useWorkspace'
import { useIsDesktop } from '../app/useIsDesktop'
import { useOverviewTasks } from '../app/hooks'
import type { LocalList, LocalTask, OverviewMode } from '../domain/types'
import { groupTasks } from '../domain/sections'
import { TaskFacts } from './TaskFacts'
import { ListIcon } from './ListIcon'
import { useView } from './useView'
import { Button } from './components/Button'
import { errorBox, emptyState, focusRing, input, numeric } from './styles'
import { TaskCheckbox } from './TaskCheckbox'
import { TaskDescription } from './TaskDescription'
import { formatOpenTasks } from './taskCount'
import { PlusIcon, SettingsIcon } from './icons'

export function OverviewPanel({ currentUserId }: { currentUserId: string }) {
  const isDesktop = useIsDesktop()
  const { overview, setOverviewSettingsOpen, setOverviewCreating, setTaskDetail, selectList } = useView()
  const { repositories } = useWorkspace()
  const included = new Set(overview.preferences.filter(row => row.include_in_overview).map(row => row.list_id))
  const lists = overview.lists.filter(list => included.has(list.id))
  const query = useOverviewTasks(lists.map(list => list.id))
  const mode = overview.userPreference?.overview_mode ?? 'by_list'
  const create = () => {
    const defaultId = overview.userPreference?.default_list_id
    if (defaultId && overview.lists.some(list => list.id === defaultId)) setTaskDetail({ taskId: null, listId: defaultId, fromOverview: true })
    else setOverviewCreating(true)
  }
  const [busy, setBusy] = useState(false)
  const writing = useRef(false)
  const [error, setError] = useState<string | null>(null)
  const write = async (operation: () => Promise<void>) => {
    if (writing.current) return
    writing.current = true; setBusy(true); setError(null)
    try { await operation() } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Die Änderung konnte nicht gespeichert werden.')
    } finally { writing.current = false; setBusy(false) }
  }

  const row = (task: LocalTask, list: LocalList, withOrigin: boolean) => <li key={task.id} data-testid="overview-task" className="flex min-w-0 items-start gap-2 border-b border-line-soft py-2 last:border-b-0">
    <TaskCheckbox task={task} />
    <div className="min-w-0 flex-1">
    <button type="button" data-focus-key={`task:${task.id}`} className={`${focusRing} min-h-11 min-w-0 w-full rounded-control py-2 text-left`}
      onClick={() => setTaskDetail({ taskId: task.id, listId: task.list_id, fromOverview: true })}>
      <TaskFacts task={task} currentUserId={currentUserId} />
      {withOrigin ? <span className="mt-1 block break-words text-meta text-ink-muted">{list.name}{task.section_id ? ` · ${list.sections.find(section => section.id === task.section_id)?.name ?? 'Ohne Bereich'}` : ''}</span> : null}
    </button>
    {task.description ? <TaskDescription text={task.description} className="pb-2" /> : null}
    </div>
  </li>

  return <section aria-label="Gesamtansicht" className={`mx-auto flex min-h-0 w-full max-w-4xl flex-1 flex-col gap-5 ${isDesktop ? 'p-rand' : 'p-5'}`}>
    <header className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><h1 className="text-heading font-semibold tracking-tight text-ink-strong">Gesamtansicht</h1>
          <p className={`mt-1 text-meta text-ink-muted ${numeric}`}>{formatOpenTasks(query.tasks.length)} · {lists.length} {lists.length === 1 ? 'Liste' : 'Listen'}</p>
        </div>
        <Button variant="secondary" data-focus-key="settings:overview" aria-label="Gesamtansicht einstellen" onClick={() => setOverviewSettingsOpen(true)}><SettingsIcon className="h-4 w-4" />Einstellungen</Button>
      </div>
      {overview.status === 'ready' ? <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-0 flex-1 space-y-1 text-meta text-ink-muted">
          <span className="block">Ansicht</span>
          <select aria-label="Ansicht der Gesamtansicht" className={input} value={mode} disabled={busy}
            onChange={event => { const overviewMode = event.target.value as OverviewMode; void write(() => repositories.updateUserPreferences(currentUserId, { overviewMode })) }}>
            <option value="by_list">Nach Listen gruppiert</option><option value="newest">Neueste zuerst</option>
          </select>
        </label>
        <Button variant="primary" data-focus-key="overview-create" disabled={overview.lists.length === 0 || busy} onClick={create}><PlusIcon className="h-4 w-4" />Neue Aufgabe</Button>
      </div> : null}
      {error ? <p role="alert" className={errorBox}>{error}</p> : null}
    </header>
    <div className="scroll-area min-h-0 flex-1 overflow-y-auto">
      {overview.status === 'loading' || query.status === 'loading' ? <p role="status" className="py-6 text-body text-ink-muted">Gesamtansicht wird geladen …</p>
        : overview.status === 'error' || query.status === 'error' ? <div className="space-y-3 py-6">
          <p role="alert" className={errorBox}>Die Gesamtansicht konnte nicht geladen werden.</p>
          <Button variant="secondary" onClick={() => { overview.retry(); query.retry() }}>Erneut versuchen</Button>
        </div>
        : overview.lists.length === 0 ? <p className={emptyState}>
          {isDesktop ? 'Lege links eine Liste an, um Aufgaben zu erfassen.' : 'Öffne oben links das Menü und lege eine Liste an.'}
        </p>
        : lists.length === 0 ? <div className={`${emptyState} space-y-4`}>
          <p>Noch keine Listen ausgewählt. Aktiviere die Listen, deren Aufgaben hier erscheinen sollen.</p>
          <Button variant="secondary" onClick={() => setOverviewSettingsOpen(true)}>Listen auswählen</Button>
        </div>
        : query.tasks.length === 0 ? <p className={emptyState}>Keine offenen Aufgaben in den ausgewählten Listen.</p>
        : mode === 'newest' ? <ul aria-label="Aufgaben in der Gesamtansicht">
          {[...query.tasks].sort((a, b) => b.created_at.localeCompare(a.created_at) || a.id.localeCompare(b.id)).map(task => row(task, lists.find(list => list.id === task.list_id)!, true))}
        </ul> : <div className="space-y-5">
          {lists.map(list => {
            const tasks = query.tasks.filter(task => task.list_id === list.id)
            if (tasks.length === 0) return null
            return <section key={list.id} aria-label={`Aufgaben aus ${list.name}`} className="rounded-card border border-line bg-surface/40 px-3 pb-1">
              <div className="flex items-center justify-between gap-3 border-b border-line py-2">
              <h2 className="min-w-0"><button type="button" aria-label={`Liste ${list.name} öffnen`} onClick={() => selectList(list.id)}
                className={`${focusRing} flex min-h-11 items-center gap-2 rounded-control text-body font-semibold text-ink-strong hover:text-brand-soft`}>
                <ListIcon icon={list.icon} className="h-4 w-4 shrink-0 text-brand-soft" /><span className="break-words">{list.name}</span></button></h2>
              <span className={`text-meta text-ink-muted ${numeric}`}>{tasks.length}</span>
              </div>
              {groupTasks(tasks, list.sections).filter(group => group.tasks.length > 0).map(group => <div key={group.id}>
                {list.sections.length ? <h3 className="mt-3 break-words text-meta font-medium text-ink-muted">{group.section?.name ?? 'Ohne Bereich'}</h3> : null}
                <ul>{group.tasks.map(task => row(task, list, false))}</ul>
              </div>)}
            </section>
          })}
        </div>}
    </div>
  </section>
}
