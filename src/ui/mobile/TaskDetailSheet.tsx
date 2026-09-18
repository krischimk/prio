import { useState, type FormEvent } from 'react'
import { useBackLayer } from '../../app/useBackLayer'
import { useWorkspace } from '../../app/useWorkspace'
import type { LocalList, LocalTask } from '../../domain/types'
import { fromDateTimeLocalValue, toDateTimeLocalValue } from '../datetime'
import { dangerButton, input, primaryButton, secondaryButton } from '../styles'
import { CloseIcon, MoveIcon, TrashIcon } from './icons'

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
  onClose,
  onRequestMove,
}: {
  /** `null` legt eine neue Aufgabe an. */
  task: LocalTask | null
  listId: string
  lists: LocalList[]
  onClose: () => void
  onRequestMove: (task: LocalTask) => void
}) {
  const { repositories } = useWorkspace()
  const isNew = task === null

  const [title, setTitle] = useState(task?.title ?? '')
  const [description, setDescription] = useState(task?.description ?? '')
  const [dueAt, setDueAt] = useState(toDateTimeLocalValue(task?.due_at ?? null))
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
        })
      } else {
        await repositories.updateTask(task.id, {
          title,
          description,
          dueAt: fromDateTimeLocalValue(dueAt),
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
    <div className="fixed inset-0 z-50 flex flex-col bg-neutral-950" role="dialog" aria-modal="true" aria-label={isNew ? 'Neue Aufgabe' : 'Aufgabe'}>
      <header className="safe-top flex h-14 shrink-0 items-center gap-1 border-b border-neutral-800 px-2">
        <button
          type="button"
          onClick={onClose}
          aria-label="Schließen"
          className="rounded-md p-2 text-neutral-400 active:bg-neutral-800"
        >
          <CloseIcon />
        </button>
        <h2 className="flex-1 truncate text-center text-base font-medium text-neutral-100">
          {isNew ? 'Neue Aufgabe' : 'Aufgabe'}
        </h2>
        <span className="w-9" aria-hidden="true" />
      </header>

      <form id="task-detail-form" onSubmit={save} className="scroll-area safe-bottom flex-1 overflow-y-auto">
        <div className="space-y-4 px-4 py-4">
          <div>
            <label htmlFor="detail-title" className="mb-1 block text-xs text-neutral-400">
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
            <label htmlFor="detail-description" className="mb-1 block text-xs text-neutral-400">
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
            <label htmlFor="detail-due" className="mb-1 block text-xs text-neutral-400">
              Fällig am (optional)
            </label>
            <input
              id="detail-due"
              type="datetime-local"
              value={dueAt}
              onChange={(event) => setDueAt(event.target.value)}
              className={input}
            />
          </div>

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

        <div className="space-y-2 border-t border-neutral-800 px-4 py-4">
          <button
            type="submit"
            form="task-detail-form"
            className={`${primaryButton} w-full py-3`}
            disabled={busy || title.trim().length === 0}
          >
            Speichern
          </button>

          {canMove ? (
            <button
              type="button"
              className={`${secondaryButton} flex w-full items-center justify-center gap-2 py-3`}
              onClick={() => {
                if (task !== null) onRequestMove(task)
              }}
            >
              <MoveIcon className="h-4 w-4" />
              In andere Liste verschieben
            </button>
          ) : null}

          {!isNew ? (
            confirmingDelete ? (
              <div className="flex gap-2">
                <button
                  type="button"
                  className={`${dangerButton} flex-1 py-3`}
                  onClick={() => {
                    void remove()
                  }}
                  disabled={busy}
                >
                  Wirklich löschen
                </button>
                <button
                  type="button"
                  className={`${secondaryButton} flex-1 py-3`}
                  onClick={() => setConfirmingDelete(false)}
                >
                  Abbrechen
                </button>
              </div>
            ) : (
              <button
                type="button"
                className={`${dangerButton} flex w-full items-center justify-center gap-2 py-3`}
                onClick={() => setConfirmingDelete(true)}
              >
                <TrashIcon className="h-4 w-4" />
                Aufgabe löschen
              </button>
            )
          ) : null}
        </div>
      </form>
    </div>
  )
}
