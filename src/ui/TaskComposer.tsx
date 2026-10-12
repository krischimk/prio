import { useState } from 'react'
import { useTaskForm } from './useTaskForm'
import { TaskFields } from './TaskFields'
import { TaskFormStatus } from './TaskFormStatus'
import { cardSoft, input } from './styles'
import { Button } from './components/Button'
import { useView } from './useView'

/**
 * Eingabezeile für neue Aufgaben.
 *
 * Standardfall: Titel eintippen, Enter. Beschreibung und Fälligkeit sind
 * optional und klappen auf Wunsch auf – so bleibt die Bedienung auf dem Handy
 * einfach. Die Felder selbst kommen aus `TaskFields`, der Zustand aus
 * `useTaskForm` – dieselben wie in der Detailansicht und der Aufgabenzeile.
 */
export function TaskComposer({ listId }: { listId?: string }) {
  const { overview } = useView()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const available = overview.lists
  const candidate = selectedId ?? overview.userPreference?.default_list_id ?? ''
  const targetId = listId ?? (available.some(list => list.id === candidate) ? candidate : '')
  const target = available.find(list => list.id === targetId)
  const excluded = listId === undefined && target && !overview.preferences.some(row => row.list_id === target.id && row.include_in_overview)
  const [detailsOpen, setDetailsOpen] = useState(false)

  const form = useTaskForm({
    task: null,
    listId: targetId,
    onSaved: () => {
      form.zuruecksetzen()
      setDetailsOpen(false)
      setSelectedId(null)
    },
  })

  return (
    <form onSubmit={event => { if (targetId) void form.speichern(event); else event.preventDefault() }} className="space-y-3 rounded-card border border-line bg-surface p-4" aria-label="Neue Aufgabe anlegen">
      {listId === undefined ? <label className="block space-y-1 text-meta text-ink-muted">
        <span className="block">Zielliste</span>
        <select aria-label="Zielliste" value={targetId} disabled={form.busy} className={input} onChange={event => setSelectedId(event.target.value)}>
          <option value="">Bitte auswählen</option>
          {available.map(list => <option key={list.id} value={list.id}>{list.name}</option>)}
        </select>
      </label> : null}
      {excluded ? <p role="status" className="text-meta text-ink-muted">Die Aufgabe wird in „{target.name}“ gespeichert. Diese Liste ist nicht in deiner Gesamtansicht enthalten.</p> : null}
      <div className="flex gap-2">
        <label htmlFor="new-task-title" className="sr-only">
          Neue Aufgabe
        </label>
        <input
          id="new-task-title"
          data-focus-key={`new:${targetId}`}
          disabled={form.busy || !targetId}
          value={form.werte.title}
          onChange={(event) => form.setzen('title', event.target.value)}
          placeholder="Neue Aufgabe…"
          className={`${input} min-w-0 flex-1`}
        />
        <Button
          type="submit"
          variant="primary"
          disabled={form.busy || !targetId || form.werte.title.trim().length === 0}
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
        disabled={!targetId || form.busy}
        onClick={() => setDetailsOpen((open) => !open)}
      >
        {detailsOpen ? 'Weniger Details' : 'Details hinzufügen'}
      </Button>
    </form>
  )
}
