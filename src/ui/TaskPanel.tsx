import { ListIcon } from './ListIcon'
import { useTasksQuery } from '../app/hooks'
import { useIsDesktop } from '../app/useIsDesktop'
import type { LocalList } from '../domain/types'
import { TaskComposer } from './TaskComposer'
import { TaskList } from './TaskList'
import { errorBox, numeric } from './styles'
import { formatOpenTasks } from './taskCount'
import { Button } from './components/Button'
import { useView } from './useView'
import { SettingsIcon } from './icons'

export function TaskPanel({ list, currentUserId }: { list: LocalList; currentUserId: string }) {
  const query = useTasksQuery([list.id])
  const desktop = useIsDesktop()
  const { setListSettingsId } = useView()
  return <section className="mx-auto flex min-h-0 w-full max-w-4xl flex-1 flex-col gap-5 p-rand" aria-label="Aufgaben">
    <header className="flex shrink-0 items-start justify-between gap-4">
      <div className="min-w-0">
        {desktop ? <div className="flex min-w-0 items-center gap-3">
          <ListIcon icon={list.icon} className="h-7 w-7 shrink-0 text-brand-soft" />
          <h1 className="break-words text-heading font-semibold tracking-tight text-ink-strong" data-testid="list-title">{list.name}</h1>
        </div> : null}
        <p className={`${desktop ? 'mt-2' : ''} text-meta text-ink-muted ${numeric}`}>{formatOpenTasks(query.tasks.length)}{list.is_shared ? ' · Geteilte Liste' : ''}</p>
      </div>
      {desktop ? <Button variant="secondary" data-focus-key={`settings:list:${list.id}`} onClick={() => setListSettingsId(list.id)}>
        <SettingsIcon className="h-4 w-4" />Liste verwalten
      </Button> : null}
    </header>
    {desktop ? <TaskComposer listId={list.id} /> : null}
    {query.status === 'loading' ? <p role="status" className="text-body text-ink-muted">Aufgaben werden geladen …</p>
      : query.status === 'error' ? <div className="space-y-3"><p role="alert" className={errorBox}>Die Aufgaben konnten nicht geladen werden.</p>
        <Button variant="secondary" onClick={query.retry}>Erneut versuchen</Button></div>
      : <TaskList key={list.id} lists={[list]} tasks={query.tasks} currentUserId={currentUserId} />}
  </section>
}
