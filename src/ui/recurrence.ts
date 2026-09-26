import type { Recurrence } from '../domain/recurrence'

/**
 * Beschriftungen und Auswahl der Wiederholung.
 *
 * An einer Stelle, damit Telefon und breite Ansicht dieselben Worte benutzen –
 * siehe `AGENTS.md`, Abschnitt „Oberfläche".
 */

export const RECURRENCE_LABELS: Record<Recurrence, string> = {
  daily: 'Täglich',
  weekly: 'Wöchentlich',
  monthly: 'Monatlich',
  yearly: 'Jährlich',
}

/** Beschriftung für die Aufgabenzeile; `null`, wenn es keine gibt. */
export function describeRecurrence(recurrence: string | null): string | null {
  if (recurrence === null) return null
  return RECURRENCE_LABELS[recurrence as Recurrence] ?? null
}
