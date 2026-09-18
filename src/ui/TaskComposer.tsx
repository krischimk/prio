import { useState, type FormEvent } from 'react'
import { useWorkspace } from '../app/useWorkspace'
import { fromDateTimeLocalValue } from './datetime'
import { input, primaryButton, secondaryButton } from './styles'

/**
 * Eingabezeile für neue Aufgaben.
 *
 * Standardfall: Titel eintippen, Enter. Beschreibung und Fälligkeit sind
 * optional und klappen auf Wunsch auf – so bleibt die Bedienung auf dem
 * Handy einfach.
 */
export function TaskComposer({ listId }: { listId: string }) {
  const { repositories } = useWorkspace()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [dueAt, setDueAt] = useState('')
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const reset = () => {
    setTitle('')
    setDescription('')
    setDueAt('')
    setDetailsOpen(false)
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (busy || title.trim().length === 0) return
    setBusy(true)
    try {
      await repositories.createTask({
        listId,
        title,
        description,
        dueAt: fromDateTimeLocalValue(dueAt),
      })
      reset()
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3" aria-label="Neue Aufgabe anlegen">
      <div className="flex gap-2">
        <label htmlFor="new-task-title" className="sr-only">
          Neue Aufgabe
        </label>
        <input
          id="new-task-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Neue Aufgabe…"
          className={input}
        />
        <button type="submit" className={primaryButton} disabled={busy || title.trim().length === 0}>
          Hinzufügen
        </button>
      </div>

      {detailsOpen ? (
        <div className="space-y-3 rounded-lg border border-neutral-800 bg-neutral-900/40 p-3">
          <div>
            <label htmlFor="new-task-description" className="mb-1 block text-xs text-neutral-400">
              Beschreibung (optional)
            </label>
            <textarea
              id="new-task-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={2}
              className={input}
            />
          </div>
          <div>
            <label htmlFor="new-task-due" className="mb-1 block text-xs text-neutral-400">
              Fällig am (optional)
            </label>
            <input
              id="new-task-due"
              type="datetime-local"
              value={dueAt}
              onChange={(event) => setDueAt(event.target.value)}
              className={input}
            />
          </div>
        </div>
      ) : null}

      <button
        type="button"
        className={`${secondaryButton} text-xs`}
        aria-expanded={detailsOpen}
        onClick={() => setDetailsOpen((open) => !open)}
      >
        {detailsOpen ? 'Weniger Details' : 'Details hinzufügen'}
      </button>
    </form>
  )
}
