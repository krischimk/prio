import { createContext } from 'react'
import type { LocalTask } from '../domain/types'

/**
 * Kurz sichtbare Leiste nach einer Handlung, die man zurücknehmen können soll.
 *
 * Eigene Datei, damit `UndoProvider` nur die Komponente exportiert – das hält
 * Fast Refresh im Dev-Server instabil.
 */
export interface UndoAngebot {
  /**
   * Kennung der Aufgabe, wenn der Titel **live** gelesen werden soll (nach dem
   * Abhaken und nach dem Löschen): Wer sie innerhalb der fünf Sekunden
   * umbenennt, sieht sonst den alten Titel.
   */
  taskId?: string
  /** Fester Text, wenn es keine Aufgabe ist – etwa eine gelöschte Liste. */
  text?: string
  /** Was passiert ist – daraus entsteht der Satz in der Leiste. */
  art: 'erledigt' | 'geloescht'
  /** Macht die Handlung rückgängig. Wirft, wenn das nicht mehr geht. */
  rueckgaengig: () => Promise<void>
}

export interface UndoContextValue {
  /** Meldet eine Aufgabe an, die gerade abgehakt wurde. */
  offerUndo(task: LocalTask): void
  /** Meldet eine Handlung an, die rückgängig gemacht werden kann. */
  offer(angebot: UndoAngebot): void
}

export const UndoContext = createContext<UndoContextValue | null>(null)

/** Wie lange die Leiste stehen bleibt. */
export const UNDO_VISIBLE_MS = 5000
