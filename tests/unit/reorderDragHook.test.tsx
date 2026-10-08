import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { OHNE_BEREICH, useReorderDrag } from '../../src/ui/mobile/useReorderDrag'

/**
 * Der Zieh-Haken (unit) – mit gestellten Maßen.
 *
 * Drei Zeilen à 50 px, Mittellinien bei 25, 75, 125, dazu ein Kopf über allen.
 */
const IDS = ['A', 'B', 'C']
const ZEILENHOEHE = 50

function aufbau({ mitZweiterGruppe = false }: { mitZweiterGruppe?: boolean } = {}) {
  const onReorder = vi.fn()
  const behaelter = document.createElement('div')
  document.body.appendChild(behaelter)

  const kopf = document.createElement('div')
  kopf.setAttribute('data-gruppe-kopf', OHNE_BEREICH)
  behaelter.appendChild(kopf)

  const zeilen = new Map<string, HTMLElement>()
  for (const id of IDS) {
    const zeile = document.createElement('div')
    zeile.setAttribute('data-task-row', '')
    zeile.setAttribute('data-id', id)
    // C gehört zur zweiten Gruppe – DOM und `gruppeVon` müssen dasselbe sagen.
    zeile.setAttribute('data-gruppe', mitZweiterGruppe && id === 'C' ? 'obst' : OHNE_BEREICH)
    behaelter.appendChild(zeile)
    zeilen.set(id, zeile)
  }

  if (mitZweiterGruppe) {
    const zweiterKopf = document.createElement('div')
    zweiterKopf.setAttribute('data-gruppe-kopf', 'obst')
    behaelter.appendChild(zweiterKopf)
  }

  const original = HTMLElement.prototype.getBoundingClientRect
  HTMLElement.prototype.getBoundingClientRect = function () {
    if (this.hasAttribute('data-gruppe-kopf')) {
      return {
        top: this.getAttribute('data-gruppe-kopf') === 'obst' ? 150 : -30,
        height: 30,
      } as DOMRect
    }
    const geschwister = this.parentElement
      ? Array.from(this.parentElement.querySelectorAll('[data-task-row]'))
      : []
    return { top: Math.max(0, geschwister.indexOf(this)) * ZEILENHOEHE, height: ZEILENHOEHE } as DOMRect
  }

  const { result, unmount } = renderHook(() =>
    useReorderDrag({
      onDrop: (draggedId, gruppe, index) => onReorder(draggedId, gruppe, index),
      containerRef: { current: behaelter },
    }),
  )

  const zeile = (id: string) => zeilen.get(id) ?? behaelter

  return {
    onReorder,
    drag: result,
    behaelter,
    /** Nur drücken – ohne die Zeit für den Langdruck vergehen zu lassen. */
    starteDruck: (id = 'B') => {
      const handler = result.current.getRowHandlers(id)
      act(() => {
        handler.onPointerDown({
          currentTarget: zeile(id),
          clientX: 0,
          clientY: 70,
          pointerId: 1,
          button: 0,
          pointerType: 'touch',
        } as never)
      })
    },
    /** Langdruck aufnehmen: drücken und die Zeit vergehen lassen. */
    aufnehmen: (id = 'B') => {
      const handler = result.current.getRowHandlers(id)
      act(() => {
        handler.onPointerDown({
          currentTarget: zeile(id),
          clientX: 0,
          clientY: 70,
          pointerId: 1,
          button: 0,
          pointerType: 'touch',
        } as never)
      })
      act(() => {
        vi.advanceTimersByTime(500)
      })
      return handler
    },
    aufraeumen: () => {
      HTMLElement.prototype.getBoundingClientRect = original
      unmount()
      behaelter.remove()
    },
  }
}

/** Ein Zeigerereignis am Fenster – jsdom kennt PointerEvent nicht überall. */
function zeiger(art: string, y: number, pointerId = 1, x = 0) {
  const event = new Event(art, { bubbles: true, cancelable: true }) as PointerEvent
  Object.defineProperty(event, 'pointerId', { value: pointerId })
  Object.defineProperty(event, 'clientY', { value: y })
  Object.defineProperty(event, 'clientX', { value: x })
  return event
}

function bewegen(y: number) {
  act(() => {
    window.dispatchEvent(zeiger('pointermove', y))
  })
}

/** Ein Zeigerereignis mit seitlicher Bewegung. */
function zeigerMitX(x: number, y: number, pointerId = 1) {
  return zeiger('pointermove', y, pointerId, x)
}

function loslassen(art: 'pointerup' | 'pointercancel' = 'pointerup') {
  act(() => {
    window.dispatchEvent(zeiger(art, 0))
  })
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useReorderDrag', () => {
  it('meldet bei kaum Bewegung das eigene Feld als Ziel', () => {
    const { onReorder, aufnehmen, aufraeumen } = aufbau()
    aufnehmen()

    bewegen(80)
    loslassen()

    /*
     * Der Haken meldet nur das Ziel; ob sich dadurch etwas aendert, entscheidet
     * die Liste. Bleibt der Finger in der eigenen Zeile, ist das Ziel die eigene
     * Position – und die Liste schreibt nichts.
     */
    expect(onReorder).toHaveBeenCalledWith('B', OHNE_BEREICH, 1)
    aufraeumen()
  })

  it('schiebt genau eine Position, wenn die nächste Mittellinie überschritten wird', () => {
    const { onReorder, aufnehmen, aufraeumen } = aufbau()
    aufnehmen()

    bewegen(130)
    loslassen()

    expect(onReorder).toHaveBeenCalledWith('B', OHNE_BEREICH, 2)
    aufraeumen()
  })

  it('zeigt die Vorschau schon während des Ziehens', () => {
    const { drag, aufnehmen, aufraeumen } = aufbau()
    aufnehmen()

    bewegen(130)

    // Das Ziel steht schon während des Ziehens fest.
    expect(drag.current.ziel).toEqual({ gruppe: OHNE_BEREICH, index: 2 })
    expect(drag.current.klon).not.toBeNull()
    aufraeumen()
  })

  it('nimmt einen Systemabbruch nach sichtbarem Zug an, statt ihn zu verlieren', () => {
    const { onReorder, aufnehmen, aufraeumen } = aufbau()
    aufnehmen()

    bewegen(130)
    act(() => {
      vi.advanceTimersByTime(300)
    })
    loslassen('pointercancel')

    // Vorher verpuffte der Zug: Der Finger hatte sichtbar gezogen.
    expect(onReorder).toHaveBeenCalledWith('B', OHNE_BEREICH, 2)
    aufraeumen()
  })

  it('verwirft einen Abbruch direkt nach dem Aufnehmen', () => {
    const { onReorder, aufnehmen, aufraeumen } = aufbau()
    aufnehmen()

    loslassen('pointercancel')

    expect(onReorder).not.toHaveBeenCalled()
    aufraeumen()
  })

  it('zieht die Aufgabe in die Gruppe, über deren Kopf der Finger steht', () => {
    const { onReorder, aufnehmen, aufraeumen } = aufbau({ mitZweiterGruppe: true })
    aufnehmen()

    // Unter dem zweiten Kopf (ab 150) – dort ist der Bereich „obst".
    bewegen(200)
    loslassen()

    expect(onReorder).toHaveBeenCalledWith('B', 'obst', 1)
    aufraeumen()
  })

  it('bricht den Langdruck bei einem waagerechten Wisch ab', () => {
    const { drag, onReorder, aufraeumen, starteDruck } = aufbau()
    starteDruck()

    // Weit seitwärts: Das ist ein Wischen, kein Langdruck.
    act(() => {
      window.dispatchEvent(zeigerMitX(60, 70))
    })
    act(() => {
      vi.advanceTimersByTime(500)
    })
    loslassen()

    expect(drag.current.draggingId).toBeNull()
    expect(onReorder).not.toHaveBeenCalled()
    aufraeumen()
  })
})
