import { useState, type FormEvent } from 'react'
import { useWorkspace } from '../app/useWorkspace'
import { ListIcon } from './ListIcon'
import { ListIconPicker } from './ListIconPicker'
import { useTasks } from '../app/hooks'
import { useBackLayer } from '../app/useBackLayer'
import type { LocalList } from '../domain/types'
import { SharePanel } from './SharePanel'
import { TaskComposer } from './TaskComposer'
import { TaskItem } from './TaskItem'
import { dangerButton, ghostButton, input, primaryButton, secondaryButton } from './styles'

/**
 * Hauptbereich: Aufgaben der ausgewählten Liste.
 *
 * Alle Aktionen schreiben zuerst lokal und wirken sofort. Der Sync läuft
 * danach im Hintergrund (siehe `WorkspaceProvider`).
 */
export function TaskPanel({ list, currentUserId }: { list: LocalList; currentUserId: string }) {
  const { repositories } = useWorkspace()
  const tasks = useTasks(list.id)
  const [renaming, setRenaming] = useState(false)
  const [name, setName] = useState(list.name)
  const [shareOpen, setShareOpen] = useState(false)
  const [iconOpen, setIconOpen] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  // Die Zurück-Taste schließt zuerst das, was zuletzt geöffnet wurde.
  useBackLayer(renaming, () => setRenaming(false))
  useBackLayer(shareOpen, () => setShareOpen(false))
  useBackLayer(confirmingDelete, () => setConfirmingDelete(false))

  const openTasks = tasks.filter((task) => !task.completed).length

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
    <section className="flex min-h-0 flex-1 flex-col gap-4 p-4 md:p-6" aria-label="Aufgaben">
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
            <button type="submit" className={primaryButton}>
              Speichern
            </button>
            <button type="button" className={secondaryButton} onClick={() => setRenaming(false)}>
              Abbrechen
            </button>
          </form>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <ListIcon icon={list.icon} className="h-6 w-6 shrink-0 text-neutral-300" />
              <h1 className="truncate text-xl font-semibold text-neutral-50" data-testid="list-title">
                {list.name}
              </h1>
              {list.is_shared ? (
                <span className="rounded-full border border-indigo-800 bg-indigo-950/60 px-2 py-0.5 text-xs text-indigo-300">
                  geteilt
                </span>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-1">
              <button type="button" className={`${ghostButton} px-2 py-1 text-xs`} onClick={startRenaming}>
                Umbenennen
              </button>
              <button
                type="button"
                className={`${ghostButton} px-2 py-1 text-xs`}
                onClick={() => setIconOpen((offen) => !offen)}
              >
                Symbol
              </button>
              <button
                type="button"
                className={`${ghostButton} px-2 py-1 text-xs`}
                aria-expanded={shareOpen}
                onClick={() => setShareOpen((open) => !open)}
              >
                Teilen
              </button>
              {confirmingDelete ? (
                <>
                  <button
                    type="button"
                    className={`${dangerButton} px-2 py-1 text-xs`}
                    onClick={() => {
                      void repositories.deleteList(list.id)
                    }}
                  >
                    Wirklich löschen
                  </button>
                  <button
                    type="button"
                    className={`${ghostButton} px-2 py-1 text-xs`}
                    onClick={() => setConfirmingDelete(false)}
                  >
                    Abbrechen
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className={`${dangerButton} px-2 py-1 text-xs`}
                  onClick={() => setConfirmingDelete(true)}
                >
                  Liste löschen
                </button>
              )}
            </div>
          </div>
        )}

        {iconOpen ? <ListIconPicker list={list} /> : null}
        {shareOpen ? <SharePanel list={list} currentUserId={currentUserId} /> : null}
      </header>

      <TaskComposer listId={list.id} />

      <div className="min-h-0 flex-1">
        <div className="mb-2 flex items-center justify-between text-xs text-neutral-500">
          <span>{openTasks === 1 ? '1 offene Aufgabe' : `${openTasks} offene Aufgaben`}</span>
          <span>{tasks.length} gesamt</span>
        </div>
        {tasks.length === 0 ? (
          <p className="rounded-lg border border-dashed border-neutral-800 px-3 py-6 text-center text-sm text-neutral-500">
            Noch keine Aufgaben in dieser Liste.
          </p>
        ) : (
          <ul className="space-y-2" data-testid="task-list">
            {tasks.map((task) => (
              <TaskItem key={task.id} task={task} />
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
