import type { ButtonHTMLAttributes } from 'react'
import { buttonClass, type ButtonVariant } from '../styles'

/** Die Symbol-Varianten: normal, heller, zurückgenommen, aktiv. */
export type IconButtonVariant = Extract<
  ButtonVariant,
  'icon' | 'iconBright' | 'iconMuted' | 'iconActive'
>

/**
 * Ein Knopf, der nur ein Symbol trägt – Schließen, Menü, Synchronisation.
 *
 * Zwei Dinge sind hier **erzwungen** statt vereinbart:
 *
 *   * `aria-label` ist Pflicht. Ein Symbol ohne Namen ist für ein
 *     Vorleseprogramm nicht vorhanden (`DESIGN.md` P53); der Typ lässt es gar
 *     nicht erst zu.
 *   * Die Fläche kommt aus `buttonClass('icon', 'icon')`, hat also den
 *     gemeinsamen Fokusring. Vorher standen neun solcher Knöpfe von Hand im
 *     Code – ohne Ring, denn die Konstante kannten sie nicht.
 *
 * Ein `className` gibt es nicht: Angehängte Größen- oder Farbklassen würden
 * still nichts bewirken. Für Layout ist `layout` da.
 */
export interface IconButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'aria-label'> {
  variant?: IconButtonVariant
  /** Nur Layout – etwa `shrink-0` oder `relative`. */
  layout?: string
  /** Der Name für Vorleseprogramme. Pflicht. */
  'aria-label': string
}

export function IconButton({
  variant = 'icon',
  layout = '',
  type = 'button',
  ...rest
}: IconButtonProps) {
  return <button {...rest} type={type} className={buttonClass(variant, 'icon', layout)} />
}
