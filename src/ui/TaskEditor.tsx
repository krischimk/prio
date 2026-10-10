import { useState } from 'react'
import { useWorkspace } from '../app/useWorkspace'
import { useUndo } from './useUndo'
import type { ListSection, LocalList, LocalTask } from '../domain/types'
import { CloseIcon, MoveIcon, TrashIcon } from './icons'
import { Button } from './components/Button'
import { IconButton } from './components/IconButton'
import { Screen } from './components/Screen'
import { Sheet } from './components/Sheet'
import { TaskFields } from './TaskFields'
import { TaskFormStatus } from './TaskFormStatus'
import { useTaskForm } from './useTaskForm'
import { errorBox } from './styles'
import { SyncIndicator } from './SyncIndicator'

/**
 * Detail- und Bearbeitungsansicht einer Aufgabe.
 *
 * Auf dem Telefon ist das der Ort für alles, was in der Liste keinen Platz hat:
 * Beschreibung, Fälligkeit, Erledigt-Status, Verschieben und Löschen.
 * Dieselbe Ansicht legt auch neue Aufgaben an (`task === null`).
 */
export function TaskEditor({
  task,
  listId,
  lists,
  sections,
  currentUserId,
  onClose,
  onRequestMove,
  onChangeTarget,
  targetHint,
  onRequestOrder,
}: {
  /** `null` legt eine neue Aufgabe an. */
  task: LocalTask | null
  listId: string
  lists: LocalList[]
  sections: ListSection[]
  currentUserId: string
  onClose: () => void
  onRequestMove: (task: LocalTask) => void
  onChangeTarget?: () => void
  targetHint?: string
  onRequestOrder: (task: LocalTask) => void
}) {
  const { repositories } = useWorkspace()
  const { offer } = useUndo()
  const isNew = task === null

  // Zustand und Umwandlungen des Formulars kommen aus `useTaskForm` – dieselben
  // wie in der Eingabezeile und der Aufgabenzeile der breiten Ansicht.
  const form = useTaskForm({ task, listId, onSaved: onClose })
  /** Rückfrage, wenn über das Kreuz geschlossen wird und etwas geändert ist. */
  const [verwerfen, setVerwerfen] = useState(false)
  const schliessen = () => {
    if (form.busy || busy) return
    // Nichts geändert: schließen. Sonst erst fragen – die Änderungen sind
    // nicht gespeichert, und das soll nicht stillschweigend passieren.
    if (form.geaendert) setVerwerfen(true)
    else onClose()
  }
  const completed = task?.completed ?? false
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const toggleCompleted = async () => {
    if (task === null || busy || form.busy) return
    const next = !completed
    setBusy(true)
    setError(null)
    try {
      await repositories.setTaskCompleted(task.id, next)
      onClose()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Der Status konnte nicht geändert werden.')
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (task === null || busy || form.busy) return
    setBusy(true)
    setError(null)
    try {
      const id = task.id
      const titel = task.title
      await repositories.deleteTask(id)
      form.zuruecksetzen()
      /*
       * Keine Rückfrage mehr, dafür ein Weg zurück: Die Leiste unten zeigt die
       * gelöschte Aufgabe und holt sie auf Wunsch zurück. Löschen ist damit so
       * leicht zu korrigieren wie das Abhaken – und der Weg zum Löschen ist
       * einen Schritt kürzer.
       */
      offer({
        taskId: id,
        text: `„${titel}“`,
        art: 'geloescht',
        rueckgaengig: async () => {
          await repositories.restoreTask(id)
        },
      })
      onClose()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Die Aufgabe konnte nicht gelöscht werden.')
    } finally {
      setBusy(false)
    }
  }

  const canMove = !isNew && lists.length > 1

  /*
   * Die Kopfleiste trägt alles, was die Aufgabe abschließt: schließen,
   * speichern, löschen. Sie bleibt erreichbar, wenn der Formularinhalt scrollt.
   */
  return <>
    <Screen
      name="aufgabe-detail"
      label={isNew ? 'Neue Aufgabe' : 'Aufgabe'}
      onClose={schliessen}
      header={null}
    >
      <form id="task-detail-form" aria-label={isNew ? 'Neue Aufgabe anlegen' : `Aufgabe bearbeiten: ${task.title}`}
        onSubmit={form.speichern} className="flex min-h-0 flex-1 flex-col">
        <div className="safe-top border-b border-line">
          <header className="flex min-h-16 shrink-0 flex-wrap items-center gap-2 px-2 py-1">
            <IconButton
              onClick={schliessen}
              aria-label="Schließen"
              variant="icon"
              disabled={busy || form.busy}
            >
              <CloseIcon />
            </IconButton>
            <h2 className="min-w-0 flex-1 truncate text-title font-medium text-ink">
              {isNew ? 'Neue Aufgabe' : 'Aufgabe'}
            </h2>

            {isNew ? null : (
              <Button
                aria-label="Aufgabe löschen"
                variant="danger"
                disabled={busy || form.busy}
                onClick={() => {
                  void remove()
                }}
              >
                <TrashIcon className="h-4 w-4" />
              </Button>
            )}
            <Button
              type="submit"
              variant="primary"
              layout="ml-auto"
              disabled={busy || form.busy || form.werte.title.trim().length === 0}
            >
              Speichern
            </Button>
          </header>
        </div>

      <div className="scroll-area safe-bottom min-h-0 flex-1 overflow-y-auto">
        <div className="space-y-5 px-5 py-5">
          <p className="break-words text-meta text-ink-muted">Liste: {lists.find(list => list.id === listId)?.name ?? 'Nicht mehr verfügbar'}</p>
          {targetHint ? <p role="status" className="text-body text-ink-muted">{targetHint}</p> : null}
          {isNew && onChangeTarget ? <Button variant="secondary" disabled={form.busy || busy} onClick={onChangeTarget}>Zielliste ändern</Button> : null}
          <TaskFields
            form={form}
            sections={sections}
            currentUserId={currentUserId}
            listIsShared={lists.find((eintrag) => eintrag.id === listId)?.is_shared ?? false}
            idPrefix="detail"
            beschreibungZeilen={4}
            titelAutofokus={isNew}
          />
          <TaskFormStatus form={form} />
          {error ? <p role="alert" className={errorBox}>{error}</p> : null}

          {task !== null ? (
            <Button
              onClick={() => {
                void toggleCompleted()
              }}
              disabled={busy || form.busy}
              variant="secondary" layout="w-full"
            >
              {completed ? 'Als offen markieren' : 'Als erledigt markieren'}
            </Button>
          ) : null}
          {task !== null && !completed ? <Button variant="secondary" layout="w-full" disabled={busy || form.busy}
            onClick={() => onRequestOrder(task)}>Reihenfolge ändern</Button> : null}
        </div>

        {canMove ? (
          <div className="space-y-2 border-t border-line px-4 py-4">
            <Button
              variant="secondary" size="block" layout="w-full"
              disabled={busy || form.busy}
              onClick={() => {
                if (task !== null) onRequestMove(task)
              }}
            >
              <MoveIcon className="h-4 w-4" />
              In andere Liste verschieben
            </Button>
          </div>
        ) : null}
        <div className="border-t border-line px-5 py-4"><SyncIndicator /></div>
      </div>
      </form>
    </Screen>
    {verwerfen ? <Sheet role="alertdialog" label="Änderungen verwerfen" title="Ungespeicherter Entwurf"
      name="entwurf-schliessen" onClose={() => setVerwerfen(false)}>
      <div className="space-y-4 p-5">
        <p className="text-body text-ink-soft">Deine Eingaben sind noch nicht gespeichert.</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" layout="flex-1" onClick={onClose}>Entwurf behalten</Button>
          <Button variant="danger" layout="flex-1" onClick={() => { form.zuruecksetzen(); onClose() }}>Verwerfen</Button>
          <Button variant="secondary" layout="w-full" onClick={() => setVerwerfen(false)}>Weiter bearbeiten</Button>
        </div>
      </div>
    </Sheet> : null}
  </>
}
