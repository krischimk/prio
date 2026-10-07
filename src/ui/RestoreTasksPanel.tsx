import { useLists, useRestorableTasks } from '../app/hooks'
import { useWorkspace } from '../app/useWorkspace'
import { RESTORE_WINDOW_DAYS } from '../db/repositories'
import { formatCompletedLabel } from './datetime'

import { Button } from './components/Button'
import { Sheet } from './components/Sheet'

/**
 * „Aufgaben wiederherstellen“ in den Einstellungen.
 *
 * Abgehakte Aufgaben verschwinden sofort aus der Liste, bleiben hier aber noch
 * `RESTORE_WINDOW_DAYS` Tage auffindbar – zuletzt abgehakte zuerst. Danach sind
 * sie nicht gelöscht, nur nicht mehr über die Oberfläche erreichbar.
 *
 * Auf dem Telefon fährt die Ansicht von unten ein, in der breiten Ansicht
 * erscheint sie mittig. Bewusst dieselbe Komponente mit anderer Ausrichtung:
 * Der Inhalt ist identisch, nur der Rahmen unterscheidet sich – das ist einer
 * der in `AGENTS.md` erlaubten Unterschiede.
 */
export function RestoreTasksPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { repositories } = useWorkspace()
  const tasks = useRestorableTasks()
  const lists = useLists()

  if (!open) return null

  const listNames = new Map(lists.map((list) => [list.id, list.name]))

  return (
    <Sheet
      name="aufgaben-wiederherstellen"
      title="Aufgaben wiederherstellen"
      subtitle={`Abgehakt in den letzten ${RESTORE_WINDOW_DAYS} Tagen`}
      onClose={onClose}
    >
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
                    onClick={() => {
                      void repositories.setTaskCompleted(task.id, false)
                    }}
                  >
                    Wiederherstellen
                  </Button>
                </li>
              ))}
            </ul>
          )}
    </Sheet>
  )
}
