import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useIsDesktop } from '../app/useIsDesktop'
import { useTask } from '../app/hooks'
import { useWorkspace } from '../app/useWorkspace'
import type { LocalTask } from '../domain/types'

import { UndoContext, UNDO_VISIBLE_MS, type UndoAngebot, type UndoContextValue } from './undoContext'
import { Button } from './components/Button'
import { layer } from './styles'

/**
 * Zeigt nach dem Abhaken kurz eine Leiste mit „Rückgängig“.
 *
 * Warum überhaupt? Abgehakte Aufgaben verschwinden sofort aus der Liste. Ohne
 * diese Leiste wäre ein versehentliches Abhaken nur über die Einstellungen
 * rückgängig zu machen – für den häufigsten Fehlgriff zu umständlich.
 *
 * Seit dem Löschen ohne Rückfrage zeigt sie auch gelöschte Dinge: Das Löschen
 * ist damit genauso leicht zurückzunehmen wie das Abhaken – und die
 * Bestätigungsdialoge davor sind weg.
 *
 * Meldest du mehrere Handlungen kurz hintereinander, zeigt die Leiste die
 * zuletzt gemeldete; der Timer beginnt jeweils von vorn.
 *
 * Die Leiste merkt sich nur die **Kennung** der Aufgabe und liest den Titel
 * nach (`useTask`). Vorher kopierte sie ihn: Wer die Aufgabe innerhalb der
 * fünf Sekunden umbenannte – oder wessen Abgleich sie ersetzte –, sah den alten
 * Titel. Und ein fehlgeschlagenes Rückgängigmachen verschwand wortlos; jetzt
 * bleibt die Leiste stehen und sagt es.
 */
export function UndoProvider({ children }: { children: ReactNode }) {
  const { repositories } = useWorkspace()
  const [angebot, setAngebot] = useState<UndoAngebot | null>(null)
  const [fehler, setFehler] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearTimer = useCallback(() => {
    if (timer.current !== null) {
      clearTimeout(timer.current)
      timer.current = null
    }
  }, [])

  useEffect(() => clearTimer, [clearTimer])

  const offer = useCallback(
    (neu: UndoAngebot) => {
      clearTimer()
      setFehler(null)
      setAngebot(neu)
      timer.current = setTimeout(() => {
        timer.current = null
        setAngebot(null)
      }, UNDO_VISIBLE_MS)
    },
    [clearTimer],
  )

  const offerUndo = useCallback(
    (task: LocalTask) => {
      offer({
        taskId: task.id,
        art: 'erledigt',
        rueckgaengig: async () => {
          await repositories.setTaskCompleted(task.id, false)
        },
      })
    },
    [offer, repositories],
  )

  const value = useMemo<UndoContextValue>(() => ({ offerUndo, offer }), [offerUndo, offer])

  // Den Titel nachlesen statt kopieren – siehe Kopfkommentar.
  const task = useTask(angebot?.taskId ?? null)

  const satz =
    angebot === null
      ? ''
      : (angebot.text ?? `„${task?.title ?? 'Aufgabe'}“`) +
        (angebot.art === 'erledigt' ? ' erledigt' : ' gelöscht')

  const undo = async () => {
    if (!angebot) return
    try {
      await angebot.rueckgaengig()
      clearTimer()
      setAngebot(null)
      setFehler(null)
    } catch {
      // Etwa, wenn die Aufgabe inzwischen gelöscht ist. Die Leiste bleibt
      // stehen, damit der Druck auf „Rückgängig“ nicht folgenlos wirkt.
      setFehler('Das lässt sich nicht mehr zurückholen.')
    }
  }

  // Auf der breiten Ansicht gibt es keinen Plus-Knopf; die Schwelle kommt aus
  // derselben Entscheidung wie die Ansicht selbst.
  const isDesktop = useIsDesktop()

  return (
    <UndoContext.Provider value={value}>
      {children}
      {angebot ? (
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
            <span className="min-w-0 flex-1 truncate text-body text-ink" role={fehler ? 'alert' : undefined}>
              {fehler ?? satz}
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
