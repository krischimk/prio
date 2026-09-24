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
 * Die meisten Symbole sind von Hand gezeichnet. Für Motive, die sich so nicht
 * sauber darstellen lassen – Bagger, Schachfigur, Violine und ähnliche – kommen
 * Symbole aus Material Design Icons dazu (`listIconsMdi.ts`, Apache-2.0,
 * siehe THIRD-PARTY.md).
 */

import { LIST_ICONS_MDI } from './listIconsMdi'

export interface ListIconDefinition {
  /** Kennung, wie sie in der Datenbank steht. */
  id: string
  /** Beschriftung für die Auswahl und für Vorleseprogramme. */
  label: string
  /** Pfade im 24×24-Raster. */
  paths: string[]
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

const LIST_ICONS_HAND_DRAWN: ListIconDefinition[] = [
  { id: 'std:check', label: 'Erledigt', paths: ['M5 12.5l4.5 4.5L19 7'] },
  {
    id: 'std:star',
    label: 'Wichtig',
    paths: ['M12 3.5l2.6 5.4 5.9.8-4.3 4.2 1 5.9-5.2-2.8-5.2 2.8 1-5.9-4.3-4.2 5.9-.8z'],
  },
  {
    id: 'std:heart',
    label: 'Favoriten',
    paths: [
      'M12 20.2l-1.2-1.1C6 14.8 3 12.1 3 8.8 3 6.1 5.1 4 7.7 4c1.5 0 3 .7 4.3 2.1C13.3 4.7 14.8 4 16.3 4 18.9 4 21 6.1 21 8.8c0 3.3-3 6-7.8 10.3z',
    ],
  },
  {
    id: 'std:home',
    label: 'Haushalt',
    paths: ['M4 10.4L12 4l8 6.4V19a1 1 0 0 1-1 1h-4v-5.5H9V20H5a1 1 0 0 1-1-1z'],
  },
  {
    id: 'std:work',
    label: 'Arbeit',
    paths: ['M4 8.5h16V19a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z', 'M9 8.5V6.5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2', 'M4 13h16'],
  },
  {
    id: 'std:shopping',
    label: 'Einkauf',
    paths: [
      'M3 5h2.2l2.3 9.8h9.3l2.2-7.3H6',
      'M9.7 18.8a1.2 1.2 0 1 1-2.4 0 1.2 1.2 0 0 1 2.4 0z',
      'M18.7 18.8a1.2 1.2 0 1 1-2.4 0 1.2 1.2 0 0 1 2.4 0z',
    ],
  },
  {
    id: 'std:study',
    label: 'Lernen',
    paths: [
      'M12 6.6C10.2 5 7.9 4.2 5 4.2V17c2.9 0 5.2.8 7 2.4 1.8-1.6 4.1-2.4 7-2.4V4.2c-2.9 0-5.2.8-7 2.4z',
      'M12 6.6v12.8',
    ],
  },
  {
    id: 'std:sport',
    label: 'Sport',
    paths: ['M4 9.5v5M7.5 7.5v9M16.5 7.5v9M20 9.5v5M7.5 12h9'],
  },
  {
    id: 'std:travel',
    label: 'Reise',
    paths: [
      'M10.5 3.8a1.5 1.5 0 0 1 3 0v4.6l7 4.3v1.8l-7-2.2v3.6l2.4 1.9v1.4l-4-1.1-4 1.1v-1.4l2.4-1.9v-3.6l-7 2.2v-1.8l7-4.3z',
    ],
  },
  {
    id: 'std:music',
    label: 'Musik',
    paths: [
      'M9.5 17.2V6.2l9-1.8v11',
      'M9.5 17.2a2.6 2.6 0 1 1-5.2 0 2.6 2.6 0 0 1 5.2 0z',
      'M18.5 15.4a2.6 2.6 0 1 1-5.2 0 2.6 2.6 0 0 1 5.2 0z',
    ],
  },
  {
    id: 'std:food',
    label: 'Essen',
    paths: ['M7 3v7a2.5 2.5 0 0 0 5 0V3M9.5 12.5V21M17 3c-1.6 1-2.4 2.6-2.4 4.6s.8 3.4 2.4 4.4V21'],
  },
  {
    id: 'std:ideas',
    label: 'Ideen',
    paths: [
      'M12 3.5a5.5 5.5 0 0 0-3.2 9.9c.4.3.7.8.7 1.3v.8h5v-.8c0-.5.3-1 .7-1.3A5.5 5.5 0 0 0 12 3.5z',
      'M9.8 18.5h4.4M10.5 21h3',
    ],
  },
  {
    id: 'std:calendar',
    label: 'Termine',
    paths: ['M4.5 6.5h15V20h-15zM4.5 10.5h15M8.5 3.5v4M15.5 3.5v4'],
  },
  {
    id: 'std:people',
    label: 'Personen',
    paths: [
      'M12 12.2a3.9 3.9 0 1 0 0-7.8 3.9 3.9 0 0 0 0 7.8z',
      'M4.5 20.5c0-3.6 3.4-5.6 7.5-5.6s7.5 2 7.5 5.6',
    ],
  },
  {
    id: 'std:folder',
    label: 'Sonstiges',
    paths: ['M3.5 7.5a2 2 0 0 1 2-2h3.6l2 2.5h7.4a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z'],
  },
  { id: 'std:flag', label: 'Merken', paths: ['M5.5 20.5V4M5.5 5h12l-2.2 4 2.2 4h-12'] },

  /*
   * Die folgenden fünf gibt es bei Material Design Icons nicht. Sie sind
   * deshalb von Hand gezeichnet – bewusst einfacher gehalten, damit sie auf
   * 24 Pixeln noch erkennbar sind.
   */
  {
    id: 'std:dragon',
    label: 'Drache',
    paths: [
      'M4 15.5c0-4.4 3.6-8 8-8 1.6 0 3.1.5 4.4 1.3L20 6l-.5 4.3c1 1.1 1.5 2.6 1.5 4.2 0 .9-.2 1.7-.5 2.5h-6.3L12 21l-2.1-4H7z',
      'M9.5 12h.01M8.5 17l1.1-1.7M11.8 17l1-1.7',
    ],
  },
  {
    id: 'std:japan',
    label: 'Japan',
    paths: [
      'M3.5 6h17',
      'M5.5 9.5h13',
      'M7.5 9.5v11M16.5 9.5v11',
      'M6 6l1.5 3.5M18 6l-1.5 3.5',
    ],
  },
  {
    id: 'std:climb',
    label: 'Klettern',
    paths: [
      'M18.5 3.5v17',
      'M10 8.2v4.4',
      'M10 9.4l4.5-3M10 11.4l4 1.6',
      'M10 12.6l-2.2 3.6M10 12.6l2.4 3.6',
      'M11.6 5.6a1.6 1.6 0 1 0-3.2 0 1.6 1.6 0 0 0 3.2 0z',
    ],
  },
  {
    id: 'std:sculpt',
    label: 'Bildhauern',
    paths: [
      'M3.5 6.5h6.5V10H3.5z',
      'M6.75 10v6.5',
      'M13.5 8.5l5 5-2 2-5-5z',
      'M11.5 10.5l-6 6',
    ],
  },
  {
    id: 'std:rock',
    label: 'Fels',
    paths: [
      'M3.5 18.5l1.7-6.2 3.1-3.1 3.6-2.7 4 2.4 2.6 4.2-1.1 5.4z',
      'M8.3 9.2l3.6 3.4 3.8-2.2',
      'M11.9 12.6l-.8 5.9',
    ],
  },
]

/**
 * Alle Listensymbole.
 *
 * Zuerst die handgezeichneten, darunter die aus Material Design Icons. Die
 * Reihenfolge bestimmt die Anzeige in der Auswahl – die vertrauten Motive
 * stehen deshalb vorn.
 */
export const LIST_ICONS: ListIconDefinition[] = [...LIST_ICONS_HAND_DRAWN, ...LIST_ICONS_MDI]

export function findListIcon(id: string | null): ListIconDefinition | null {
  if (!id) return null
  return LIST_ICONS.find((entry) => entry.id === id) ?? null
}
