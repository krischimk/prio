import { useState } from 'react'
import { useTaskForm } from './useTaskForm'
import { TaskFields } from './TaskFields'
import { TaskFormStatus } from './TaskFormStatus'
import { cardSoft, input } from './styles'
import { Button } from './components/Button'

/**
 * Eingabezeile für neue Aufgaben.
 *
 * Standardfall: Titel eintippen, Enter. Beschreibung und Fälligkeit sind
 * optional und klappen auf Wunsch auf – so bleibt die Bedienung auf dem Handy
 * einfach. Die Felder selbst kommen aus `TaskFields`, der Zustand aus
 * `useTaskForm` – dieselben wie in der Detailansicht und der Aufgabenzeile.
 */
export function TaskComposer({ listId }: { listId: string }) {
  const [detailsOpen, setDetailsOpen] = useState(false)

  const form = useTaskForm({
    task: null,
    listId,
    onSaved: () => {
      form.zuruecksetzen()
      setDetailsOpen(false)
    },
  })

  return (
    <form onSubmit={form.speichern} className="space-y-3 rounded-card border border-line bg-surface p-4" aria-label="Neue Aufgabe anlegen">
      <div className="flex gap-2">
        <label htmlFor="new-task-title" className="sr-only">
          Neue Aufgabe
        </label>
        <input
          id="new-task-title"
          data-focus-key={`new:${listId}`}
          disabled={form.busy}
          value={form.werte.title}
          onChange={(event) => form.setzen('title', event.target.value)}
          placeholder="Neue Aufgabe…"
          className={`${input} min-w-0 flex-1`}
        />
        <Button
          type="submit"
          variant="primary"
          disabled={form.busy || form.werte.title.trim().length === 0}
        >
          Hinzufügen
        </Button>
      </div>

      {detailsOpen ? (
        <div className={`${cardSoft} space-y-3`}>
          <TaskFields
            form={form}
            felder={['beschreibung', 'faellig']}
            sections={[]}
            idPrefix="new-task"
          />
        </div>
      ) : null}

      <TaskFormStatus form={form} />

      <Button
        variant="secondary"
        size="sm"
        aria-expanded={detailsOpen}
        onClick={() => setDetailsOpen((open) => !open)}
      >
        {detailsOpen ? 'Weniger Details' : 'Details hinzufügen'}
      </Button>
    </form>
  )
}
