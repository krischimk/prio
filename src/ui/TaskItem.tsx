import { useState, type FormEvent } from 'react'
import { useWorkspace } from '../app/useWorkspace'
import { useBackLayer } from '../app/useBackLayer'
import type { LocalTask } from '../domain/types'
import { formatDateTime, fromDateTimeLocalValue, isOverdue, toDateTimeLocalValue } from './datetime'
import { dangerButton, ghostButton, input, primaryButton, secondaryButton } from './styles'

/**
 * Eine Aufgabe in der Liste.
 *
 * Zwei Zustände: Anzeige und Bearbeiten. Beim Wechsel in den Bearbeiten-Modus
 * wird das Formular aus der aktuellen Aufgabe befüllt – dadurch braucht es
 * keine Synchronisation zwischen Serverdaten und Formularzustand.
 */
export function TaskItem({ task }: { task: LocalTask }) {
  const { repositories } = useWorkspace()
  const [editing, setEditing] = useState(false)
  // Die Zurück-Taste schließt zuerst das Bearbeitungsformular.
  useBackLayer(editing, () => setEditing(false))
  const [title, setTitle] = useState(task.title)
  const [description, setDescription] = useState(task.description ?? '')
  const [dueAt, setDueAt] = useState('')

  const startEditing = () => {
    setTitle(task.title)
    setDescription(task.description ?? '')
    setDueAt(toDateTimeLocalValue(task.due_at))
    setEditing(true)
  }

  const save = async (event: FormEvent) => {
    event.preventDefault()
    await repositories.updateTask(task.id, {
      title,
      description,
      dueAt: fromDateTimeLocalValue(dueAt),
    })
    setEditing(false)
  }

  if (editing) {
    return (
      <li className="rounded-lg border border-indigo-900/60 bg-neutral-900/60 p-3">
        <form onSubmit={save} className="space-y-3" aria-label={`Aufgabe bearbeiten: ${task.title}`}>
          <div>
            <label htmlFor={`title-${task.id}`} className="mb-1 block text-xs text-neutral-400">
              Titel
            </label>
            <input
              id={`title-${task.id}`}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
              className={input}
            />
          </div>
          <div>
            <label htmlFor={`description-${task.id}`} className="mb-1 block text-xs text-neutral-400">
              Beschreibung (optional)
            </label>
            <textarea
              id={`description-${task.id}`}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={2}
              className={input}
            />
          </div>
          <div>
            <label htmlFor={`due-${task.id}`} className="mb-1 block text-xs text-neutral-400">
              Fällig am (optional)
            </label>
            <input
              id={`due-${task.id}`}
              type="datetime-local"
              value={dueAt}
              onChange={(event) => setDueAt(event.target.value)}
              className={input}
            />
          </div>
          <div className="flex gap-2">
            <button type="submit" className={primaryButton}>
              Speichern
            </button>
            <button type="button" className={secondaryButton} onClick={() => setEditing(false)}>
              Abbrechen
            </button>
          </div>
        </form>
      </li>
    )
  }

  const overdue = task.due_at !== null && !task.completed && isOverdue(task.due_at)

  return (
    <li className="flex items-start gap-3 rounded-lg border border-neutral-800 bg-neutral-900/40 p-3">
      <input
        type="checkbox"
        className="mt-1 h-4 w-4 shrink-0 accent-indigo-500"
        checked={task.completed}
        aria-label={`Aufgabe erledigen: ${task.title}`}
        onChange={(event) => {
          void repositories.setTaskCompleted(task.id, event.target.checked)
        }}
      />
      <div className="min-w-0 flex-1">
        <p className={`break-words text-sm ${task.completed ? 'text-neutral-500 line-through' : 'text-neutral-100'}`}>
          {task.title}
        </p>
        {task.description ? (
          <p className="mt-1 whitespace-pre-wrap break-words text-xs text-neutral-400">{task.description}</p>
        ) : null}
        {task.due_at ? (
          <p className={`mt-1 text-xs ${overdue ? 'text-red-400' : 'text-neutral-500'}`}>
            Fällig: {formatDateTime(task.due_at)}
            {overdue ? ' (überfällig)' : ''}
          </p>
        ) : null}
      </div>
      <div className="flex shrink-0 gap-1">
        <button type="button" className={`${ghostButton} px-2 py-1 text-xs`} onClick={startEditing}>
          Bearbeiten
        </button>
        <button
          type="button"
          className={`${dangerButton} px-2 py-1 text-xs`}
          aria-label={`Aufgabe löschen: ${task.title}`}
          onClick={() => {
            void repositories.deleteTask(task.id)
          }}
        >
          Löschen
        </button>
      </div>
    </li>
  )
}
