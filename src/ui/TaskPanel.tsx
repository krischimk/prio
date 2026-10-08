import { useState, type FormEvent } from 'react'
import { useWorkspace } from '../app/useWorkspace'
import { ListIcon } from './ListIcon'
import { ListIconPicker } from './ListIconPicker'
import { useTasks } from '../app/hooks'
import { useBackLayer } from '../app/useBackLayer'
import type { LocalList, LocalTask } from '../domain/types'
import { groupTasks } from '../domain/sections'
import { useCollapsedSections } from './collapsedSections'
import { SectionHeader } from './SectionHeader'
import { SectionsPanel } from './SectionsPanel'
import { SharePanel } from './SharePanel'
import { MoveTaskSheet } from './MoveTaskSheet'
import { TaskComposer } from './TaskComposer'
import { TaskItem } from './TaskItem'
import { card, emptyState, input, numeric } from './styles'
import { leerAufgaben } from './emptyTexts'
import { formatOpenTasks } from './taskCount'
import { Button } from './components/Button'

/**
 * Hauptbereich: Aufgaben der ausgewählten Liste.
 *
 * Alle Aktionen schreiben zuerst lokal und wirken sofort. Der Sync läuft
 * danach im Hintergrund (siehe `WorkspaceProvider`).
 */
export function TaskPanel({
  list,
  currentUserId,
  lists,
}: {
  list: LocalList
  currentUserId: string
  /**
   * Alle Listen – für die Auswahl beim Verschieben einer Aufgabe. Auf dem
   * Telefon steht dieselbe Aktion in der Detailansicht.
   */
  lists: LocalList[]
}) {
  const { repositories } = useWorkspace()
  const tasks = useTasks(list.id)
  const [renaming, setRenaming] = useState(false)
  const [name, setName] = useState(list.name)
  const [shareOpen, setShareOpen] = useState(false)
  const [iconOpen, setIconOpen] = useState(false)
  const [sectionsOpen, setSectionsOpen] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  /** `null` = geschlossen, sonst die Aufgabe, die verschoben werden soll. */
  const [movingTask, setMovingTask] = useState<LocalTask | null>(null)

  // Die Zurück-Taste schließt zuerst das, was zuletzt geöffnet wurde.
  useBackLayer(renaming, () => setRenaming(false), 'liste-umbenennen')
  useBackLayer(shareOpen, () => setShareOpen(false), 'liste-teilen')
  useBackLayer(sectionsOpen, () => setSectionsOpen(false), 'liste-bereiche')
  useBackLayer(confirmingDelete, () => setConfirmingDelete(false), 'liste-loeschen')

  // Ohne zweite Liste gibt es nichts zu verschieben – dann entfällt der Knopf.
  const kannVerschieben = lists.some((eintrag) => eintrag.id !== list.id)
  const openTasks = tasks.filter((task) => !task.completed).length
  const gruppen = groupTasks(tasks, list.sections)
  const { zugeklappt, umschalten } = useCollapsedSections(list.id)
  // Ohne Bereiche bleibt die Liste flach: Ein Kopf „OHNE BEREICH" über allen
  // Aufgaben wäre nur Lärm.
  const mitBereichen = list.sections.length > 0

  const startRenaming = () => {
    setName(list.name)
    setRenaming(true)
  }

  const saveName = async (event: FormEvent) => {
    event.preventDefault()
    await repositories.renameList(list.id, name)
    setRenaming(false)
  }

  return (
    <section
      className="mx-auto flex min-h-0 w-full max-w-2xl flex-1 flex-col gap-4 p-rand"
      aria-label="Aufgaben"
    >
      <header className="space-y-3">
        {renaming ? (
          <form onSubmit={saveName} className="flex flex-wrap gap-2" aria-label="Liste umbenennen">
            <label htmlFor="rename-list" className="sr-only">
              Neuer Listenname
            </label>
            <input
              id="rename-list"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              className={`${input} flex-1 min-w-48`}
            />
            <Button type="submit" variant="primary">
              Speichern
            </Button>
            <Button variant="secondary" onClick={() => setRenaming(false)}>
              Abbrechen
            </Button>
          </form>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <ListIcon icon={list.icon} className="h-6 w-6 shrink-0 text-ink-soft" />
              <h1
              className="truncate text-heading font-semibold text-ink-strong"
              title={list.name}
              data-testid="list-title">
                {list.name}
              </h1>
              {list.is_shared ? (
                <span className="rounded-full border border-brand-line bg-brand-tint/60 px-2 py-0.5 text-meta text-brand-ink">
                  geteilt
                </span>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-1">
              <Button variant="ghost" size="sm" onClick={startRenaming}>
                Umbenennen
              </Button>
              <Button
                variant="ghost" size="sm"
                onClick={() => setIconOpen((offen) => !offen)}
              >
                Symbol
              </Button>
              <Button
                variant="ghost" size="sm"
                aria-expanded={sectionsOpen}
                onClick={() => setSectionsOpen((offen) => !offen)}
              >
                Bereiche
              </Button>
              <Button
                variant="ghost" size="sm"
                aria-expanded={shareOpen}
                onClick={() => setShareOpen((open) => !open)}
              >
                Teilen
              </Button>
              {confirmingDelete ? (
                <>
                  <Button
                    variant="danger" size="sm"
                    onClick={() => {
                      void repositories.deleteList(list.id)
                    }}
                  >
                    Wirklich löschen
                  </Button>
                  <Button
                    variant="ghost" size="sm"
                    onClick={() => setConfirmingDelete(false)}
                  >
                    Abbrechen
                  </Button>
                </>
              ) : (
                <Button
                  variant="danger" size="sm"
                  onClick={() => setConfirmingDelete(true)}
                >
                  Liste löschen
                </Button>
              )}
            </div>
          </div>
        )}

        {iconOpen ? <ListIconPicker list={list} /> : null}
        {sectionsOpen ? (
          <div className={card}>
            <SectionsPanel list={list} />
          </div>
        ) : null}
        {shareOpen ? <SharePanel list={list} currentUserId={currentUserId} /> : null}
      </header>

      <TaskComposer listId={list.id} />

      <div className="min-h-0 flex-1">
        <div className={`mb-2 text-meta text-ink-faint ${numeric}`}>
          <span>{formatOpenTasks(openTasks)}</span>
        </div>
        {tasks.length === 0 ? (
          <p className={emptyState}>
            {leerAufgaben('breit')}
          </p>
        ) : mitBereichen ? (
          <div className="space-y-abschnitt" data-testid="task-list">
            {gruppen.map((gruppe) => (
              <div key={gruppe.id}>
                {/* Aufgaben ohne Bereich stehen oben, aber ohne Überschrift:
                    Ein Kopf „Ohne Bereich" wäre nur Lärm. Zuklappen lässt sich
                    eine Gruppe ohne Kopf auch nicht. */}
                {gruppe.section === null ? null : (
                  <SectionHeader
                    name={gruppe.section.name}
                    anzahl={gruppe.tasks.length}
                    offen={!zugeklappt.has(gruppe.id)}
                    onToggle={() => umschalten(gruppe.id)}
                  />
                )}
                {zugeklappt.has(gruppe.id) ? null : (
                  <ul className="space-y-zeile">
                    {gruppe.tasks.map((task) => (
                      <TaskItem
                        key={task.id}
                        task={task}
                        listIsShared={list.is_shared}
                        currentUserId={currentUserId}
                        sections={list.sections}
                        onRequestMove={kannVerschieben ? setMovingTask : undefined}
                      />
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        ) : (
          <ul className="space-y-zeile" data-testid="task-list">
            {tasks.map((task) => (
              <TaskItem
                key={task.id}
                task={task}
                listIsShared={list.is_shared}
                currentUserId={currentUserId}
                sections={list.sections}
                onRequestMove={kannVerschieben ? setMovingTask : undefined}
              />
            ))}
          </ul>
        )}
      </div>
      {movingTask !== null ? (
        <MoveTaskSheet task={movingTask} lists={lists} onClose={() => setMovingTask(null)} />
      ) : null}
    </section>
  )
}
