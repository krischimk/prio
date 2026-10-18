import { useDeletedLists, useDeletedTasks, useDiscardedNotes, useLists, useRestorableTasks } from '../app/hooks'
import { useWorkspace } from '../app/useWorkspace'
import { RESTORE_WINDOW_DAYS } from '../domain/ordering'
import { formatCompletedLabel, formatDiscardedNoteLabel } from './datetime'

import { Button } from './components/Button'
import { Sheet } from './components/Sheet'
import { useContext, useState } from 'react'
import { TaskDraftContext } from './taskDraftContext'
import { createTaskDraft } from './taskDraft'
import { useView } from './useView'
import type { DiscardedNote } from '../domain/discardedNotes'
import { Markdown } from './Markdown'

/**
 * „Aufgaben wiederherstellen“ in den Einstellungen.
 *
 * Abgehakte Aufgaben verschwinden sofort aus der Liste, bleiben hier aber noch
 * sieben Tage auffindbar; die bestätigte Frist läuft bei Umstellung neu an.
 * Dauerhaft aufbewahrte Aufgaben gehören ausschließlich an ihr Listenende.
 *
 * Gelöschte Aufgaben und Listen stehen darunter: Seit das Löschen keine
 * Rückfrage mehr stellt, ist das der zweite Weg zurück – neben der kurzen
 * Leiste, die sofort erscheint.
 *
 * Auf dem Telefon fährt die Ansicht von unten ein, in der breiten Ansicht
 * erscheint sie mittig. Bewusst dieselbe Komponente mit anderer Ausrichtung:
 * Der Inhalt ist identisch, nur der Rahmen unterscheidet sich – das ist einer
 * der in `AGENTS.md` erlaubten Unterschiede.
 */
export function RestoreTasksPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { repositories } = useWorkspace()
  const tasks = useRestorableTasks(open)
  const deletedTasks = useDeletedTasks(open)
  const deletedLists = useDeletedLists(open)
  const lists = useLists()
  const notes = useDiscardedNotes(open)
  const drafts = useContext(TaskDraftContext)
  const view = useView()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function restore(action: () => Promise<unknown>) {
    if (busy) return
    setBusy(true); setError(null)
    try { await action() }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Die Wiederherstellung ist fehlgeschlagen.') }
    finally { setBusy(false) }
  }

  async function openNote(note: DiscardedNote) {
    if (!drafts) return
    const task = note.taskId ? await repositories.getTask(note.taskId) : null
    if (note.taskId && (!task || task.deleted_at)) throw new Error('Stelle zuerst die gelöschte Aufgabe wieder her.')
    const listId = task?.list_id ?? note.listId
    if (!lists.some(list => list.id === listId)) throw new Error('Stelle zuerst die gelöschte Liste wieder her.')
    const key = task ? `task:${task.id}` : `new:${listId}`
    const initial = createTaskDraft(task ?? null, listId)
    const previous = drafts.drafts[key] ?? initial
    if (previous.busy) throw new Error('Die Aufgabe wird gerade gespeichert. Versuche es gleich erneut.')
    // Ein vorhandener Entwurf wird ebenfalls gesichert, bevor seine Notiz wechselt.
    if (previous.werte.description !== previous.start.description && previous.werte.description !== note.description)
      await repositories.rememberDiscardedNote({ taskId: previous.taskId, listId, title: previous.werte.title, description: previous.werte.description })
    drafts.change(key, initial, old => ({ ...old, werte: { ...old.werte,
      title: old.werte.title || note.title, description: note.description } }))
    onClose()
    view.setTaskDetail({ taskId: task?.id ?? null, listId })
  }

  if (!open) return null

  const listNames = new Map(lists.map((list) => [list.id, list.name]))

  return (
    <Sheet
      name="aufgaben-wiederherstellen"
      title="Aufgaben wiederherstellen"
      subtitle={`Erledigte Aufgaben bis zum Fristablauf; manuell Gelöschtes ${RESTORE_WINDOW_DAYS} Tage`}
      onClose={onClose}
    >
          {error ? <p role="alert" className="px-4 py-3 text-body text-danger">{error}</p> : null}
          {tasks.length === 0 ? (
            <p className="px-4 py-8 text-center text-body text-ink-faint" data-testid="restore-empty">
              In diesem Zeitraum wurde nichts abgehakt.
            </p>
          ) : (
            <ul data-testid="restore-list">
              {tasks.map((task) => (
                <li
                  key={task.id}
                  className="flex items-start gap-3 border-b border-line px-4 py-3 last:border-b-0"
                >
                  <div className="min-w-0 flex-1">
                    <p className="break-words text-body text-ink">{task.title}</p>
                    <p className="mt-0.5 text-meta text-ink-faint">
                      {listNames.get(task.list_id) ?? 'Gelöschte Liste'}
                      {task.completed_at ? ` · ${formatCompletedLabel(task.completed_at)}` : ''}
                    </p>
                  </div>
                  <Button
                    variant="primary" size="sm" layout="shrink-0"
                    disabled={busy}
                    onClick={() => {
                      void restore(() => repositories.setTaskCompleted(task.id, false))
                    }}
                  >
                    Wiederherstellen
                  </Button>
                </li>
              ))}
            </ul>
          )}
      {/* Gelöschte Dinge – Aufgaben und ganze Listen. */}
      <div data-testid="restore-deleted">
        <h3 className="border-t border-line px-4 pt-4 pb-1 text-meta font-semibold tracking-wide text-ink-faint uppercase">
          Gelöscht
        </h3>
        {deletedLists.length === 0 && deletedTasks.length === 0 ? (
          <p className="px-4 py-6 text-center text-body text-ink-faint" data-testid="restore-deleted-empty">
            In diesem Zeitraum wurde nichts gelöscht.
          </p>
        ) : (
          <ul>
            {deletedLists.map((liste) => (
              <li
                key={liste.id}
                className="flex items-center gap-3 border-b border-line px-4 py-3 last:border-b-0"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-body text-ink">Liste „{liste.name}“</p>
                  <p className="mt-0.5 text-meta text-ink-faint">mit allen ihren Aufgaben</p>
                </div>
                <Button
                  variant="primary" size="sm" layout="shrink-0"
                  disabled={busy}
                  onClick={() => {
                    void restore(() => repositories.restoreList(liste.id))
                  }}
                >
                  Wiederherstellen
                </Button>
              </li>
            ))}
            {deletedTasks.map((task) => (
              <li
                key={task.id}
                className="flex items-center gap-3 border-b border-line px-4 py-3 last:border-b-0"
              >
                <div className="min-w-0 flex-1">
                  <p className="break-words text-body text-ink">{task.title}</p>
                  <p className="mt-0.5 text-meta text-ink-faint">
                    {listNames.get(task.list_id) ?? 'Gelöschte Liste'}
                  </p>
                </div>
                <Button
                  variant="primary" size="sm" layout="shrink-0"
                  disabled={busy}
                  onClick={() => {
                    void restore(() => repositories.restoreTask(task.id))
                  }}
                >
                  Wiederherstellen
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <section aria-label="Verworfene Notizen">
        <h3 className="border-t border-line px-4 pt-4 pb-1 text-meta font-semibold tracking-wide text-ink-faint uppercase">Verworfene Notizen</h3>
        <p className="px-4 pb-3 text-meta text-ink-muted">24 Stunden auf diesem Gerät aufbewahrt. Öffnet die Notiz als Entwurf.</p>
        {notes.length ? <ul>{notes.map(note => <li key={note.id} className="space-y-2 border-b border-line px-4 py-3 last:border-b-0">
          <p className="break-words text-body text-ink">{note.title || 'Neue Aufgabe'}</p>
          <p className="text-meta text-ink-faint">{listNames.get(note.listId) ?? 'Gelöschte Liste'} · {formatDiscardedNoteLabel(note.discardedAt)}</p>
          <div className="max-h-40 overflow-y-auto break-words text-ink-muted">
            {note.description ? <Markdown text={note.description} preserveLineBreaks /> : <p className="text-meta">Leere Notiz</p>}
          </div>
          <Button variant="secondary" size="sm" disabled={busy} onClick={() => { void restore(() => openNote(note)) }}>Als Entwurf öffnen</Button>
        </li>)}</ul> : <p className="px-4 pb-5 text-meta text-ink-faint">Keine verworfenen Notizänderungen in den letzten 24 Stunden.</p>}
      </section>

    </Sheet>
  )
}
