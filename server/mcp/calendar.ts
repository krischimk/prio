import { Temporal } from '@js-temporal/polyfill'
import { recurrenceInterval, type Recurrence } from '../../src/domain/recurrence'

/** Dieselben Kalenderschritte, ausdrücklich in der Kontozone statt Worker-UTC. */
export function calendarStep(timeZone: string) {
  return (date: Date, recurrence: Recurrence): Date => {
    const instant = Temporal.Instant.from(date.toISOString()).toZonedDateTimeISO(timeZone)
    const { every, unit } = recurrenceInterval(recurrence)!
    const duration = { [unit]: every }
    return new Date(Number(instant.add(duration).epochMilliseconds))
  }
}
