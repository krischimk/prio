import { ListIcon } from './ListIcon'
import { useTasks } from '../app/hooks'
import type { LocalList } from '../domain/types'
import { groupTasks } from '../domain/sections'
import { useCollapsedSections } from './collapsedSections'
import { SectionHeader } from './SectionHeader'
import { TaskComposer } from './TaskComposer'
import { TaskItem } from './TaskItem'
import { emptyState, numeric } from './styles'
import { leerAufgaben } from './emptyTexts'
import { formatOpenTasks } from './taskCount'
import { Button } from './components/Button'
import { CompletedTasksSection } from './CompletedTasksSection'
import { useView } from './useView'
import { SettingsIcon } from './icons'

export function TaskPanel({ list, currentUserId }: { list: LocalList; currentUserId: string }) {
  const tasks = useTasks(list.id)
  const { setListSettingsId } = useView()
  const groups = groupTasks(tasks, list.sections)
  const { zugeklappt, umschalten } = useCollapsedSections(list.id)
  return <section className="scroll-area mx-auto flex min-h-0 w-full max-w-4xl flex-1 flex-col gap-5 overflow-y-auto p-rand" aria-label="Aufgaben">
    <header className="flex shrink-0 items-start justify-between gap-4">
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-3">
          <ListIcon icon={list.icon} className="h-7 w-7 shrink-0 text-brand-soft" />
          <h1 className="break-words text-heading font-semibold tracking-tight text-ink-strong" data-testid="list-title">{list.name}</h1>
        </div>
        <p className={`mt-2 text-meta text-ink-muted ${numeric}`}>{formatOpenTasks(tasks.length)}{list.is_shared ? ' · Geteilte Liste' : ''}</p>
      </div>
      <Button variant="secondary" data-focus-key={`settings:list:${list.id}`} onClick={() => setListSettingsId(list.id)}>
        <SettingsIcon className="h-4 w-4" />Liste verwalten
      </Button>
    </header>
    <TaskComposer listId={list.id} />
    <div className="shrink-0">
      {tasks.length === 0 ? <p className={emptyState}>{leerAufgaben('breit')}</p>
        : list.sections.length ? <div className="space-y-abschnitt" data-testid="task-list">
          {groups.map(group => <div key={group.id}>
            {group.section ? <SectionHeader name={group.section.name} anzahl={group.tasks.length}
              offen={!zugeklappt.has(group.id)} onToggle={() => umschalten(group.id)} /> : null}
            {!zugeklappt.has(group.id) ? <ul>{group.tasks.map(task => <TaskItem key={task.id} task={task} currentUserId={currentUserId} />)}</ul> : null}
          </div>)}
        </div> : <ul data-testid="task-list">{tasks.map(task => <TaskItem key={task.id} task={task} currentUserId={currentUserId} />)}</ul>}
      {list.keep_completed ? <CompletedTasksSection key={list.id} listId={list.id} /> : null}
    </div>
  </section>
}
