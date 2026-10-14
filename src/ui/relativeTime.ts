const minute = 60_000
const hour = 60 * minute
const day = 24 * hour
const week = 7 * day

/** UTC-Kalender-Monate: Monatsende begrenzen, Gerätezeitzone verändert die Spanne nicht. */
function afterMonths(start: Date, months: number): Date {
  const result = new Date(start)
  const originalDay = result.getUTCDate()
  result.setUTCDate(1)
  result.setUTCMonth(result.getUTCMonth() + months)
  const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate()
  result.setUTCDate(Math.min(originalDay, lastDay))
  return result
}

/** Ganze, vergangene Einheiten; der exakte Termin bleibt gesondert verfügbar. */
export function relativeTimeSpan(start: Date, end: Date): string {
  const elapsed = end.getTime() - start.getTime()
  if (elapsed < minute) return 'weniger als einer Minute'
  const parts: string[] = []
  const add = (value: number, singular: string, plural: string) => {
    if (value > 0) parts.push(`${value} ${value === 1 ? singular : plural}`)
  }
  let months = (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + end.getUTCMonth() - start.getUTCMonth()
  if (afterMonths(start, months).getTime() > end.getTime()) months -= 1
  if (months >= 12) {
    add(Math.floor(months / 12), 'Jahr', 'Jahren')
    add(months % 12, 'Monat', 'Monaten')
  } else if (months >= 1) {
    add(months, 'Monat', 'Monaten')
    add(Math.floor((end.getTime() - afterMonths(start, months).getTime()) / week), 'Woche', 'Wochen')
  } else if (elapsed >= week) {
    add(Math.floor(elapsed / week), 'Woche', 'Wochen')
    add(Math.floor(elapsed % week / day), 'Tag', 'Tagen')
  } else if (elapsed >= day) {
    add(Math.floor(elapsed / day), 'Tag', 'Tagen')
  } else if (elapsed >= hour) {
    add(Math.floor(elapsed / hour), 'Stunde', 'Stunden')
    add(Math.floor(elapsed % hour / minute), 'Minute', 'Minuten')
  } else add(Math.floor(elapsed / minute), 'Minute', 'Minuten')
  return parts.join(' und ')
}
