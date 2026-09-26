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
  /**
   * Themengruppe, unter der das Symbol in der Auswahl steht.
   *
   * Die Gruppen kommen aus `scripts/generate-list-icons.mjs`; die Auswahl
   * setzt sie als Überschriften um.
   */
  group?: string
}

/**
 * Alle Listensymbole.
 *
 * Sämtlich aus fremden Sammlungen – kein selbst gezeichnetes Symbol mehr. Die
 * Reihenfolge stammt aus `scripts/generate-list-icons.mjs` und bestimmt die
 * Anzeige in der Auswahl.
 */
export const LIST_ICONS: ListIconDefinition[] = LIST_ICONS_MDI

export interface ListIconGroup {
  /** Überschrift der Gruppe, `null` für Symbole ohne Zuordnung. */
  name: string | null
  icons: ListIconDefinition[]
}

/**
 * Fasst die Symbole nach ihrer Gruppe zusammen – in der Reihenfolge der Liste.
 *
 * Fortlaufend gesammelt: Symbole derselben Gruppe stehen dadurch beieinander,
 * sofern der Erzeuger sie so einsortiert hat. Eine Gruppe, die später noch
 * einmal auftaucht, bekäme eine zweite Überschrift – das wäre ein Fehler in
 * `scripts/generate-list-icons.mjs`.
 */
export function groupListIcons(icons: ListIconDefinition[] = LIST_ICONS): ListIconGroup[] {
  const gruppen: ListIconGroup[] = []
  for (const icon of icons) {
    const name = icon.group ?? null
    const letzte = gruppen.at(-1)
    if (letzte && letzte.name === name) letzte.icons.push(icon)
    else gruppen.push({ name, icons: [icon] })
  }
  return gruppen
}

/** Symbol anhand seiner Kennung. Unbekannte Kennungen ergeben kein Symbol. */
export function findListIcon(id: string | null): ListIconDefinition | null {
  if (!id) return null
  return LIST_ICONS.find((entry) => entry.id === id) ?? null
}
