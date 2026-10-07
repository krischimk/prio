import type { ReactNode } from 'react'
import { appBackground, layer } from '../styles'
import { useDialog } from './useDialog'

export interface ScreenProps {
  /** Der Name des Dialogs für Vorleseprogramme. */
  label: string
  onClose: () => void
  onBack?: () => void
  /**
   * Die eigene Kopfleiste. Anders als beim Blatt trägt sie hier alles, was den
   * Bildschirm abschließt (Schließen, Speichern, Löschen) – sie ist der
   * einzige Ort, der immer sichtbar bleibt.
   */
  header: ReactNode
  children: ReactNode
}

/**
 * Eine ganze Fläche statt eines Blattes.
 *
 * Für die Aufgaben-Detailansicht: Auf dem Telefon ist sie kein Dialog über der
 * Liste, sondern ein eigener Bildschirm – sie füllt die Fläche, und die
 * Kopfleiste trägt Speichern und Löschen. Das **Verhalten** ist dasselbe wie
 * beim Blatt (`useDialog`): Escape, Zurück-Taste, Fokus, Rolle und Name.
 */
export function Screen({ label, onClose, onBack, header, children }: ScreenProps) {
  const { panel, onKeyDown } = useDialog<HTMLDivElement>({ onClose, onBack })

  return (
    <div
      ref={panel}
      role="dialog"
      aria-modal="true"
      aria-label={label}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      className={`fixed inset-0 ${layer.screen} flex flex-col outline-none ${appBackground}`}
    >
      {header}
      {children}
    </div>
  )
}
