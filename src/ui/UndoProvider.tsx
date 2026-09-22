import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useWorkspace } from '../app/useWorkspace'
import type { LocalTask } from '../domain/types'
import { primaryButton } from './styles'
import { UndoContext, UNDO_VISIBLE_MS, type UndoContextValue } from './undoContext'

/**
 * Zeigt nach dem Abhaken kurz eine Leiste mit „Rückgängig“.
 *
 * Warum überhaupt? Abgehakte Aufgaben verschwinden sofort aus der Liste. Ohne
 * diese Leiste wäre ein versehentliches Abhaken nur über die Einstellungen
 * rückgängig zu machen – für den häufigsten Fehlgriff zu umständlich.
 *
 * Hakst du mehrere Aufgaben kurz hintereinander ab, zeigt die Leiste die
 * zuletzt abgehakte; der Timer beginnt jeweils von vorn.
 */
export function UndoProvider({ children }: { children: ReactNode }) {
  const { repositories } = useWorkspace()
  const [offer, setOffer] = useState<{ taskId: string; title: string } | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearTimer = useCallback(() => {
    if (timer.current !== null) {
      clearTimeout(timer.current)
      timer.current = null
    }
  }, [])

  useEffect(() => clearTimer, [clearTimer])

  const offerUndo = useCallback(
    (task: LocalTask) => {
      clearTimer()
      setOffer({ taskId: task.id, title: task.title })
      timer.current = setTimeout(() => {
        timer.current = null
        setOffer(null)
      }, UNDO_VISIBLE_MS)
    },
    [clearTimer],
  )

  const value = useMemo<UndoContextValue>(() => ({ offerUndo }), [offerUndo])

  const undo = async () => {
    if (!offer) return
    clearTimer()
    setOffer(null)
    await repositories.setTaskCompleted(offer.taskId, false)
  }

  return (
    <UndoContext.Provider value={value}>
      {children}
      {offer ? (
        <div className="safe-bottom pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4">
          {/*
            `mb-24` hält Abstand zum runden Plus-Knopf der mobilen Ansicht,
            `md:mb-4` gilt für die breite Ansicht ohne diesen Knopf.
          */}
          <div
            role="status"
            data-testid="undo-bar"
            className="pointer-events-auto mb-24 flex w-full max-w-md items-center gap-3 rounded-lg border border-neutral-700 bg-neutral-800 px-4 py-3 shadow-lg shadow-black/40 md:mb-4"
          >
            <span className="min-w-0 flex-1 truncate text-sm text-neutral-100">
              „{offer.title}“ erledigt
            </span>
            <button
              type="button"
              className={`${primaryButton} shrink-0 px-3 py-1.5 text-xs`}
              onClick={() => {
                void undo()
              }}
            >
              Rückgängig
            </button>
          </div>
        </div>
      ) : null}
    </UndoContext.Provider>
  )
}
