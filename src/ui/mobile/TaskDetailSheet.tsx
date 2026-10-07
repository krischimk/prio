import { useState, type FormEvent } from 'react'
import { useBackLayer } from '../../app/useBackLayer'
import { useWorkspace } from '../../app/useWorkspace'
import type { TaskReminder } from '../../domain/reminder'
import type { ListSection, LocalList, LocalTask } from '../../domain/types'
import { fromDateTimeLocalValue, toDateTimeLocalValue } from '../datetime'
import { RecurrenceSelect } from '../RecurrenceSelect'
import { SectionSelect } from '../SectionSelect'
import { ReminderList } from '../ReminderList'
import { iconButton, buttonClass, appBackground, dangerButton, input, secondaryButton } from '../styles'
import { CloseIcon, MoveIcon, TrashIcon } from '../icons'

/**
 * Detail- und Bearbeitungsansicht einer Aufgabe.
 *
 * Auf dem Telefon ist das der Ort für alles, was in der Liste keinen Platz hat:
 * Beschreibung, Fälligkeit, Erledigt-Status, Verschieben und Löschen.
 * Dieselbe Ansicht legt auch neue Aufgaben an (`task === null`).
 */
export function TaskDetailSheet({
  task,
  listId,
  lists,
  sections,
  currentUserId,
  onClose,
  onRequestMove,
}: {
  /** `null` legt eine neue Aufgabe an. */
  task: LocalTask | null
  listId: string
  lists: LocalList[]
  sections: ListSection[]
  currentUserId: string
  onClose: () => void
  onRequestMove: (task: LocalTask) => void
}) {
  const { repositories } = useWorkspace()
  const isNew = task === null

  const [title, setTitle] = useState(task?.title ?? '')
  const [description, setDescription] = useState(task?.description ?? '')
  const [dueAt, setDueAt] = useState(toDateTimeLocalValue(task?.due_at ?? null))
  const [recurrence, setRecurrence] = useState(task?.recurrence ?? '')
  const [erinnerungen, setErinnerungen] = useState<TaskReminder[]>(task?.reminders ?? [])
  const [bereich, setBereich] = useState<string | null>(task?.section_id ?? null)
  // Eigener Zustand statt `task.completed`: Die übergebene Aufgabe ist eine
  // Momentaufnahme und würde nach dem Umschalten nicht nachziehen.
  const [completed, setCompleted] = useState(task?.completed ?? false)
  const [busy, setBusy] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  useBackLayer(true, onClose)

  const save = async (event: FormEvent) => {
    event.preventDefault()
    if (busy || title.trim().length === 0) return
    setBusy(true)
    try {
      if (task === null) {
        await repositories.createTask({
          listId,
          title,
          description,
          dueAt: fromDateTimeLocalValue(dueAt),
          recurrence: recurrence === '' ? null : recurrence,
          reminders: erinnerungen,
          sectionId: bereich,
        })
      } else {
        await repositories.updateTask(task.id, {
          title,
          description,
          dueAt: fromDateTimeLocalValue(dueAt),
          recurrence: recurrence === '' ? null : recurrence,
          reminders: erinnerungen,
          sectionId: bereich,
        })
      }
      onClose()
    } finally {
      setBusy(false)
    }
  }

  const toggleCompleted = async () => {
    if (task === null || busy) return
    const next = !completed
    setBusy(true)
    try {
      await repositories.setTaskCompleted(task.id, next)
      setCompleted(next)
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (task === null || busy) return
    setBusy(true)
    try {
      await repositories.deleteTask(task.id)
      onClose()
    } finally {
      setBusy(false)
    }
  }

  const canMove = !isNew && lists.length > 1

  return (
    <div className={`fixed inset-0 z-50 flex flex-col ${appBackground}`} role="dialog" aria-modal="true" aria-label={isNew ? 'Neue Aufgabe' : 'Aufgabe'}>
      {/*
        Die Kopfleiste trägt alles, was die Aufgabe abschließt: schließen,
        speichern, löschen. Vorher stand „Speichern" ganz unten – nach einer
        langen Beschreibung weit weg vom Blick. Hier oben ist es klein, aber
        immer erreichbar; das Löschen fragt weiterhin nach.
      */}
      <header className="safe-top flex min-h-16 shrink-0 items-center gap-2 border-b border-line px-2 py-1">
        <button
          type="button"
          onClick={onClose}
          aria-label="Schließen"
          className={iconButton}
        >
          <CloseIcon />
        </button>
        <h2 className="min-w-0 flex-1 truncate text-title font-medium text-ink">
          {isNew ? 'Neue Aufgabe' : 'Aufgabe'}
        </h2>

        {confirmingDelete ? (
          <>
            <button
              type="button"
              className={buttonClass('danger', 'sm')}
              onClick={() => {
                void remove()
              }}
              disabled={busy}
            >
              Wirklich löschen
            </button>
            <button
              type="button"
              className={buttonClass('secondary', 'sm')}
              onClick={() => setConfirmingDelete(false)}
            >
              Abbrechen
            </button>
          </>
        ) : (
          <>
            {isNew ? null : (
              <button
                type="button"
                aria-label="Aufgabe löschen"
                className={dangerButton}
                onClick={() => setConfirmingDelete(true)}
              >
                <TrashIcon className="h-4 w-4" />
              </button>
            )}
            <button
              type="submit"
              form="task-detail-form"
              className={buttonClass('primary', 'sm')}
              disabled={busy || title.trim().length === 0}
            >
              Speichern
            </button>
          </>
        )}
      </header>

      <form id="task-detail-form" onSubmit={save} className="scroll-area safe-bottom flex-1 overflow-y-auto">
        <div className="space-y-4 px-4 py-4">
          <div>
            <label htmlFor="detail-title" className="mb-1 block text-meta text-ink-muted">
              Titel
            </label>
            <input
              id="detail-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              // Beim Anlegen ist das Feld sofort aktiv – der Nutzer hat gerade
              // auf "+" getippt und will schreiben.
              autoFocus={isNew}
              required
              className={input}
            />
          </div>

          <div>
            <label htmlFor="detail-description" className="mb-1 block text-meta text-ink-muted">
              Beschreibung (optional)
            </label>
            <textarea
              id="detail-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={4}
              className={input}
            />
          </div>

          <div>
            <label htmlFor="detail-due" className="mb-1 block text-meta text-ink-muted">
              Fällig am (optional)
            </label>
            <input
              id="detail-due"
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
              <label htmlFor="detail-section" className="mb-1 block text-meta text-ink-muted">
                Bereich
              </label>
              <SectionSelect
                id="detail-section"
                sections={sections}
                value={bereich}
                onChange={setBereich}
              />
            </div>
          ) : null}

          <RecurrenceSelect
            id="detail-recurrence"
            value={recurrence}
            disabled={dueAt === ''}
            onChange={setRecurrence}
          />

          <ReminderList
            idPrefix="detail"
            dueAt={fromDateTimeLocalValue(dueAt)}
            recurrence={recurrence === '' ? null : recurrence}
            reminders={erinnerungen}
            viewerId={currentUserId}
            listIsShared={lists.find((eintrag) => eintrag.id === listId)?.is_shared ?? false}
            onChange={setErinnerungen}
          />

          {task !== null ? (
            <button
              type="button"
              onClick={() => {
                void toggleCompleted()
              }}
              disabled={busy}
              className={`${secondaryButton} w-full`}
            >
              {completed ? 'Als offen markieren' : 'Als erledigt markieren'}
            </button>
          ) : null}
        </div>

        {canMove ? (
          <div className="space-y-2 border-t border-line px-4 py-4">
            <button
              type="button"
              className={buttonClass('secondary', 'block', 'w-full')}
              onClick={() => {
                if (task !== null) onRequestMove(task)
              }}
            >
              <MoveIcon className="h-4 w-4" />
              In andere Liste verschieben
            </button>
          </div>
        ) : null}
      </form>
    </div>
  )
}
