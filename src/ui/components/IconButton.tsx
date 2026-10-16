import type { ButtonHTMLAttributes } from 'react'
import { buttonClass, type ButtonVariant } from '../styles'
import { Hint } from './Hint'

/** Die Symbol-Varianten: normal, heller, zurückgenommen, aktiv. */
export type IconButtonVariant = Extract<
  ButtonVariant,
  'icon' | 'iconBright' | 'iconMuted' | 'iconActive' | 'primary' | 'danger' | 'attention'
>

/**
 * Ein Knopf, der nur ein Symbol trägt – Schließen, Menü, Synchronisation.
 *
 * Zwei Dinge sind hier **erzwungen** statt vereinbart:
 *
 *   * `aria-label` ist Pflicht. Ein Symbol ohne Namen ist für ein
 *     Vorleseprogramm nicht vorhanden (`DESIGN.md` P53); der Typ lässt es gar
 *     nicht erst zu.
 *   * Größe und Fokusring kommen aus `buttonClass`: standardmäßig 44 px,
 *     mit `iconSm` kompakt für dichte Desktop-Zeilen. Vorher standen neun
 *     solcher Knöpfe von Hand im Code – ohne gemeinsamen Fokusring.
 *
 * Ein `className` gibt es nicht: Angehängte Größen- oder Farbklassen würden
 * still nichts bewirken. Für Layout ist `layout` da.
 */
export interface IconButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'aria-label'> {
  variant?: IconButtonVariant
  size?: 'icon' | 'iconSm'
  /** Nur Layout – etwa `shrink-0` oder `relative`. */
  layout?: string
  /** Der Name für Vorleseprogramme. Pflicht. */
  'aria-label': string
}

export function IconButton({
  variant = 'icon',
  size = 'icon',
  layout = '',
  type = 'button',
  title,
  ...rest
}: IconButtonProps) {
  // Ark-Steuerungen reichen ihre eigene Trigger-ID durch. Der Tooltip braucht
  // einen eigenen DOM-Anker, damit diese ID seinen Anker nicht überschreibt.
  return <Hint text={title ?? rest['aria-label']}>
    <span className={`inline-flex ${layout}`}><button {...rest} type={type} className={buttonClass(variant, size)} /></span>
  </Hint>
}
