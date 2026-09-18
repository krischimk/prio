import { useCallback, useEffect, useRef, useState, type PointerEvent, type RefObject } from 'react'

/**
 * Umsortieren per Langdruck und Ziehen.
 *
 * Ablauf:
 *   1. Finger auflegen. Es passiert zunächst nichts – Wischen soll weiterhin
 *      die Liste scrollen.
 *   2. Bewegt sich der Finger vorher um mehr als ein paar Pixel, war es ein
 *      Wischen und der Langdruck wird verworfen.
 *   3. Nach `longPressMs` ohne Bewegung wird die Zeile "aufgenommen": Sie folgt
 *      dem Finger, und ab hier wird das Scrollen unterbunden.
 *   4. Loslassen setzt die neue Reihenfolge.
 *
 * Warum der Umweg über den Langdruck? Das Antippen einer Zeile ist bereits
 * belegt (Detailansicht). Außerdem erwartet man auf dem Telefon genau dieses
 * Verhalten.
 *
 * Wichtig für Touchscreen: Ab dem Aufnehmen wird ein `touchmove`-Listener mit
 * `passive: false` registriert, der das Standardverhalten unterbindet. Das
 * funktioniert, weil der Finger beim Aufnehmen stillhält – der Browser hat also
 * noch nicht mit dem Scrollen begonnen.
 */
export interface RowDragHandlers {
  onPointerDown: (event: PointerEvent<HTMLElement>) => void
  onPointerMove: (event: PointerEvent<HTMLElement>) => void
  onPointerUp: (event: PointerEvent<HTMLElement>) => void
  onPointerCancel: (event: PointerEvent<HTMLElement>) => void
  onContextMenu: (event: { preventDefault: () => void }) => void
}

export interface ReorderDrag {
  /** Id der aufgenommenen Aufgabe oder `null`. */
  draggingId: string | null
  /** Index, an dem die Aufgabe landen würde. */
  dropIndex: number | null
  /** Versatz der gezogenen Zeile in Pixeln. */
  offsetY: number
  getRowHandlers: (id: string, index: number) => RowDragHandlers
  /** `true`, wenn soeben gezogen wurde – dann den Klick unterdrücken. */
  wasDragging: () => boolean
}

/** Bewegung, ab der ein begonnener Langdruck als Wischen gilt. */
const MOVE_TOLERANCE_PX = 10

export function useReorderDrag(options: {
  itemIds: string[]
  onReorder: (orderedIds: string[]) => void
  containerRef: RefObject<HTMLElement | null>
  longPressMs?: number
}): ReorderDrag {
  const { itemIds, onReorder, containerRef, longPressMs = 400 } = options

  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dropIndex, setDropIndex] = useState<number | null>(null)
  const [offsetY, setOffsetY] = useState(0)

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const didDrag = useRef(false)
  /** Position des aufgelegten Fingers, solange noch nicht aufgenommen wurde. */
  const press = useRef<{ startY: number } | null>(null)
  const drag = useRef<{
    id: string
    index: number
    startY: number
    rects: Array<{ top: number; height: number }>
  } | null>(null)

  // Aktuelle Werte für die Ereignisbehandlung, ohne bei jedem Rendern neue
  // Handler zu erzeugen.
  const itemIdsRef = useRef(itemIds)
  const onReorderRef = useRef(onReorder)
  useEffect(() => {
    itemIdsRef.current = itemIds
    onReorderRef.current = onReorder
  }, [itemIds, onReorder])

  const clearTimer = useCallback(() => {
    if (timer.current !== null) {
      clearTimeout(timer.current)
      timer.current = null
    }
  }, [])

  const reset = useCallback(() => {
    clearTimer()
    press.current = null
    drag.current = null
    setDraggingId(null)
    setDropIndex(null)
    setOffsetY(0)
  }, [clearTimer])

  useEffect(() => reset, [reset])

  /** Unterbindet das Scrollen, solange gezogen wird. */
  const blockScroll = useCallback((event: TouchEvent) => {
    if (event.cancelable) event.preventDefault()
  }, [])

  const startDragging = useCallback(
    (id: string, index: number, startY: number, element: HTMLElement, pointerId: number) => {
      const container = containerRef.current
      const rows = container ? Array.from(container.querySelectorAll<HTMLElement>('[data-task-row]')) : []

      press.current = null
      drag.current = {
        id,
        index,
        startY,
        // Höhen und Lagen einmalig festhalten: Die Zeilen sind unterschiedlich
        // hoch (Beschreibung, Fälligkeit), eine feste Zeilenhöhe würde nicht
        // genügen.
        rects: rows.map((row) => {
          const rect = row.getBoundingClientRect()
          return { top: rect.top, height: rect.height }
        }),
      }
      didDrag.current = true
      setDraggingId(id)
      setDropIndex(index)
      setOffsetY(0)

      // Zeiger einfangen: So kommen Bewegungen weiter an, auch wenn der Finger
      // die Zeile verlässt.
      try {
        element.setPointerCapture(pointerId)
      } catch {
        // Nicht jede Umgebung unterstützt Pointer-Capture – kein Grund abzubrechen.
      }
      document.addEventListener('touchmove', blockScroll, { passive: false })
    },
    [blockScroll, containerRef],
  )

  const endDragging = useCallback(
    (commit: boolean) => {
      document.removeEventListener('touchmove', blockScroll)
      const current = drag.current
      const target = dropIndex

      if (commit && current && target !== null && target !== current.index) {
        const next = [...itemIdsRef.current]
        next.splice(current.index, 1)
        next.splice(target, 0, current.id)
        onReorderRef.current(next)
      }

      reset()
    },
    [blockScroll, dropIndex, reset],
  )

  const getRowHandlers = useCallback(
    (id: string, index: number): RowDragHandlers => ({
      onPointerDown: (event) => {
        // Nur die primäre Maustaste; Touch und Stift sind immer gemeint.
        if (event.pointerType === 'mouse' && event.button !== 0) return

        didDrag.current = false
        const element = event.currentTarget
        const startY = event.clientY
        const pointerId = event.pointerId

        press.current = { startY }
        clearTimer()
        timer.current = setTimeout(() => {
          timer.current = null
          startDragging(id, index, startY, element, pointerId)
        }, longPressMs)
      },

      onPointerMove: (event) => {
        const current = drag.current

        if (!current) {
          // Noch nicht aufgenommen: Deutliche Bewegung heißt Wischen.
          const pressed = press.current
          if (pressed && timer.current !== null && Math.abs(event.clientY - pressed.startY) > MOVE_TOLERANCE_PX) {
            clearTimer()
            press.current = null
          }
          return
        }

        setOffsetY(event.clientY - current.startY)

        // Einfügeposition aus den tatsächlichen Zeilenmitten bestimmen.
        let ziel = current.rects.length - 1
        for (let i = 0; i < current.rects.length; i += 1) {
          const rect = current.rects[i]
          if (rect && event.clientY < rect.top + rect.height / 2) {
            ziel = i
            break
          }
        }
        setDropIndex(Math.max(0, ziel))
      },

      onPointerUp: () => {
        if (drag.current) {
          endDragging(true)
          return
        }
        clearTimer()
        press.current = null
      },

      onPointerCancel: () => {
        endDragging(false)
      },

      onContextMenu: (event) => event.preventDefault(),
    }),
    [clearTimer, endDragging, longPressMs, startDragging],
  )

  return {
    draggingId,
    dropIndex,
    offsetY,
    getRowHandlers,
    wasDragging: () => didDrag.current,
  }
}
