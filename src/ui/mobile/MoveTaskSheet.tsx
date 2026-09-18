import { useState } from 'react'
import { useBackLayer } from '../../app/useBackLayer'
import { useWorkspace } from '../../app/useWorkspace'
import type { LocalList, LocalTask } from '../../domain/types'
import { ghostButton } from '../styles'
import { CloseIcon } from './icons'

/**
 * Auswahl der Ziel-Liste beim Verschieben einer Aufgabe.
 *
 * Öffnet sich per Langdruck auf eine Aufgabe oder über die Detailansicht.
 * Die aktuelle Liste wird nicht angeboten.
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
    <div className="fixed inset-0 z-60 flex flex-col justify-end" role="dialog" aria-modal="true" aria-label="Aufgabe verschieben">
      <div
        className="absolute inset-0 cursor-default bg-black/60"
        aria-hidden="true"
        onClick={onClose}
      />

      <div className="safe-bottom relative max-h-[70%] overflow-y-auto rounded-t-2xl border-t border-neutral-800 bg-neutral-900">
        <div className="flex items-center justify-between px-4 pt-4">
          <h2 className="text-sm font-medium text-neutral-100">Verschieben nach</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Verschieben abbrechen"
            className="rounded-md p-2 text-neutral-400 active:bg-neutral-800"
          >
            <CloseIcon />
          </button>
        </div>
        <p className="truncate px-4 pb-3 text-xs text-neutral-500">{task.title}</p>

        <ul className="pb-4" data-testid="move-targets">
          {targets.map((list) => (
            <li key={list.id}>
              <button
                type="button"
                onClick={() => {
                  void move(list.id)
                }}
                disabled={busy}
                className="w-full border-t border-neutral-800 px-4 py-3 text-left text-sm text-neutral-200 active:bg-neutral-800 disabled:opacity-50"
              >
                {list.name}
              </button>
            </li>
          ))}
          {targets.length === 0 ? (
            <li className="px-4 py-4 text-sm text-neutral-500">
              Es gibt keine andere Liste zum Verschieben.
            </li>
          ) : null}
        </ul>

        {error ? (
          <p role="alert" className="px-4 pb-4 text-xs text-red-400">
            {error}
          </p>
        ) : null}

        <div className="px-4 pb-2">
          <button type="button" className={`${ghostButton} w-full`} onClick={onClose}>
            Abbrechen
          </button>
        </div>
      </div>
    </div>
  )
}
