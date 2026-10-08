import { act, renderHook } from '@testing-library/react'
import { useRef } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useReorderDrag } from '../../src/ui/mobile/useReorderDrag'
import type { PointerEvent as ReactPointerEvent } from 'react'

/**
 * Der Ziehvorgang selbst (unit).
 *
 * Geprüft wird gegen echte DOM-Zeilen, deren Maße gestellt sind: Drei Zeilen à
 * 50 px, Mittellinien bei 25, 75, 125.
 */
const ZEILENHOEHE = 50
const IDS = ['A', 'B', 'C']

/** Ein Zeigerereignis, wie es die Handler brauchen. */
function zeiger(x: number, y: number, pointerId = 1) {
  return {
    pointerType: 'touch',
    button: 0,
    clientX: x,
    clientY: y,
    pointerId,
    currentTarget: document.querySelector('[data-task-row]') as HTMLElement,
  } as unknown as ReactPointerEvent<HTMLElement>
}

function aufbau() {
  const onReorder = vi.fn()
  const { result, rerender } = renderHook(() => {
    const ref = useRef<HTMLDivElement>(null)
    const drag = useReorderDrag({ itemIds: IDS, onReorder, containerRef: ref })
    return { ref, drag }
  })

  // Zeilen mit gestellten Maßen rendern.
  const behaelter = document.createElement('div')
  for (const id of IDS) {
    const zeile = document.createElement('div')
    zeile.setAttribute('data-task-row', '')
    zeile.setAttribute('data-id', id)
    behaelter.appendChild(zeile)
  }
  document.body.appendChild(behaelter)
  result.current.ref.current = behaelter
  rerender()

  return { onReorder, drag: () => result.current.drag, behaelter }
}

describe('useReorderDrag', () => {
  let rects: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.useFakeTimers()
    rects = vi
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockImplementation(function (this: HTMLElement) {
        const geschwister = this.parentElement
          ? Array.from(this.parentElement.querySelectorAll('[data-task-row]'))
          : []
        const stelle = Math.max(0, geschwister.indexOf(this))
        const top = stelle * ZEILENHOEHE
        return {
          top,
          height: ZEILENHOEHE,
          bottom: top + ZEILENHOEHE,
          left: 0,
          right: 100,
          width: 100,
          x: 0,
          y: top,
          toJSON: () => ({}),
        } as DOMRect
      })
  })

  afterEach(() => {
    rects.mockRestore()
    vi.useRealTimers()
    document.body.innerHTML = ''
  })

  /** Nimmt die mittlere Zeile (B) nach dem Langdruck auf. */
  function aufnehmen(drag: ReturnType<typeof aufbau>['drag']) {
    const handler = drag().getRowHandlers('B', 1)
    act(() => {
      handler.onPointerDown(zeiger(0, 70))
      vi.advanceTimersByTime(450)
    })
    return handler
  }

  it('schreibt nichts, wenn der Finger die Zeile kaum verlässt', () => {
    const { onReorder, drag } = aufbau()
    const handler = aufnehmen(drag)

    act(() => {
      handler.onPointerMove(zeiger(0, 80))
      handler.onPointerUp(zeiger(0, 80))
    })

    // Vorher: 80 liegt hinter der eigenen Mittellinie (75) → die Aufgabe
    // rutschte eine Position weiter, obwohl sie sich kaum bewegt hatte.
    expect(onReorder).not.toHaveBeenCalled()
    expect(drag().draggingId).toBeNull()
  })

  it('schiebt genau eine Position, wenn die nächste Mittellinie überschritten wird', () => {
    const { onReorder, drag } = aufbau()
    const handler = aufnehmen(drag)

    act(() => {
      handler.onPointerMove(zeiger(0, 130))
      handler.onPointerUp(zeiger(0, 130))
    })

    expect(onReorder).toHaveBeenCalledWith(['A', 'C', 'B'], 'B')
  })

  it('schreibt das Ziel auch, wenn Loslassen und Bewegung im selben Frame kommen', () => {
    const { onReorder, drag } = aufbau()
    const handler = aufnehmen(drag)

    // Kein Rendern dazwischen: Aus dem Zustand gelesen wäre das Ziel noch der
    // vorige Wert – die Aufgabe landete woanders, als die Linie zeigte.
    act(() => {
      handler.onPointerMove(zeiger(0, 130))
      handler.onPointerUp(zeiger(0, 130))
      vi.advanceTimersByTime(0)
    })

    expect(onReorder).toHaveBeenCalledWith(['A', 'C', 'B'], 'B')
  })

  it('bricht den Langdruck bei einem waagerechten Wisch ab', () => {
    const { drag } = aufbau()
    const handler = drag().getRowHandlers('B', 1)

    act(() => {
      handler.onPointerDown(zeiger(0, 70))
      handler.onPointerMove(zeiger(60, 70))
      vi.advanceTimersByTime(450)
    })

    expect(drag().draggingId).toBeNull()
  })

  it('beendet ohne Wirkung, wenn die Zeigeraufnahme verloren geht', () => {
    const { onReorder, drag } = aufbau()
    const handler = aufnehmen(drag)

    act(() => {
      handler.onPointerMove(zeiger(0, 130))
      handler.onLostPointerCapture()
    })

    expect(onReorder).not.toHaveBeenCalled()
    expect(drag().draggingId).toBeNull()
  })
})
