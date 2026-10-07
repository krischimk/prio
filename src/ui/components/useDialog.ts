import { useEffect, useRef, type KeyboardEvent, type RefObject } from 'react'
import { useBackLayer } from '../../app/useBackLayer'

/** Alles, was den Fokus bekommen kann – für die Fokusfalle. */
const FOKUSSIERBAR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export interface DialogOptions {
  /** `false` beim Menü: Es ist immer eingebunden, aber meistens zu. */
  active?: boolean
  /** Schließt den ganzen Dialog – das X und der Schleier. */
  onClose: () => void
  /** Geht **eine Stufe** zurück (Escape, Zurück-Taste); Standard ist `onClose`. */
  onBack?: () => void
  /** Name der Ebene im Zurück-Stapel (`blatt`, `flaeche`, `aufgabe-verschieben`). */
  name?: string
}

export interface DialogVerhalten<T extends HTMLElement> {
  panel: RefObject<T | null>
  onKeyDown: (event: KeyboardEvent<T>) => void
}

/**
 * Das Verhalten eines Dialogs – unabhängig von seiner Form.
 *
 * Ein Blatt (`Sheet`) und eine ganze Fläche (`Screen`) sehen verschieden aus,
 * verhalten sich aber gleich. Was hier **einmal** steht, musste vorher in jedem
 * Dialog stimmen und stimmte nicht überall:
 *
 *   * Escape und die Android-Zurück-Taste über den Zurück-Stapel – die Taste
 *     kannte vorher nur das Menü der mobilen Ansicht.
 *   * Der Fokus wandert in den Dialog, bleibt beim Tabben darin (`aria-modal`
 *     behauptet das schließlich) und geht beim Schließen dorthin zurück, wo er
 *     war. Ein Feld mit `autoFocus` behält seinen Fokus.
 *
 * Die Form bleibt beim Aufrufer: Rahmen, Schleier und Ebenen sind seine Sache.
 */
export function useDialog<T extends HTMLElement = HTMLDivElement>({
  active = true,
  onClose,
  onBack,
  name,
}: DialogOptions): DialogVerhalten<T> {
  const panel = useRef<T>(null)

  useBackLayer(active, onBack ?? onClose, name)

  useEffect(() => {
    if (!active) return
    const vorher = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const bereich = panel.current
    // Der Rahmen bekommt den Fokus – nicht der erste Knopf: Sonst wäre der
    // Schließen-Knopf vorbelegt, und ein versehentliches Enter schlösse den
    // Dialog.
    if (bereich && !bereich.contains(document.activeElement)) {
      bereich.focus()
    }
    return () => vorher?.focus?.()
  }, [active])

  const onKeyDown = (event: KeyboardEvent<T>) => {
    if (event.key !== 'Tab' || !panel.current) return
    // Bewusst ohne Sichtbarkeitsfilter: In einem Dialog ist der Inhalt sichtbar,
    // und `offsetParent`/`getClientRects` sind in jsdom leer – die Prüfung wäre
    // dort immer falsch und ließe sich nicht testen.
    const elemente = [...panel.current.querySelectorAll<HTMLElement>(FOKUSSIERBAR)]
    if (elemente.length === 0) return
    const erstes = elemente[0]
    const letztes = elemente[elemente.length - 1]
    if (event.shiftKey && document.activeElement === erstes) {
      event.preventDefault()
      letztes.focus()
    } else if (!event.shiftKey && document.activeElement === letztes) {
      event.preventDefault()
      erstes.focus()
    }
  }

  return { panel, onKeyDown }
}
