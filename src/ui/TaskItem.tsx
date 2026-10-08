import { useState } from 'react'
import { useWorkspace } from '../app/useWorkspace'
import { useBackLayer } from '../app/useBackLayer'
import { useUndo } from './useUndo'
import type { ListSection, LocalTask } from '../domain/types'
import { TaskDescription } from './TaskDescription'
import { TaskFacts } from './TaskFacts'
import { TaskFields } from './TaskFields'
import { Button } from './components/Button'
import { cardSoft } from './styles'
import { useTaskForm } from './useTaskForm'

/**
 * Eine Aufgabe in der Liste (breite Ansicht).
 *
 * Zwei Zustände: Anzeige und Bearbeiten. Der Inhalt der Anzeige kommt aus
 * `TaskFacts` – dieselben Zeilen zeigt auch die mobile Liste, nur in flacher
 * Form. Das Bearbeiten-Formular ist ein eigener Baustein (`TaskBearbeiten`),
 * damit seine Felder erst beim Öffnen aus der Aufgabe befüllt werden.
 */
export function TaskItem({
  task,
  listIsShared,
  currentUserId,
  sections,
  onRequestMove,
}: {
  task: LocalTask
  listIsShared: boolean
  currentUserId: string
  /** Die Bereiche der Liste – leer heißt: keine Auswahl nötig. */
  sections: ListSection[]
  /**
   * Öffnet die Auswahl der Ziel-Liste. Fehlt der Rückruf, gibt es nichts zu
   * verschieben – dann fehlt auch der Knopf. Auf dem Telefon sitzt dieselbe
   * Aktion in der Detailansicht (`TaskDetailSheet`).
   */
  onRequestMove?: (task: LocalTask) => void
}) {
  const { repositories } = useWorkspace()
  const { offerUndo, offer } = useUndo()
  const [editing, setEditing] = useState(false)
  // Die Zurück-Taste schließt zuerst das Bearbeitungsformular.
  useBackLayer(editing, () => setEditing(false), 'aufgabe-bearbeiten')

  if (editing) {
    return (
      <li className="rounded-card border border-brand-line/60 bg-surface/60 p-3">
        <TaskBearbeiten
          task={task}
          sections={sections}
          currentUserId={currentUserId}
          listIsShared={listIsShared}
          onDone={() => setEditing(false)}
        />
      </li>
    )
  }

  return (
    <li className={`${cardSoft} flex items-start gap-3`}>
      <input
        type="checkbox"
        className="mt-1 h-4 w-4 shrink-0 accent-brand"
        checked={task.completed}
        aria-label={`Aufgabe erledigen: ${task.title}`}
        onChange={(event) => {
          void repositories.setTaskCompleted(task.id, event.target.checked)
          // Die Aufgabe verschwindet sofort – die Leiste bietet den Rückweg an.
          if (event.target.checked) offerUndo(task)
        }}
      />
      <div className="min-w-0 flex-1">
        <TaskFacts task={task} currentUserId={currentUserId} />
        {task.description ? <TaskDescription text={task.description} className="mt-1" /> : null}
      </div>
      <div className="flex shrink-0 gap-1">
        {onRequestMove ? (
          <Button
            variant="ghost"
            size="sm"
            aria-label={`Aufgabe verschieben: ${task.title}`}
            onClick={() => onRequestMove(task)}
          >
            Verschieben
          </Button>
        ) : null}
        <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
          Bearbeiten
        </Button>
        <Button
          variant="danger"
          size="sm"
          aria-label={`Aufgabe löschen: ${task.title}`}
          onClick={() => {
            const id = task.id
            const titel = task.title
            void repositories.deleteTask(id).then(() =>
              offer({
                taskId: id,
                text: `„${titel}“`,
                art: 'geloescht',
                rueckgaengig: async () => {
                  await repositories.restoreTask(id)
                },
              }),
            )
          }}
        >
          Löschen
        </Button>
      </div>
    </li>
  )
}

/**
 * Das Bearbeitungsformular.
 *
 * Eigener Baustein, damit es beim Öffnen frisch aus der Aufgabe befüllt wird:
 * `useTaskForm` liest die Werte beim ersten Rendern. Dauerhaft eingebunden
 * zeigte es nach einem Abgleich (Pull) veraltete Werte.
 */
function TaskBearbeiten({
  task,
  sections,
  currentUserId,
  listIsShared,
  onDone,
}: {
  task: LocalTask
  sections: ListSection[]
  currentUserId: string
  listIsShared: boolean
  onDone: () => void
}) {
  const form = useTaskForm({ task, listId: task.list_id, onSaved: onDone })

  return (
    <form onSubmit={form.speichern} className="space-y-3" aria-label={`Aufgabe bearbeiten: ${task.title}`}>
      <TaskFields
        form={form}
        sections={sections}
        currentUserId={currentUserId}
        listIsShared={listIsShared}
        idPrefix={`task-${task.id}`}
      />
      <div className="flex gap-2">
        <Button type="submit" variant="primary" disabled={form.busy}>
          Speichern
        </Button>
        <Button variant="secondary" onClick={onDone}>
          Abbrechen
        </Button>
      </div>
    </form>
  )
}
