import { Temporal } from '@js-temporal/polyfill'
import type { Recurrence } from '../../src/domain/recurrence'

/** Dieselben Kalenderschritte, ausdrücklich in der Kontozone statt Worker-UTC. */
export function calendarStep(timeZone: string) {
  return (date: Date, recurrence: Recurrence): Date => {
    const instant = Temporal.Instant.from(date.toISOString()).toZonedDateTimeISO(timeZone)
    const duration = recurrence === 'daily' ? { days: 1 } : recurrence === 'weekly' ? { weeks: 1 } : recurrence === 'monthly' ? { months: 1 } : { years: 1 }
    return new Date(Number(instant.add(duration).epochMilliseconds))
  }
}
