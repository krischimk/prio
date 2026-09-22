import { createContext } from 'react'
import type { LocalTask } from '../domain/types'

/**
 * Kurz sichtbare Leiste nach dem Abhaken.
 *
 * Eigene Datei, damit `UndoProvider` nur die Komponente exportiert – das hält
 * Fast Refresh im Dev-Server intakt.
 */
export interface UndoContextValue {
  /** Meldet eine gerade abgehakte Aufgabe an. Die Leiste erscheint kurz. */
  offerUndo(task: LocalTask): void
}

export const UndoContext = createContext<UndoContextValue | null>(null)

/** Wie lange die Leiste stehen bleibt. */
export const UNDO_VISIBLE_MS = 5000
