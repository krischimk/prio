import { useCallback, useEffect, useRef, type MouseEvent } from 'react'

/**
 * Langdruck auf einem Element.
 *
 * Wird für das Verschieben einer Aufgabe gebraucht: Antippen öffnet die
 * Detailansicht, Gedrückthalten öffnet die Listenauswahl.
 *
 * Wichtig ist das Unterdrücken des Klicks danach: Ein Langdruck erzeugt auf
 * dem Touchscreen anschließend trotzdem ein `click`-Ereignis. Ohne die
 * Abfrage über `wasLongPress()` würde direkt nach dem Verschieben auch noch
 * die Detailansicht aufgehen.
 */
export interface LongPressHandlers {
  onPointerDown: () => void
  onPointerUp: () => void
  onPointerLeave: () => void
  onPointerCancel: () => void
  onContextMenu: (event: MouseEvent) => void
}

export interface LongPress {
  handlers: LongPressHandlers
  /** `true`, wenn soeben ein Langdruck ausgelöst wurde. */
  wasLongPress: () => boolean
}

export function useLongPress(callback: () => void, delayMs = 500): LongPress {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const triggered = useRef(false)
  const callbackRef = useRef(callback)

  useEffect(() => {
    callbackRef.current = callback
  }, [callback])

  const cancel = useCallback(() => {
    if (timer.current !== null) {
      clearTimeout(timer.current)
      timer.current = null
    }
  }, [])

  const start = useCallback(() => {
    triggered.current = false
    cancel()
    timer.current = setTimeout(() => {
      timer.current = null
      triggered.current = true
      callbackRef.current()
    }, delayMs)
  }, [cancel, delayMs])

  useEffect(() => cancel, [cancel])

  const pointerHandlers: LongPressHandlers = {
    onPointerDown: start,
    onPointerUp: cancel,
    onPointerLeave: cancel,
    onPointerCancel: cancel,
    // Auf dem Desktop würde ein Rechtsklick sonst das Browser-Menü öffnen.
    onContextMenu: (event: MouseEvent) => event.preventDefault(),
  }

  return {
    handlers: pointerHandlers,
    wasLongPress: () => triggered.current,
  }
}
