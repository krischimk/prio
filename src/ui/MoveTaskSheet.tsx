import { useState } from 'react'
import { useBackLayer } from '../app/useBackLayer'
import { useWorkspace } from '../app/useWorkspace'
import type { LocalList, LocalTask } from '../domain/types'
import { errorMessage } from './styles'
import { CloseIcon } from './icons'
import { IconButton } from './components/IconButton'
import { Button } from './components/Button'

/**
 * Auswahl der Ziel-Liste beim Verschieben einer Aufgabe.
 *
 * Zwei Wege hinein: In der breiten Ansicht aus der Aufgabenzeile („Verschieben“),
 * auf dem Telefon aus der Detailansicht. Die aktuelle Liste wird nicht
 * angeboten.
 *
 * Beide Ansichten benutzen dasselbe Blatt; es steht als Blatt unten an und
 * erscheint ab der breiten Ansicht mittig – wie der Wiederherstellen-Dialog.
 */
export function MoveTaskSheet({
  task,
  lists,
  onClose,
}: {
  task: LocalTask
  lists: LocalList[]
  onClose: () => void
}) {
  const { repositories } = useWorkspace()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useBackLayer(true, onClose)

  const targets = lists.filter((list) => list.id !== task.list_id)

  const move = async (targetListId: string) => {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      await repositories.moveTask(task.id, targetListId)
      onClose()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Verschieben fehlgeschlagen.')
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-60 flex flex-col justify-end md:items-center md:justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="Aufgabe verschieben"
    >
      <div
        className="absolute inset-0 cursor-default bg-page/60"
        aria-hidden="true"
        onClick={onClose}
      />

      <div className="safe-bottom relative max-h-[70%] overflow-y-auto rounded-t-sheet border-t border-line bg-surface md:max-h-[85vh] md:w-full md:max-w-lg md:rounded-sheet md:border">
        <div className="flex items-center justify-between px-4 pt-4">
          <h2 className="text-body font-medium text-ink">Verschieben nach</h2>
          <IconButton
           
            onClick={onClose}
            aria-label="Verschieben abbrechen"
            variant="icon"
          >
            <CloseIcon />
          </IconButton>
        </div>
        <p className="truncate px-4 pb-3 text-meta text-ink-faint">{task.title}</p>

        <ul className="pb-4" data-testid="move-targets">
          {targets.map((list) => (
            <li key={list.id}>
              <button
                type="button"
                onClick={() => {
                  void move(list.id)
                }}
                disabled={busy}
                className="w-full border-t border-line px-4 py-3 text-left text-body text-ink-soft active:bg-raised disabled:opacity-50"
              >
                {list.name}
              </button>
            </li>
          ))}
          {targets.length === 0 ? (
            <li className="px-4 py-4 text-body text-ink-faint">
              Es gibt keine andere Liste zum Verschieben.
            </li>
          ) : null}
        </ul>

        {error ? (
          <p role="alert" className={`px-4 pb-4 ${errorMessage}`}>
            {error}
          </p>
        ) : null}

        <div className="px-4 pb-2">
          <Button variant="ghost" layout="w-full" onClick={onClose}>
            Abbrechen
          </Button>
        </div>
      </div>
    </div>
  )
}
