import type { ReactNode } from 'react'
import { appBackground, layer } from '../styles'
import { useDialog } from './useDialog'
import { useIsDesktop } from '../../app/useIsDesktop'

export interface ScreenProps {
  /** Der Name des Dialogs für Vorleseprogramme. */
  label: string
  onClose: () => void
  onBack?: () => void
  /** Name der Ebene im Zurück-Stapel. */
  name?: string
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
export function Screen({ label, onClose, onBack, name = 'flaeche', header, children }: ScreenProps) {
  const { panel, onKeyDown } = useDialog<HTMLDivElement>({ onClose, onBack, name })
  const isDesktop = useIsDesktop()

  return (
    <div className={`fixed inset-0 ${layer.screen} flex ${isDesktop ? 'items-center justify-center p-6' : ''}`}>
    {isDesktop ? <div className="absolute inset-0 bg-page/70 backdrop-blur-sm" aria-hidden="true" onClick={onClose} /> : null}
    <div
      ref={panel}
      role="dialog"
      aria-modal="true"
      aria-label={label}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      className={`relative flex min-h-0 w-full flex-col outline-none ${appBackground} ${isDesktop ? 'max-h-[90dvh] max-w-2xl overflow-hidden rounded-sheet border border-line shadow-2xl shadow-page/50' : 'h-dvh'}`}
    >
      {header}
      {children}
    </div>
    </div>
  )
}
