import { useBackLayer } from '../app/useBackLayer'
import { useLists, useRestorableTasks } from '../app/hooks'
import { useWorkspace } from '../app/useWorkspace'
import { RESTORE_WINDOW_DAYS } from '../db/repositories'
import { formatCompletedLabel } from './datetime'
import { CloseIcon } from './mobile/icons'
import { primaryButton } from './styles'

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

  useBackLayer(open, onClose)

  if (!open) return null

  const listNames = new Map(lists.map((list) => [list.id, list.name]))

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center md:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="Aufgaben wiederherstellen"
    >
      <div className="absolute inset-0 bg-black/60" aria-hidden="true" onClick={onClose} />

      <div className="safe-bottom relative flex max-h-[85vh] w-full flex-col overflow-hidden rounded-t-2xl border-t border-neutral-800 bg-neutral-900 md:max-w-lg md:rounded-2xl md:border">
        <header className="flex items-start justify-between gap-2 border-b border-neutral-800 px-4 py-3">
          <div className="min-w-0">
            <h2 className="text-sm font-medium text-neutral-100">Aufgaben wiederherstellen</h2>
            <p className="text-xs text-neutral-500">
              Abgehakt in den letzten {RESTORE_WINDOW_DAYS} Tagen
            </p>
          </div>
          {/*
            Bewusst nur EIN Schließen-Bedienelement: X, Escape und die
            Zurück-Taste schließen bereits. Ein zweiter Knopf mit demselben
            Namen wäre auch für Vorleseprogramme mehrdeutig.
          */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Schließen"
            className="rounded-md p-2 text-neutral-400 active:bg-neutral-800"
          >
            <CloseIcon />
          </button>
        </header>

        <div className="scroll-area flex-1 overflow-y-auto">
          {tasks.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-neutral-500" data-testid="restore-empty">
              In diesem Zeitraum wurde nichts abgehakt.
            </p>
          ) : (
            <ul data-testid="restore-list">
              {tasks.map((task) => (
                <li
                  key={task.id}
                  className="flex items-start gap-3 border-b border-neutral-800 px-4 py-3 last:border-b-0"
                >
                  <div className="min-w-0 flex-1">
                    <p className="break-words text-sm text-neutral-100">{task.title}</p>
                    <p className="mt-0.5 text-xs text-neutral-500">
                      {listNames.get(task.list_id) ?? 'Gelöschte Liste'}
                      {task.completed_at ? ` · ${formatCompletedLabel(task.completed_at)}` : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    className={`${primaryButton} shrink-0 px-3 py-1.5 text-xs`}
                    onClick={() => {
                      void repositories.setTaskCompleted(task.id, false)
                    }}
                  >
                    Wiederherstellen
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
