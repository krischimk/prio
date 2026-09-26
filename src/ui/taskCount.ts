/**
 * Beschriftung des Aufgaben-Zählers über der Liste.
 *
 * Beide Ansichten zeigen denselben Text; er entsteht deshalb an genau einer
 * Stelle – wie die Datumsformate in `datetime.ts`.
 *
 * Eine zweite Zahl „gesamt" gibt es bewusst nicht: Abgehakte Aufgaben
 * verschwinden aus der Liste (siehe `listTasks`), also enthält sie
 * ausschließlich offene. Beide Zahlen wären immer gleich.
 */
export function formatOpenTasks(count: number): string {
  return count === 1 ? '1 offene Aufgabe' : `${count} offene Aufgaben`
}
