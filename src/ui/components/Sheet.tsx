import { useEffect, useRef, type KeyboardEvent, type ReactNode } from 'react'
import { useBackLayer } from '../../app/useBackLayer'
import { layer } from '../styles'
import { CloseIcon } from '../icons'
import { IconButton } from './IconButton'

/** Alles, was den Fokus bekommen kann – für die Fokusfalle. */
const FOKUSSIERBAR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export interface SheetProps {
  /** Der Name des Dialogs für Vorleseprogramme. Fehlt er, gilt `title`. */
  label?: string
  title: ReactNode
  /** Eine Zeile unter dem Titel – etwa „Abgehakt in den letzten 7 Tagen". */
  subtitle?: ReactNode
  /** Ein Symbol vor dem Titel. */
  leading?: ReactNode
  /** Eigene Beschriftung des Schließen-Knopfs (Standard: „Schließen"). */
  closeLabel?: string
  onClose: () => void
  /**
   * Der Weg **eine Stufe** zurück – für Escape und die Zurück-Taste.
   *
   * Standard ist `onClose`. Ein Blatt mit Unterformularen (die
   * Listenverwaltung) schließt damit zuerst das Unterformular; das X und der
   * Schleier schließen dagegen immer das ganze Blatt. Vorher hing das an zwei
   * Stellen: der Schließen-Knopf rief `onClose`, die Zurück-Taste eine eigene
   * Funktion.
   */
  onBack?: () => void
  /** Bleibt am unteren Rand stehen, auch wenn der Inhalt scrollt. */
  footer?: ReactNode
  children: ReactNode
}

/**
 * Ein Blatt: auf dem Telefon fährt es von unten ein, in der breiten Ansicht
 * steht es mittig. Der Inhalt ist in beiden Fällen derselbe.
 *
 * Warum ein Bauteil und nicht vier Markups: Der Rahmen war viermal von Hand
 * geschrieben (Schleier, Ausrichtung, Höhe, Kopfzeile, Schließen-Knopf), und
 * die vier Fassungen waren schon auseinandergelaufen – eine hatte 70 % Höhe
 * statt 85 vh. Was hier außerdem **einmal** gelöst ist, statt in jedem Dialog:
 *
 *   * Rolle und Name für Vorleseprogramme (`role="dialog"`, `aria-modal`,
 *     `aria-label`) – vorher dreimal getippt, zweimal davon ohne Namen.
 *   * Zurück-Taste und Escape über den Zurück-Stapel (`useBackLayer`).
 *   * Der Fokus wandert in den Dialog, bleibt beim Tabben darin (das behauptet
 *     `aria-modal` schließlich) und geht beim Schließen dorthin zurück, wo er
 *     war.
 *   * Die Ebene über allem (`layer.screen`) – die Zahlen standen vorher an neun
 *     Stellen im Code.
 */
export function Sheet({
  label,
  title,
  subtitle,
  leading,
  closeLabel,
  onClose,
  onBack,
  footer,
  children,
}: SheetProps) {
  const panel = useRef<HTMLDivElement>(null)

  // Zurück-Taste und Escape kommen aus dem Zurück-Stapel, nicht aus diesem
  // Bauteil – und dürfen eine Stufe zurückgehen, während das X ganz schließt.
  useBackLayer(true, onBack ?? onClose)

  useEffect(() => {
    const vorher = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const bereich = panel.current
    // Der Rahmen bekommt den Fokus – nicht der erste Knopf: Sonst wäre der
    // Schließen-Knopf vorbelegt, und ein versehentliches Enter schlösse den
    // Dialog. Ein Feld mit `autoFocus` hat den Fokus schon und behält ihn.
    if (bereich && !bereich.contains(document.activeElement)) {
      bereich.focus()
    }
    return () => vorher?.focus?.()
  }, [])

  const tabFalle = (event: KeyboardEvent<HTMLDivElement>) => {
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

  return (
    <div className={`fixed inset-0 ${layer.screen} flex items-end justify-center md:items-center`}>
      <div className="absolute inset-0 bg-page/60" aria-hidden="true" onClick={onClose} />

      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={label ?? (typeof title === 'string' ? title : undefined)}
        tabIndex={-1}
        onKeyDown={tabFalle}
        className="safe-bottom relative flex max-h-[85vh] w-full flex-col overflow-hidden rounded-t-sheet border-t border-line bg-surface outline-none md:max-w-lg md:rounded-sheet md:border"
      >
        <header className="flex items-start justify-between gap-2 border-b border-line px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            {leading}
            <div className="min-w-0">
              <h2 className="break-words text-body font-medium text-ink">{title}</h2>
              {subtitle ? <p className="truncate text-meta text-ink-faint">{subtitle}</p> : null}
            </div>
          </div>
          <IconButton aria-label={closeLabel ?? 'Schließen'} onClick={onClose} layout="shrink-0">
            <CloseIcon />
          </IconButton>
        </header>

        <div className="scroll-area flex-1 overflow-y-auto">{children}</div>

        {footer ? <div className="px-4 pb-3 pt-2">{footer}</div> : null}
      </div>
    </div>
  )
}
