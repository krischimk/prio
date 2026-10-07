import { createContext } from 'react'
import type { LocalList } from '../domain/types'

/**
 * Was die Oberfläche über sich selbst weiß: welche Liste gewählt ist und ob
 * „Aufgaben wiederherstellen“ offen ist.
 *
 * Diese beiden Dinge lagen vorher **in beiden Ansichten** – jede hielt ihre
 * eigene Kopie. Beim Wechsel der Breite (Fenster verkleinern, Tablet drehen)
 * tauscht React den Komponentenbaum aus, die Kopie war neu initialisiert, und
 * die Anzeige fiel auf die erste Liste zurück; ein offenes Panel schloss sich.
 * Hier liegt der Zustand **über** der Verzweigung und überlebt sie.
 */
export interface ViewValue {
  /** Die sichtbaren Listen – einmal geladen, von beiden Ansichten benutzt. */
  lists: LocalList[]
  /** Die gewählte Liste, oder `null`, solange es keine gibt. */
  selected: LocalList | null
  /** Ihre Kennung – für `aria-current` und die Aufgabenabfrage. */
  selectedListId: string | null
  selectList: (id: string | null) => void
  restoreOpen: boolean
  setRestoreOpen: (open: boolean) => void
}

export const ViewContext = createContext<ViewValue | null>(null)
