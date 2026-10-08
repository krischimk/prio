import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'

/**
 * Ziehen per Langdruck – mit **Vorschau statt Einfügestrich**.
 *
 * Vorbild sind `useSortable` aus dnd-kit und das Animationssystem von
 * SortableJS: Während des Ziehens nimmt die Liste schon die Reihenfolge an, die
 * beim Loslassen entstünde. Die gezogene Aufgabe hängt als Kopie unter dem
 * Finger, an ihrem Platz bleibt eine blasse Lücke.
 *
 * Fünf Regeln, jede aus einem Fehler:
 *
 * 1. **Die gezogene Zeile zählt nicht mit.** Sonst galt die nächste Zeile schon
 *    als Ziel, sobald der Finger die eigene Mitte verließ.
 * 2. **Aufnehmen an der Zeile, alles Weitere am Fenster.** Lagen die Bewegungen
 *    an der Zeile (über `setPointerCapture`), verlor sie sie beim Neuzeichnen –
 *    der Zug stand still, ohne dass etwas zu sehen war.
 * 3. **Die Maße werden beim Aufnehmen festgehalten, nicht live gelesen.** Live
 *    gemessen entstand eine Schleife: Die Vorschau ordnet die Liste um, dadurch
 *    ändern sich die Zeilenlagen, dadurch das Ziel, dadurch die Vorschau – am
 *    Ende stand wieder die alte Reihenfolge.
 * 4. **Ziehflächen haben keine Textauswahl.** Ein Langdruck startete sonst die
 *    Auswahl, der Browser übernahm die Geste und schickte `pointercancel`.
 * 5. **Ein Systemabbruch verliert den Zug nicht.** Was sichtbar gezogen wurde,
 *    wird beim Abbruch übernommen.
 */

/** Der Schlüssel der Gruppe ohne Bereich. */
export const OHNE_BEREICH = 'ohne-bereich'

/** Bewegung, ab der ein begonnener Langdruck als Wischen gilt. */
const MOVE_TOLERANCE_PX = 6

/** Ab wann ein abgebrochener Zug als Absicht gilt und übernommen wird. */
const CANCELLED_COMMIT_AFTER_MS = 250

/**
 * Wie lange ein Druck dauern muss, bis er ein Zug ist – normalerweise 400 ms.
 *
 * Fuer Tests laesst sich der Wert ueber `prio:langdruck-ms` im lokalen
 * Speicher setzen. Grund: Chromium drosselt Zeitgeber in Seiten ohne
 * Vordergrund auf etwa eine Sekunde, wodurch ein Test mit 400 ms schwankte.
 * Ein Test, der auf das *Ergebnis* wartet, bleibt richtig – mit einem kleinen
 * Wert wartet er nur kurz. Im Betrieb ist der Wert immer 400.
 */
function langdruckAusSpeicher(): number {
  try {
    const wert = Number(window.localStorage.getItem('prio:langdruck-ms'))
    if (Number.isFinite(wert) && wert > 0) return wert
  } catch {
    // Ohne lokalen Speicher (etwa im Test ohne Fenster) bleibt es beim Standard.
  }
  return 400
}

/** Zone am Fensterrand, in der beim Ziehen mitgescrollt wird. */
const AUTOSCROLL_ZONE_PX = 72
const AUTOSCROLL_STEP_PX = 12

/** Ein Gruppenkopf, wie ihn die Geometrie braucht. */
export interface KopfGeometrie {
  gruppe: string
  top: number
}

/** Eine Aufgabenzeile, wie sie die Geometrie braucht. */
export interface ZeilenGeometrie {
  id: string
  gruppe: string
  top: number
  height: number
}

export interface Ziel {
  gruppe: string
  index: number
}

/**
 * Das Ziel aus der Geometrie: die Gruppe unter dem Finger und der Platz darin.
 *
 * Die **Gruppe** ist die des letzten Kopfes über dem Finger – unter dem letzten
 * Kopf gehört also der ganze leere Raum bis zum Ende zu seinem Bereich. Genau das
 * fehlte: Vorher musste man auf dem Kopf loslassen, und hinter dem letzten Kopf
 * blieb die Aufgabe in ihrem alten Bereich.
 *
 * Der **Platz** zählt die Mittellinien der Zeilen dieser Gruppe, die über dem
 * Finger liegen – **ohne** die gezogene Zeile.
 */
export function zielAusGeometrie({
  koepfe,
  zeilen,
  gezogeneId,
  clientY,
}: {
  koepfe: KopfGeometrie[]
  zeilen: ZeilenGeometrie[]
  gezogeneId: string
  clientY: number
}): Ziel {
  let gruppe = koepfe[0]?.gruppe ?? OHNE_BEREICH
  for (const kopf of koepfe) {
    if (kopf.top <= clientY) gruppe = kopf.gruppe
  }

  const inGruppe = zeilen.filter((zeile) => zeile.gruppe === gruppe && zeile.id !== gezogeneId)
  let index = 0
  for (const zeile of inGruppe) {
    if (clientY < zeile.top + zeile.height / 2) break
    index += 1
  }
  return { gruppe, index }
}

export interface RowDragHandlers {
  onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void
  onContextMenu: (event: { preventDefault: () => void }) => void
}

export interface ReorderDrag {
  /** Die Kennung der gerade gezogenen Aufgabe. */
  draggingId: string | null
  /** Wohin sie beim Loslassen käme – `null`, solange nicht gezogen wird. */
  ziel: Ziel | null
  /** Die Kopie unter dem Finger (fest im Fenster, in Pixeln). */
  klon: { left: number; top: number; width: number } | null
  getRowHandlers: (id: string) => RowDragHandlers
  /** `true`, wenn der letzte Zeigerdruck ein Zug war – dann keinen Klick auslösen. */
  wasDragging: () => boolean
}

export function useReorderDrag({
  onDrop,
  containerRef,
  longPressMs,
}: {
  /**
   * Wird beim Loslassen mit dem Ziel gerufen. Ob sich dadurch etwas ändert,
   * entscheidet die Liste – sie kennt die Aufgaben und ihre Gruppen.
   */
  onDrop: (draggedId: string, gruppe: string, index: number) => void
  containerRef: { current: HTMLElement | null }
  /** Abweichende Wartezeit – sonst gilt der Wert aus dem Speicher bzw. 400 ms. */
  longPressMs?: number
}): ReorderDrag {
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [ziel, setZiel] = useState<Ziel | null>(null)
  const [klon, setKlon] = useState<{ left: number; top: number; width: number } | null>(null)

  /*
   * Die aktuellen Werte in Refs spiegeln – aber **in einem Effekt**, nicht beim
   * Rendern: Ein Ref beim Rendern zu schreiben ist genau das, wovor React warnt
   * (das Neuzeichnen kann ausbleiben). Gelesen werden sie nur in Ereignissen.
   */
  const onDropRef = useRef(onDrop)
  const containerRefRef = useRef(containerRef)
  useEffect(() => {
    onDropRef.current = onDrop
    containerRefRef.current = containerRef
  }, [containerRef, onDrop])

  const press = useRef<{ id: string; startX: number; startY: number } | null>(null)
  const drag = useRef<{ id: string; gehobenUm: number; griffVersatz: number } | null>(null)
  const zielRef = useRef<Ziel | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const letzteY = useRef(0)
  const scrollLoop = useRef<number | null>(null)
  const didDrag = useRef(false)
  /** Meldet die Zuhoerer am Fenster wieder ab. */
  const fenster = useRef<(() => void) | null>(null)
  /** Die beim Aufnehmen festgehaltenen Maße. */
  const geometrie = useRef<{ koepfe: KopfGeometrie[]; zeilen: ZeilenGeometrie[] }>({
    koepfe: [],
    zeilen: [],
  })

  const clearTimer = useCallback(() => {
    if (timer.current !== null) {
      clearTimeout(timer.current)
      timer.current = null
    }
  }, [])

  const stoppeScroll = useCallback(() => {
    if (scrollLoop.current !== null) {
      window.cancelAnimationFrame(scrollLoop.current)
      scrollLoop.current = null
    }
  }, [])

  /** Hält den Browser aus dem Zug heraus – nur, solange gezogen wird. */
  const blockScroll = useCallback((event: TouchEvent) => {
    if (drag.current !== null && event.cancelable) event.preventDefault()
  }, [])

  const reset = useCallback(() => {
    clearTimer()
    stoppeScroll()
    fenster.current?.()
    fenster.current = null
    press.current = null
    drag.current = null
    zielRef.current = null
    setDraggingId(null)
    setZiel(null)
    setKlon(null)
  }, [clearTimer, stoppeScroll])

  useEffect(() => {
    document.addEventListener('touchmove', blockScroll, { passive: false })
    return () => document.removeEventListener('touchmove', blockScroll)
  }, [blockScroll])

  useEffect(() => reset, [reset])

  /** Maße einsammeln – einmal beim Aufnehmen. */
  const messen = useCallback(() => {
    const container = containerRefRef.current.current
    if (!container) return

    geometrie.current = {
      koepfe: Array.from(container.querySelectorAll<HTMLElement>('[data-gruppe-kopf]')).map(
        (kopf) => ({
          gruppe: kopf.dataset.gruppeKopf ?? OHNE_BEREICH,
          top: kopf.getBoundingClientRect().top,
        }),
      ),
      zeilen: Array.from(container.querySelectorAll<HTMLElement>('[data-task-row]')).map((zeile) => {
        const rect = zeile.getBoundingClientRect()
        return {
          id: zeile.dataset.id ?? '',
          gruppe: zeile.dataset.gruppe ?? OHNE_BEREICH,
          top: rect.top,
          height: rect.height,
        }
      }),
    }
  }, [])

  /** Das Ziel aus den festgehaltenen Maßen. */
  const zielAusDom = useCallback((clientY: number): Ziel | null => {
    const current = drag.current
    if (!current) return null
    const { koepfe, zeilen } = geometrie.current
    return zielAusGeometrie({ koepfe, zeilen, gezogeneId: current.id, clientY })
  }, [])

  /** Ein Schritt Scrollen am Rand – die festgehaltenen Maße wandern mit. */
  const scrollSchritt = useCallback(() => {
    const y = letzteY.current
    const oben = y < AUTOSCROLL_ZONE_PX
    const unten = y > window.innerHeight - AUTOSCROLL_ZONE_PX
    if (!oben && !unten) return

    const vorher = window.scrollY
    window.scrollBy(0, oben ? -AUTOSCROLL_STEP_PX : AUTOSCROLL_STEP_PX)
    const gescrollt = window.scrollY - vorher
    if (gescrollt === 0) return

    geometrie.current = {
      koepfe: geometrie.current.koepfe.map((kopf) => ({ ...kopf, top: kopf.top - gescrollt })),
      zeilen: geometrie.current.zeilen.map((zeile) => ({ ...zeile, top: zeile.top - gescrollt })),
    }
  }, [])

  /** Neu berechnen, was der Finger gerade bedeutet. */
  const aktualisiereZiel = useCallback(() => {
    const neu = zielAusDom(letzteY.current)
    if (!neu) return
    zielRef.current = neu
    setZiel((bisher) =>
      bisher && bisher.gruppe === neu.gruppe && bisher.index === neu.index ? bisher : neu,
    )
  }, [zielAusDom])

  const gezogenLangeGenug = useCallback(() => {
    const current = drag.current
    return current !== null && Date.now() - current.gehobenUm > CANCELLED_COMMIT_AFTER_MS
  }, [])

  const endDragging = useCallback(
    (commit: boolean) => {
      const current = drag.current
      const ziel = zielRef.current
      reset()

      if (!commit || !current || !ziel) return
      onDropRef.current(current.id, ziel.gruppe, ziel.index)
    },
    [reset],
  )

  const startDragging = useCallback(
    (element: HTMLElement, id: string, startY: number, pointerId: number) => {
      const rect = element.getBoundingClientRect()
      messen()

      press.current = null
      drag.current = { id, gehobenUm: Date.now(), griffVersatz: startY - rect.top }
      didDrag.current = true
      letzteY.current = startY
      zielRef.current = null

      setDraggingId(id)
      setZiel(null)
      setKlon({ left: rect.left, top: rect.top, width: rect.width })

      const bewegen = (event: PointerEvent) => {
        if (event.pointerId !== pointerId || drag.current === null) return
        letzteY.current = event.clientY
        const versatz = drag.current.griffVersatz
        setKlon((bisher) =>
          bisher === null ? bisher : { ...bisher, top: event.clientY - versatz },
        )
        aktualisiereZiel()
        // Der Browser soll während des Zuges nicht scrollen.
        if (event.cancelable) event.preventDefault()
      }

      const beenden = (abgebrochen: boolean) => (event: PointerEvent) => {
        if (event.pointerId !== pointerId) return
        fenster.current?.()
        fenster.current = null
        endDragging(abgebrochen ? gezogenLangeGenug() : true)
      }

      const loslassen = beenden(false)
      const abbrechen = beenden(true)

      window.addEventListener('pointermove', bewegen)
      window.addEventListener('pointerup', loslassen)
      window.addEventListener('pointercancel', abbrechen)
      fenster.current = () => {
        window.removeEventListener('pointermove', bewegen)
        window.removeEventListener('pointerup', loslassen)
        window.removeEventListener('pointercancel', abbrechen)
      }

      /*
       * Die Schleife läuft, solange gezogen wird – **nicht** nur bei Bewegung.
       * Sonst müsste man am Rand wackeln, damit es weitergeht.
       */
      const tick = () => {
        if (drag.current === null) {
          scrollLoop.current = null
          return
        }
        scrollSchritt()
        aktualisiereZiel()
        scrollLoop.current = window.requestAnimationFrame(tick)
      }
      scrollLoop.current = window.requestAnimationFrame(tick)
    },
    [aktualisiereZiel, endDragging, gezogenLangeGenug, messen, scrollSchritt],
  )

  const getRowHandlers = useCallback(
    (id: string): RowDragHandlers => ({
      onPointerDown: (event) => {
        // Ein zweiter Finger übernimmt keinen laufenden Zug.
        if (drag.current !== null || press.current !== null) return
        // Nur die primäre Taste (Maus) bzw. der erste Finger (Touch).
        if (event.pointerType === 'mouse' && event.button !== 0) return

        const startX = event.clientX
        const startY = event.clientY
        const pointerId = event.pointerId
        // Das Element hier greifen: Im Zeitgeber ist `event.currentTarget` leer.
        const element = event.currentTarget as unknown as HTMLElement
        clearTimer()
        press.current = { id, startX, startY }

        /*
         * Vor dem Aufnehmen beobachten: Eine deutliche Bewegung heißt Wischen –
         * auch seitwärts, sonst bliebe ein waagerechter Wisch ein Langdruck. Der
         * Zuhoerer hängt am Fenster, damit er nicht mit der Zeile verloren geht.
         */
        const abmelden = () => {
          window.removeEventListener('pointermove', wach)
          window.removeEventListener('pointerup', wachUp)
        }
        const wach = (bewegung: PointerEvent) => {
          if (bewegung.pointerId !== pointerId) return
          const pressed = press.current
          if (!pressed || timer.current === null) return
          if (
            Math.abs(bewegung.clientY - pressed.startY) > MOVE_TOLERANCE_PX ||
            Math.abs(bewegung.clientX - pressed.startX) > MOVE_TOLERANCE_PX
          ) {
            clearTimer()
            press.current = null
            abmelden()
          }
        }
        const wachUp = (ende: PointerEvent) => {
          if (ende.pointerId !== pointerId) return
          // Kurzer Druck: kein Zug.
          clearTimer()
          press.current = null
          abmelden()
        }
        window.addEventListener('pointermove', wach)
        window.addEventListener('pointerup', wachUp)

        // Erst hier lesen: So wirkt ein gesetzter Wert sofort, ohne Neuzeichnen.
        const wartezeit = longPressMs ?? langdruckAusSpeicher()
        timer.current = setTimeout(() => {
          timer.current = null
          if (press.current?.id !== id) return
          abmelden()
          startDragging(element, id, startY, pointerId)
        }, wartezeit)
      },

      // Der Langdruck darf kein Systemmenü öffnen.
      onContextMenu: (event) => {
        if (drag.current !== null) event.preventDefault()
      },
    }),
    [clearTimer, longPressMs, startDragging],
  )

  const wasDragging = useCallback(() => {
    const war = didDrag.current
    didDrag.current = false
    return war
  }, [])

  return {
    draggingId,
    ziel,
    klon,
    getRowHandlers,
    wasDragging,
  }
}
