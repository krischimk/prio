/**
 * Eingebaute Listensymbole.
 *
 * Bewusst eine überschaubare Auswahl statt einer Sammlung mit tausenden
 * Symbolen: Ein Symbol soll helfen, eine Liste schneller wiederzufinden – eine
 * lange Liste durchzusuchen tut genau das Gegenteil. Die Motive sind deshalb
 * nach Alltagstauglichkeit ausgewählt und nicht nach Vollständigkeit.
 *
 * Gespeichert wird nur die Kennung (`std:haushalt`). Die Darstellung bleibt
 * damit Sache der App: Eine weitere Reihe lässt sich später ergänzen, ohne
 * Daten umzuschreiben und ohne Datenbankänderung.
 *
 * Gezeichnet wird als Inline-SVG im 24×24-Raster mit `currentColor`, also ohne
 * zusätzliche Datei und ohne Netzzugriff (siehe `ListIcon.tsx`).
 *
 * Hier steht nur noch das Gerüst: die Definition, das Nachschlagen und die
 * Liste selbst. Die Symbole kommen aus fremden Sammlungen und liegen in
 * `listIconsMdi.ts`; erzeugt werden sie mit `npm run icons:generate`.
 */

import { LIST_ICONS_MDI } from './listIconsMdi'

export interface ListIconDefinition {
  /** Kennung, wie sie in der Datenbank steht. */
  id: string
  /** Beschriftung für die Auswahl und für Vorleseprogramme. */
  label: string
  /** Pfade im eigenen Raster (siehe `viewBox`). */
  paths: string[]
  /**
   * Das Raster der Pfade, z. B. `0 0 24 24`.
   *
   * Nicht jede Sammlung zeichnet auf 24×24 – Temaki etwa auf 50×50. Ohne
   * eigene Angabe landete so ein Symbol winzig in einer Ecke.
   */
  viewBox?: string
  /**
   * `true` zeichnet die Pfade als Fläche statt als Strich.
   *
   * Die handgezeichneten Symbole sind Striche, die von Material Design Icons
   * sind Flächen. Ohne diesen Unterschied sähen die einen wie Gerüste und die
   * anderen wie Kleckse aus.
   */
  filled?: boolean
  /** Herkunft bei fremden Symbolen – nur für die Nachvollziehbarkeit. */
  source?: string
}

/**
 * Alle Listensymbole.
 *
 * Sämtlich aus fremden Sammlungen – kein selbst gezeichnetes Symbol mehr. Die
 * Reihenfolge stammt aus `scripts/generate-list-icons.mjs` und bestimmt die
 * Anzeige in der Auswahl.
 */
export const LIST_ICONS: ListIconDefinition[] = LIST_ICONS_MDI

export function findListIcon(id: string | null): ListIconDefinition | null {
  if (!id) return null
  return LIST_ICONS.find((entry) => entry.id === id) ?? null
}
