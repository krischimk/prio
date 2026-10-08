import { useCallback, useEffect, useRef, useState, type PointerEvent, type RefObject } from 'react'

/**
 * Umsortieren per Langdruck und Ziehen.
 *
 * Ablauf:
 *   1. Finger auflegen. Es passiert zunächst nichts – Wischen soll weiterhin
 *      die Liste scrollen.
 *   2. Bewegt sich der Finger vorher um mehr als ein paar Pixel (in **beide**
 *      Richtungen), war es ein Wischen und der Langdruck wird verworfen.
 *   3. Nach `longPressMs` ohne Bewegung wird die Zeile „aufgenommen": Sie folgt
 *      dem Finger, und ab hier wird das Scrollen unterbunden.
 *   4. Nähert sich der Finger dem oberen oder unteren Rand, scrollt die Liste
 *      mit – sonst ließe sich nur innerhalb des sichtbaren Bereichs umsortieren.
 *   5. Loslassen setzt die neue Reihenfolge.
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

/**
 * Bewegung, ab der ein begonnener Langdruck als Wischen gilt.
 *
 * Bewusst kleiner als die Scroll-Schwelle des Browsers (rund 10 px): Bewegt
 * sich der Finger mehr als das, beginnt der Browser zu scrollen und schickt
 * `pointercancel` – der Langdruck wäre dann ohnehin vorbei, nur später und mit
 * einem Aufblitzen der Einfügelinie.
 */
const MOVE_TOLERANCE_PX = 6
/** Zone am Fensterrand, in der beim Ziehen mitgescrollt wird. */
const AUTOSCROLL_ZONE_PX = 72
/** Wie weit je Bewegung gescrollt wird, wenn der Finger in der Randzone ist. */
const AUTOSCROLL_STEP_PX = 12

export interface RowDragHandlers {
  onPointerDown: (event: PointerEvent<HTMLElement>) => void
  onPointerMove: (event: PointerEvent<HTMLElement>) => void
  onPointerUp: (event: PointerEvent<HTMLElement>) => void
  onPointerCancel: (event: PointerEvent<HTMLElement>) => void
  /** Die Zeigeraufnahme ging verloren – das Ziehen endet dann ohne Wirkung. */
  onLostPointerCapture: () => void
  onContextMenu: (event: { preventDefault: () => void }) => void
}

export interface ReorderDrag {
  /** Id der aufgenommenen Aufgabe oder `null`. */
  draggingId: string | null
  /** Kennung der Zeile, **vor** der die Einfügelinie steht. */
  dropBeforeId: string | null
  /** `true`, wenn die Linie ans Ende der Liste gehört. */
  dropAtEnd: boolean
  /** Der Bereich, in den die Aufgabe gerät – für die Hervorhebung seines Kopfes. */
  dropSectionId: string | null
  /** Versatz der gezogenen Zeile in Pixeln. */
  offsetY: number
  getRowHandlers: (id: string, index: number) => RowDragHandlers
  /** `true`, wenn soeben gezogen wurde – dann den Klick unterdrücken. */
  wasDragging: () => boolean
}

/** Ein Platz in der Liste: eine Aufgabenzeile oder der Kopf eines Bereichs. */
export interface Slot {
  art: 'zeile' | 'kopf'
  top: number
  height: number
  id: string
  /** Der Bereich, zu dem der Platz gehört – `null` heißt „ohne Bereich". */
  abschnittId: string | null
}

/** Wohin eine gezogene Aufgabe fällt. */
export interface Ziel {
  /** Einfügeindex in der Liste **ohne** die gezogene Aufgabe. */
  stelle: number
  /** Der Bereich, in den sie dabei gerät. */
  abschnittId: string | null
}

/**
 * Das Ziel aus den Zeilenmitten – **ohne** die gezogene Zeile.
 *
 * Gezählt wird, an wie vielen Mittellinien **anderer** Zeilen der Finger vorbei
 * ist. Das ist zugleich der Index, an dem die Aufgabe in der Liste ohne sie
 * eingefügt wird.
 *
 * Vorher war die eigene Zeile mit dabei, und das war der Fehler: Sobald der
 * Finger die eigene Zeilenmitte verließ, galt schon der nächste Platz als Ziel.
 * Die Aufgabe sprang bei der kleinsten Bewegung eine Position weiter und ließ
 * sich an ihrem Platz kaum wieder ablegen.
 *
 * Der **Bereich** kommt aus der Geometrie, nicht aus dem Nachbarn: Steht der
 * Finger auf einem Bereichskopf, gehört die Aufgabe in dessen Bereich. Das ist
 * der einzige Weg in einen **leeren** oder **zugeklappten** Bereich – dort gibt
 * es keine Zeile, an der sich das Ziel ablesen ließe.
 */
export function zielAusSlots(slots: Slot[], draggedIndex: number, clientY: number): Ziel {
  const gezogeneId = slots[draggedIndex]?.art === 'zeile' ? slots[draggedIndex]?.id : undefined

  // 1) Wie viele andere Zeilenmitten liegen oberhalb des Fingers?
  let stelle = 0
  let zeilenGesehen = 0
  for (let i = 0; i < slots.length; i += 1) {
    const slot = slots[i]
    if (!slot || slot.art !== 'zeile') continue
    if (slot.id === gezogeneId) continue
    if (clientY < slot.top + slot.height / 2) break
    stelle += 1
    zeilenGesehen += 1
  }
  void zeilenGesehen

  // 2) Der Bereich: ein Kopf unter dem Finger gewinnt, sonst die nächste Zeile
  //    darunter, sonst die letzte Zeile darüber.
  const kopfUnterFinger = slots.find(
    (slot) => slot.art === 'kopf' && clientY >= slot.top && clientY < slot.top + slot.height,
  )
  if (kopfUnterFinger) {
    return { stelle, abschnittId: kopfUnterFinger.abschnittId }
  }

  const zeilen = slots.filter((slot) => slot.art === 'zeile' && slot.id !== gezogeneId)
  const naechste = zeilen.find((slot) => clientY < slot.top + slot.height / 2)
  const letzte = [...zeilen].reverse().find((slot) => slot.top <= clientY)
  return {
    stelle,
    abschnittId: (naechste ?? letzte)?.abschnittId ?? null,
  }
}

export function useReorderDrag(options: {
  itemIds: string[]
  /**
   * Die neue Reihenfolge und die Kennung der gezogenen Aufgabe – der Aufrufer
   * braucht sie, um den Zielabschnitt zu bestimmen.
   */
  onReorder: (orderedIds: string[], draggedId: string, abschnittId: string | null) => void
  containerRef: RefObject<HTMLElement | null>
  longPressMs?: number
}): ReorderDrag {
  const { itemIds, onReorder, containerRef, longPressMs = 400 } = options

  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [ziel, setZiel] = useState<number | null>(null)
  const [abschnitt, setAbschnitt] = useState<string | null>(null)
  const [offsetY, setOffsetY] = useState(0)

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const didDrag = useRef(false)
  /** Position des aufgelegten Fingers, solange noch nicht aufgenommen wurde. */
  const press = useRef<{ startX: number; startY: number } | null>(null)
  const drag = useRef<{
    id: string
    index: number
    startY: number
    slots: Slot[]
  } | null>(null)
  /**
   * Das Ziel liegt **auch** als Ref vor.
   *
   * `pointerup` folgt oft unmittelbar auf das letzte `pointermove`, ohne dass
   * React dazwischen neu rendert; aus dem Zustand gelesen wäre es dann der
   * vorige Wert – die Aufgabe landete woanders, als die Linie zeigte.
   */
  const zielRef = useRef<number | null>(null)
  /** Der Zielbereich aus der Geometrie – beim Loslassen maßgeblich. */
  const abschnittRef = useRef<string | null>(null)
  /** Wie weit beim Ziehen mitgescrollt wurde (die Zeilenlagen verschieben sich). */
  const scrollDelta = useRef(0)
  /** Letzte Fingerposition – die Scroll-Schleife liest sie, ohne neu zu rendern. */
  const letzteY = useRef(0)
  const scrollLoop = useRef<number | null>(null)

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
    if (scrollLoop.current !== null) {
      window.cancelAnimationFrame(scrollLoop.current)
      scrollLoop.current = null
    }
    press.current = null
    drag.current = null
    zielRef.current = null
    abschnittRef.current = null
    scrollDelta.current = 0
    setDraggingId(null)
    setZiel(null)
    setAbschnitt(null)
    setOffsetY(0)
  }, [clearTimer])

  useEffect(() => reset, [reset])

  /** Unterbindet das Scrollen, solange gezogen wird. */
  const blockScroll = useCallback((event: TouchEvent) => {
    if (event.cancelable) event.preventDefault()
  }, [])

  /**
   * Ein Schritt mit Scrollen, wenn der Finger am Rand steht.
   *
   * Ohne das ließe sich eine Aufgabe nur innerhalb des sichtbaren Ausschnitts
   * verschieben – bei längeren Listen die häufigste Beschwerde. Die gemerkten
   * Zeilenlagen wandern mit, sonst zeigte die Linie nach dem ersten Scrollen
   * auf die falsche Stelle.
   */
  const scrollSchritt = useCallback(() => {
    const current = drag.current
    if (!current) return

    const y = letzteY.current
    const oben = y < AUTOSCROLL_ZONE_PX
    const unten = y > window.innerHeight - AUTOSCROLL_ZONE_PX
    if (!oben && !unten) return

    const vorher = window.scrollY
    window.scrollBy(0, oben ? -AUTOSCROLL_STEP_PX : AUTOSCROLL_STEP_PX)
    const gescrollt = window.scrollY - vorher
    if (gescrollt === 0) return

    // Neu aufbauen statt in place zu ändern: Der Wert steckt in einem Ref, und
    // Reacts Regel gegen Veränderung hat recht – ein neues Feld ist klarer.
    drag.current = {
      ...current,
      slots: current.slots.map((slot) => ({ ...slot, top: slot.top - gescrollt })),
    }
    scrollDelta.current += gescrollt
  }, [])

  const startDragging = useCallback(
    (id: string, index: number, startY: number, element: HTMLElement, pointerId: number) => {
      const container = containerRef.current
      const elemente = container
        ? Array.from(
            container.querySelectorAll<HTMLElement>('[data-task-row], [data-section-id]'),
          )
        : []

      press.current = null
      drag.current = {
        id,
        index,
        startY,
        /*
         * Lagen und Höhen einmalig festhalten: Die Zeilen sind unterschiedlich
         * hoch (Beschreibung, Fälligkeit), eine feste Zeilenhöhe würde nicht
         * genügen. Beim mitscrollenden Ziehen werden sie mitgeführt.
         *
         * Bereichsköpfe gehören dazu: Nur über sie lässt sich in einen leeren
         * oder zugeklappten Bereich ziehen – dort gibt es keine Zeile, an der
         * sich das Ziel ablesen ließe.
         */
        slots: elemente.map((element) => {
          const rect = element.getBoundingClientRect()
          const istZeile = element.hasAttribute('data-task-row')
          return {
            art: istZeile ? ('zeile' as const) : ('kopf' as const),
            top: rect.top,
            height: rect.height,
            id: istZeile ? (element.dataset.id ?? '') : (element.dataset.sectionId ?? ''),
            abschnittId: element.dataset.sectionId ?? null,
          }
        }),
      }
      zielRef.current = index
      abschnittRef.current = null
      // Die Linie erscheint erst, wenn sich der Finger bewegt: Beim Aufnehmen
      // blitzte sie sonst kurz auf, ohne etwas zu sagen.
      setZiel(null)
      setAbschnitt(null)
      scrollDelta.current = 0
      didDrag.current = true
      setDraggingId(id)
      setOffsetY(0)

      // Zeiger einfangen: So kommen Bewegungen weiter an, auch wenn der Finger
      // die Zeile verlässt.
      try {
        element.setPointerCapture(pointerId)
      } catch {
        // Nicht jede Umgebung unterstützt Pointer-Capture – kein Grund abzubrechen.
      }
      document.addEventListener('touchmove', blockScroll, { passive: false })
      letzteY.current = startY

      /*
       * Die Schleife läuft, solange gezogen wird – **nicht** nur bei Bewegung.
       * Sonst müsste man am Rand wackeln, damit es weitergeht: Wer den Finger
       * still am unteren Rand hält, erwartet, dass die Liste weiterläuft. Sie
       * setzt zugleich das Ziel neu, weil sich nach dem Scrollen die Zeilenlagen
       * verschoben haben.
       */
      const tick = () => {
        const laufend = drag.current
        if (laufend === null) {
          scrollLoop.current = null
          return
        }
        scrollSchritt()

        const ziel = zielAusSlots(laufend.slots, laufend.index, letzteY.current)
        zielRef.current = ziel.stelle
        abschnittRef.current = ziel.abschnittId
        setZiel((bisher) => (bisher === ziel.stelle ? bisher : ziel.stelle))
        setAbschnitt((bisher) => (bisher === ziel.abschnittId ? bisher : ziel.abschnittId))
        setOffsetY(letzteY.current - laufend.startY + scrollDelta.current)

        scrollLoop.current = window.requestAnimationFrame(tick)
      }
      scrollLoop.current = window.requestAnimationFrame(tick)
    },
    [blockScroll, containerRef, scrollSchritt],
  )

  const endDragging = useCallback(
    (commit: boolean) => {
      document.removeEventListener('touchmove', blockScroll)
      const current = drag.current
      const stelle = zielRef.current

      if (commit && current && stelle !== null) {
        const andere = itemIdsRef.current.filter((id) => id !== current.id)
        const next = [...andere.slice(0, stelle), current.id, ...andere.slice(stelle)]

        /*
         * Geschrieben wird, wenn sich **etwas** ändert – die Reihenfolge oder
         * der Bereich.
         *
         * Nur auf die Reihenfolge zu sehen war der Fehler beim Verschieben in
         * einen anderen Bereich: Ändert sich der Bereich, die Stelle aber
         * nicht (die Aufgabe bleibt an ihrem Platz in der flachen Liste), galt
         * das als „nichts zu tun" – die Aufgabe blieb, wo sie war.
         */
        const vorherAbschnitt =
          current.slots.find((slot) => slot.art === 'zeile' && slot.id === current.id)
            ?.abschnittId ?? null
        const reihenfolgeGleich =
          next.join('\u0000') === itemIdsRef.current.join('\u0000') &&
          abschnittRef.current === vorherAbschnitt

        if (!reihenfolgeGleich) {
          onReorderRef.current(next, current.id, abschnittRef.current)
        }
      }

      reset()
    },
    [blockScroll, reset],
  )

  const getRowHandlers = useCallback(
    (id: string, index: number): RowDragHandlers => ({
      onPointerDown: (event) => {
        // Nur die primäre Maustaste; Touch und Stift sind immer gemeint.
        if (event.pointerType === 'mouse' && event.button !== 0) return
        // Ein zweiter Finger darf den laufenden Vorgang nicht übernehmen.
        if (drag.current !== null || press.current !== null) return

        didDrag.current = false
        const element = event.currentTarget
        const startY = event.clientY
        const pointerId = event.pointerId

        press.current = { startX: event.clientX, startY }
        clearTimer()
        timer.current = setTimeout(() => {
          timer.current = null
          startDragging(id, index, startY, element, pointerId)
        }, longPressMs)
      },

      onPointerMove: (event) => {
        const current = drag.current

        if (!current) {
          // Noch nicht aufgenommen: Deutliche Bewegung heißt Wischen – auch
          // seitwärts, sonst bliebe ein waagerechter Wisch ein Langdruck.
          const pressed = press.current
          if (
            pressed &&
            timer.current !== null &&
            (Math.abs(event.clientY - pressed.startY) > MOVE_TOLERANCE_PX ||
              Math.abs(event.clientX - pressed.startX) > MOVE_TOLERANCE_PX)
          ) {
            clearTimer()
            press.current = null
          }
          return
        }

        // Das Ziel setzt die Schleife (`scrollTick`) – so gilt dieselbe Rechnung
        // mit und ohne Scrollen.
        letzteY.current = event.clientY
        const ziel = zielAusSlots(current.slots, current.index, event.clientY)
        zielRef.current = ziel.stelle
        abschnittRef.current = ziel.abschnittId
        setZiel(ziel.stelle)
        setAbschnitt(ziel.abschnittId)
        setOffsetY(event.clientY - current.startY + scrollDelta.current)
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

      onLostPointerCapture: () => {
        // Ohne Aufnahme kämen keine Bewegungen mehr an – die Zeile bliebe
        // „aufgenommen" hängen. Deshalb hier beenden, ohne zu schreiben.
        if (drag.current) endDragging(false)
      },

      onContextMenu: (event) => event.preventDefault(),
    }),
    [clearTimer, endDragging, longPressMs, startDragging],
  )

  // Die Linie gehört **vor** die Zeile, die im Ergebnis an dieser Stelle steht.
  const andereIds = draggingId === null ? [] : itemIds.filter((eintrag) => eintrag !== draggingId)
  const dropBeforeId = ziel === null ? null : (andereIds[ziel] ?? null)
  const dropAtEnd = ziel !== null && ziel >= andereIds.length

  return {
    draggingId,
    dropBeforeId,
    dropAtEnd,
    dropSectionId: draggingId === null ? null : abschnitt,
    offsetY,
    getRowHandlers,
    wasDragging: () => didDrag.current,
  }
}
