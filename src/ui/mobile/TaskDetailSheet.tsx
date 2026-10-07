import { useState } from 'react'
import { useWorkspace } from '../../app/useWorkspace'
import type { ListSection, LocalList, LocalTask } from '../../domain/types'
import { CloseIcon, MoveIcon, TrashIcon } from '../icons'
import { Button } from '../components/Button'
import { IconButton } from '../components/IconButton'
import { Screen } from '../components/Screen'
import { TaskFields } from '../TaskFields'
import { useTaskForm } from '../useTaskForm'

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

  // Zustand und Umwandlungen des Formulars kommen aus `useTaskForm` – dieselben
  // wie in der Eingabezeile und der Aufgabenzeile der breiten Ansicht.
  const form = useTaskForm({ task, listId, onSaved: onClose })
  const [completed, setCompleted] = useState(task?.completed ?? false)
  const [busy, setBusy] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

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

  /*
   * Die Kopfleiste trägt alles, was die Aufgabe abschließt: schließen,
   * speichern, löschen. Vorher stand „Speichern" ganz unten – nach einer
   * langen Beschreibung weit weg vom Blick. Hier oben ist es klein, aber
   * immer erreichbar; das Löschen fragt weiterhin nach.
   */
  return (
    <Screen
      name="aufgabe-detail"
      label={isNew ? 'Neue Aufgabe' : 'Aufgabe'}
      onClose={onClose}
      header={
        <header className="safe-top flex min-h-16 shrink-0 items-center gap-2 border-b border-line px-2 py-1">
          <IconButton
            onClick={onClose}
            aria-label="Schließen"
            variant="icon"
          >
            <CloseIcon />
          </IconButton>
          <h2 className="min-w-0 flex-1 truncate text-title font-medium text-ink">
            {isNew ? 'Neue Aufgabe' : 'Aufgabe'}
          </h2>

          {confirmingDelete ? (
            <>
              <Button
                variant="danger" size="sm"
                onClick={() => {
                  void remove()
                }}
                disabled={busy}
              >
                Wirklich löschen
              </Button>
              <Button
                variant="secondary" size="sm"
                onClick={() => setConfirmingDelete(false)}
              >
                Abbrechen
              </Button>
            </>
          ) : (
            <>
              {isNew ? null : (
                <Button
                  aria-label="Aufgabe löschen"
                  variant="danger"
                  onClick={() => setConfirmingDelete(true)}
                >
                  <TrashIcon className="h-4 w-4" />
                </Button>
              )}
              <Button
                type="submit"
                form="task-detail-form"
                variant="primary" size="sm"
                disabled={form.busy || form.werte.title.trim().length === 0}
              >
                Speichern
              </Button>
            </>
          )}
        </header>
      }
    >

      <form id="task-detail-form" onSubmit={form.speichern} className="scroll-area safe-bottom flex-1 overflow-y-auto">
        <div className="space-y-4 px-4 py-4">
          <TaskFields
            form={form}
            sections={sections}
            currentUserId={currentUserId}
            listIsShared={lists.find((eintrag) => eintrag.id === listId)?.is_shared ?? false}
            idPrefix="detail"
            beschreibungZeilen={4}
            titelAutofokus={isNew}
          />

          {task !== null ? (
            <Button
              onClick={() => {
                void toggleCompleted()
              }}
              disabled={busy}
              variant="secondary" layout="w-full"
            >
              {completed ? 'Als offen markieren' : 'Als erledigt markieren'}
            </Button>
          ) : null}
        </div>

        {canMove ? (
          <div className="space-y-2 border-t border-line px-4 py-4">
            <Button
              variant="secondary" size="block" layout="w-full"
              onClick={() => {
                if (task !== null) onRequestMove(task)
              }}
            >
              <MoveIcon className="h-4 w-4" />
              In andere Liste verschieben
            </Button>
          </div>
        ) : null}
      </form>
    </Screen>
  )
}
