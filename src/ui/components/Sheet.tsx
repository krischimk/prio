import type { ReactNode } from 'react'
import { useIsDesktop } from '../../app/useIsDesktop'
import { layer } from '../styles'
import { CloseIcon } from '../icons'
import { IconButton } from './IconButton'
import { useDialog } from './useDialog'

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
  /** Name der Ebene im Zurück-Stapel – etwa `aufgabe-verschieben`. */
  name?: string
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
 * statt 85 vh.
 *
 * Das **Verhalten** (Rolle und Name für Vorleseprogramme, Escape und
 * Zurück-Taste, Fokus hinein/darin/zurück) liegt in `useDialog` und wird mit
 * `Screen` geteilt; die Ebene über allem kommt aus `layer.screen` statt als
 * Zahl an neun Stellen im Code.
 */
export function Sheet({
  label,
  title,
  subtitle,
  leading,
  closeLabel,
  name = 'blatt',
  onClose,
  onBack,
  footer,
  children,
}: SheetProps) {
  const { panel, onKeyDown } = useDialog<HTMLDivElement>({ onClose, onBack, name })
  /*
   * Die Form folgt **einer** Entscheidung: derselben, die auch die Ansicht
   * wählt (`useIsDesktop`). Vorher stand hier `md:` – eine zweite Schwelle
   * (768 px), während die App die breite Ansicht erst ab 1024 px nimmt. Ein
   * Telefon im Querformat bekam damit die mobile Ansicht mit einem mittig
   * stehenden „Blatt“.
   */
  const isDesktop = useIsDesktop()

  return (
    <div
      className={`fixed inset-0 ${layer.screen} flex justify-center ${
        isDesktop ? 'items-center' : 'items-end'
      }`}
    >
      <div className="absolute inset-0 bg-page/60" aria-hidden="true" onClick={onClose} />

      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={label ?? (typeof title === 'string' ? title : undefined)}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        className={`safe-bottom relative flex max-h-[85vh] w-full flex-col overflow-hidden bg-surface outline-none ${
          isDesktop ? 'max-w-lg rounded-sheet border border-line' : 'rounded-t-sheet border-t border-line'
        }`}
      >
        <header className="flex items-start justify-between gap-2 border-b border-line px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            {leading}
            <div className="min-w-0">
              <h2 className="break-words text-body font-medium text-ink">{title}</h2>
              {subtitle ? (
                <p
                  className="truncate text-meta text-ink-faint"
                  title={typeof subtitle === 'string' ? subtitle : undefined}
                >
                  {subtitle}
                </p>
              ) : null}
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
