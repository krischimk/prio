import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useIsDesktop } from '../app/useIsDesktop'
import { useWorkspace } from '../app/useWorkspace'
import type { LocalTask } from '../domain/types'

import { UndoContext, UNDO_VISIBLE_MS, type UndoContextValue } from './undoContext'
import { Button } from './components/Button'
import { layer } from './styles'

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

  // Auf der breiten Ansicht gibt es keinen Plus-Knopf; die Schwelle kommt aus
  // derselben Entscheidung wie die Ansicht selbst.
  const isDesktop = useIsDesktop()

  return (
    <UndoContext.Provider value={value}>
      {children}
      {offer ? (
        <div className={`safe-bottom pointer-events-none fixed inset-x-0 bottom-0 ${layer.raised} flex justify-center px-4`}>
          {/*
            `fab-clearance` hält Abstand zum runden Plus-Knopf und rechnet aus
            der Gerätegeometrie in `index.css`; die breite Ansicht nimmt den
            schmalen Abstand. Vorher standen hier zwei Zahlen und eine
            CSS-Medienabfrage – eine zweite Schwelle neben `useIsDesktop`.
          */}
          <div
            role="status"
            data-testid="undo-bar"
            className={`${isDesktop ? 'mb-4' : 'fab-clearance'} pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-card border border-line-strong bg-raised px-4 py-3 shadow-lg shadow-page/40`}
          >
            <span className="min-w-0 flex-1 truncate text-body text-ink">
              „{offer.title}“ erledigt
            </span>
            <Button
              variant="primary" size="sm" layout="shrink-0"
              onClick={() => {
                void undo()
              }}
            >
              Rückgängig
            </Button>
          </div>
        </div>
      ) : null}
    </UndoContext.Provider>
  )
}
