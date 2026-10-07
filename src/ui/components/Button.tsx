import type { ButtonHTMLAttributes } from 'react'
import { buttonClass, type ButtonSize, type ButtonVariant } from '../styles'

/**
 * Der Knopf.
 *
 * Warum es ihn jetzt gibt: Vorher hing an jeder Stelle eine Zeichenkette
 * (`` `${ghostButton} px-2 py-1 text-xs` ``). Solche angehängten Klassen wirken
 * bei Tailwind nicht – `.px-3` steht im Stylesheet hinter `.px-2` –, und ein
 * Umbau des Aussehens hätte jede der rund fünfzig Stellen getroffen. Größe und
 * Art sind deshalb **Eigenschaften**, und `layout` ist ausdrücklich nur für
 * Layout da (Breite, Außenabstand, Ausrichtung).
 *
 * `type` ist standardmäßig `button`: Ein Knopf in einem Formular, der nichts
 * abschickt, ist der Normalfall – der Browser nähme sonst `submit`.
 */
export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'> {
  variant?: ButtonVariant
  size?: ButtonSize
  /** Nur Layout: `w-full`, `shrink-0`, `mt-2 w-full`. */
  layout?: string
}

export function Button({
  variant = 'primary',
  size = 'md',
  layout = '',
  type = 'button',
  ...rest
}: ButtonProps) {
  return <button {...rest} type={type} className={buttonClass(variant, size, layout)} />
}
