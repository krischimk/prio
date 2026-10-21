import { recurrenceInterval, type StandardRecurrence, type RecurrenceUnit } from '../domain/recurrence'

/**
 * Beschriftungen und Auswahl der Wiederholung.
 *
 * An einer Stelle, damit Telefon und breite Ansicht dieselben Worte benutzen –
 * siehe `AGENTS.md`, Abschnitt „Oberfläche".
 */

export const RECURRENCE_LABELS: Record<StandardRecurrence, string> = {
  daily: 'Täglich',
  weekly: 'Wöchentlich',
  monthly: 'Monatlich',
  yearly: 'Jährlich',
}

export const RECURRENCE_UNIT_LABELS: Record<RecurrenceUnit, string> = { minutes: 'Minuten', hours: 'Stunden', days: 'Tage', weeks: 'Wochen', months: 'Monate', years: 'Jahre' }
const singular: Record<RecurrenceUnit, string> = { minutes: 'Minute', hours: 'Stunde', days: 'Tag', weeks: 'Woche', months: 'Monat', years: 'Jahr' }

/** Beschriftung für die Aufgabenzeile; `null`, wenn es keine gibt. */
export function describeRecurrence(recurrence: string | null): string | null {
  if (recurrence === null) return null
  if (Object.hasOwn(RECURRENCE_LABELS, recurrence)) return RECURRENCE_LABELS[recurrence as StandardRecurrence]
  const interval = recurrenceInterval(recurrence)
  return interval ? interval.every === 1 ? `Jede${interval.unit === 'days' ? 'n' : interval.unit === 'years' ? 's' : ''} ${singular[interval.unit]}` : `Alle ${interval.every} ${RECURRENCE_UNIT_LABELS[interval.unit]}` : null
}
