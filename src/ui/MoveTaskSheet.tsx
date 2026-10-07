import { useState } from 'react'
import { useWorkspace } from '../app/useWorkspace'
import type { LocalList, LocalTask } from '../domain/types'
import { errorMessage } from './styles'

import { Button } from './components/Button'
import { Sheet } from './components/Sheet'

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
    <Sheet
      name="aufgabe-verschieben"
      label="Aufgabe verschieben"
      title="Verschieben nach"
      subtitle={task.title}
      closeLabel="Verschieben abbrechen"
      onClose={onClose}
      footer={
        <Button variant="ghost" layout="w-full" onClick={onClose}>
          Abbrechen
        </Button>
      }
    >

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

    </Sheet>
  )
}
