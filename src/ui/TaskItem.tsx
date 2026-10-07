import { useState, type FormEvent } from 'react'
import { useWorkspace } from '../app/useWorkspace'
import { useBackLayer } from '../app/useBackLayer'
import { useUndo } from './useUndo'
import type { TaskReminder } from '../domain/reminder'
import type { ListSection, LocalTask } from '../domain/types'
import { formatDueLabel, fromDateTimeLocalValue, toDateTimeLocalValue } from './datetime'
import { BellIcon, BellOffIcon, RepeatIcon } from './icons'
import { describeRecurrence } from './recurrence'
import { RecurrenceSelect } from './RecurrenceSelect'
import { ReminderList } from './ReminderList'
import { SectionSelect } from './SectionSelect'
import { TaskDescription } from './TaskDescription'
import { describeReminders } from './reminder'
import { cardSoft, dangerText, input, attentionText } from './styles'
import { Button } from './components/Button'

/**
 * Eine Aufgabe in der Liste.
 *
 * Zwei Zustände: Anzeige und Bearbeiten. Beim Wechsel in den Bearbeiten-Modus
 * wird das Formular aus der aktuellen Aufgabe befüllt – dadurch braucht es
 * keine Synchronisation zwischen Serverdaten und Formularzustand.
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
  const { offerUndo } = useUndo()
  const [editing, setEditing] = useState(false)
  // Die Zurück-Taste schließt zuerst das Bearbeitungsformular.
  useBackLayer(editing, () => setEditing(false))
  const [title, setTitle] = useState(task.title)
  const [description, setDescription] = useState(task.description ?? '')
  const [dueAt, setDueAt] = useState('')
  const [recurrence, setRecurrence] = useState('')
  const [erinnerungenEingabe, setErinnerungen] = useState<TaskReminder[]>([])
  const [bereich, setBereich] = useState<string | null>(null)

  const startEditing = () => {
    setTitle(task.title)
    setDescription(task.description ?? '')
    setDueAt(toDateTimeLocalValue(task.due_at))
    setRecurrence(task.recurrence ?? '')
    setErinnerungen(task.reminders)
    setBereich(task.section_id)
    setEditing(true)
  }

  const save = async (event: FormEvent) => {
    event.preventDefault()
    await repositories.updateTask(task.id, {
      title,
      description,
      dueAt: fromDateTimeLocalValue(dueAt),
      recurrence: recurrence === '' ? null : recurrence,
      reminders: erinnerungenEingabe,
      sectionId: bereich,
    })
    setEditing(false)
  }

  if (editing) {
    return (
      <li className="rounded-card border border-brand-line/60 bg-surface/60 p-3">
        <form onSubmit={save} className="space-y-3" aria-label={`Aufgabe bearbeiten: ${task.title}`}>
          <div>
            <label htmlFor={`title-${task.id}`} className="mb-1 block text-meta text-ink-muted">
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
            <label htmlFor={`description-${task.id}`} className="mb-1 block text-meta text-ink-muted">
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
            <label htmlFor={`due-${task.id}`} className="mb-1 block text-meta text-ink-muted">
              Fällig am (optional)
            </label>
            <input
              id={`due-${task.id}`}
              type="datetime-local"
              value={dueAt}
              onChange={(event) => {
                const neu = event.target.value
                setDueAt(neu)
                // Ohne Fälligkeit gibt es nichts fortzuschreiben.
                if (neu === '') setRecurrence('')
              }}
              className={input}
            />
          </div>
          {sections.length > 0 ? (
            <div>
              <label htmlFor={`section-${task.id}`} className="mb-1 block text-meta text-ink-muted">
                Bereich
              </label>
              <SectionSelect
                id={`section-${task.id}`}
                sections={sections}
                value={bereich}
                onChange={setBereich}
              />
            </div>
          ) : null}
          <RecurrenceSelect
            id={`recurrence-${task.id}`}
            value={recurrence}
            disabled={dueAt === ''}
            onChange={setRecurrence}
          />
          <ReminderList
            idPrefix={`task-${task.id}`}
            dueAt={fromDateTimeLocalValue(dueAt)}
            recurrence={recurrence === '' ? null : recurrence}
            reminders={erinnerungenEingabe}
            viewerId={currentUserId}
            listIsShared={listIsShared}
            onChange={setErinnerungen}
          />
          <div className="flex gap-2">
            <Button type="submit" variant="primary">
              Speichern
            </Button>
            <Button variant="secondary" onClick={() => setEditing(false)}>
              Abbrechen
            </Button>
          </div>
        </form>
      </li>
    )
  }

  const due = task.due_at === null ? null : formatDueLabel(task.due_at, task.completed)
  const wiederholung = describeRecurrence(task.recurrence)
  const erinnerungen = describeReminders(task, currentUserId)

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
        <p className={`break-words text-body ${task.completed ? 'text-ink-faint line-through' : 'text-ink'}`}>
          {task.title}
        </p>
        {task.description ? (
          <TaskDescription text={task.description} className="mt-1" />
        ) : null}
        {due ? (
          <p className={`mt-1 text-meta ${due.overdue ? dangerText : 'text-ink-faint'}`}>{due.text}</p>
        ) : null}
        {wiederholung ? (
          <p className="mt-1 flex items-center gap-1 text-meta text-ink-faint">
            <RepeatIcon className="h-3 w-3 shrink-0" />
            {wiederholung}
          </p>
        ) : null}
        {erinnerungen.map((erinnerung, index) => (
          <p
            key={index}
            className={`mt-1 flex items-center gap-1 text-meta ${
              erinnerung.afterDue && !erinnerung.muted ? attentionText : 'text-ink-faint'
            }`}
          >
            {erinnerung.muted ? <BellOffIcon className="h-3 w-3 shrink-0" /> : <BellIcon className="h-3 w-3 shrink-0" />}
            {erinnerung.text}
          </p>
        ))}
      </div>
      <div className="flex shrink-0 gap-1">
        {onRequestMove ? (
          <Button
           
            variant="ghost" size="sm"
            aria-label={`Aufgabe verschieben: ${task.title}`}
            onClick={() => onRequestMove(task)}
          >
            Verschieben
          </Button>
        ) : null}
        <Button variant="ghost" size="sm" onClick={startEditing}>
          Bearbeiten
        </Button>
        <Button
         
          variant="danger" size="sm"
          aria-label={`Aufgabe löschen: ${task.title}`}
          onClick={() => {
            void repositories.deleteTask(task.id)
          }}
        >
          Löschen
        </Button>
      </div>
    </li>
  )
}
