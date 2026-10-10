import { useDeletedLists, useDeletedTasks, useLists, useRestorableTasks } from '../app/hooks'
import { useWorkspace } from '../app/useWorkspace'
import { RESTORE_WINDOW_DAYS } from '../domain/ordering'
import { formatCompletedLabel } from './datetime'

import { Button } from './components/Button'
import { Sheet } from './components/Sheet'
import { useState } from 'react'

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
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function restore(action: () => Promise<unknown>) {
    if (busy) return
    setBusy(true); setError(null)
    try { await action() }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Die Wiederherstellung ist fehlgeschlagen.') }
    finally { setBusy(false) }
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

    </Sheet>
  )
}
