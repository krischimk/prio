import { useEffect, useRef, type KeyboardEvent, type RefObject } from 'react'
import { useBackLayer } from '../../app/useBackLayer'

/** Alles, was den Fokus bekommen kann – für die Fokusfalle. */
const FOKUSSIERBAR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

// Verschachtelte Dialoge können denselben Hintergrund sperren. Erst wenn die
// letzte Ebene schließt, gilt wieder der ursprüngliche Zustand.
const backgroundLocks = new WeakMap<HTMLElement, { count: number; previous: boolean }>()

function lockBackground(panel: HTMLElement): () => void {
  const locked: HTMLElement[] = []
  let branch = panel
  while (branch.parentElement) {
    for (const sibling of branch.parentElement.children) {
      if (!(sibling instanceof HTMLElement) || sibling === branch || sibling.tagName === 'SCRIPT' || sibling.getAttribute('aria-hidden') === 'true') continue
      const lock = backgroundLocks.get(sibling) ?? { count: 0, previous: sibling.inert }
      lock.count += 1
      backgroundLocks.set(sibling, lock)
      sibling.inert = true
      locked.push(sibling)
    }
    branch = branch.parentElement
    if (branch === document.body) break
  }
  return () => {
    for (const element of locked) {
      const lock = backgroundLocks.get(element)!
      lock.count -= 1
      if (lock.count === 0) {
        element.inert = lock.previous
        backgroundLocks.delete(element)
      }
    }
  }
}

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
    const focusKey = vorher?.dataset.focusKey
    const bereich = panel.current
    // Der Rahmen bekommt den Fokus – nicht der erste Knopf: Sonst wäre der
    // Schließen-Knopf vorbelegt, und ein versehentliches Enter schlösse den
    // Dialog.
    if (bereich && !bereich.contains(document.activeElement)) {
      bereich.focus()
    }
    const unlock = bereich ? lockBackground(bereich) : () => {}
    return () => {
      unlock()
      if (vorher?.isConnected) vorher.focus()
      else if (focusKey) {
        // Nach einem Breitenwechsel ist der ursprüngliche Knopf unmontiert.
        // Sein fachlich gleicher Gegenpart erhält den Fokus.
        const counterpart = [...document.querySelectorAll<HTMLElement>('[data-focus-key]')].find(element => element.dataset.focusKey === focusKey)
        counterpart?.focus()
      }
    }
  }, [active])

  const onKeyDown = (event: KeyboardEvent<T>) => {
    if (event.key !== 'Tab' || !panel.current) return
    // Bewusst ohne Sichtbarkeitsfilter: In einem Dialog ist der Inhalt sichtbar,
    // und `offsetParent`/`getClientRects` sind in jsdom leer – die Prüfung wäre
    // dort immer falsch und ließe sich nicht testen.
    const elemente = [...panel.current.querySelectorAll<HTMLElement>(FOKUSSIERBAR)]
    if (elemente.length === 0) {
      event.preventDefault()
      panel.current.focus()
      return
    }
    const erstes = elemente[0]
    const letztes = elemente[elemente.length - 1]
    const aufRahmen = document.activeElement === panel.current
    if (event.shiftKey && (document.activeElement === erstes || aufRahmen)) {
      event.preventDefault()
      letztes.focus()
    } else if (!event.shiftKey && (document.activeElement === letztes || aufRahmen)) {
      event.preventDefault()
      erstes.focus()
    }
  }

  return { panel, onKeyDown }
}
