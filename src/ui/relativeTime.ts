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

/** Unter 24 Stunden echte Dauer, darüber lokale Kalendertage ohne Uhrzeitrest. */
export function relativeTimeSpan(start: Date, end: Date): { text: string; includesDays: boolean; includesWeeks: boolean } {
  const elapsed = end.getTime() - start.getTime()
  if (elapsed < minute) return { text: 'weniger als einer Minute', includesDays: false, includesWeeks: false }
  const parts: string[] = []
  let includesDays = false
  let includesWeeks = false
  const add = (value: number, singular: string, plural: string) => {
    if (value > 0) {
      parts.push(`${value} ${value === 1 ? singular : plural}`)
      if (singular === 'Tag') includesDays = true
      if (singular === 'Woche') includesWeeks = true
    }
  }
  // UTC ist hier nur die Rechenfläche für lokale Datumsbestandteile: Ein
  // Sommerzeitwechsel darf einen Kalendertag nicht auf 23/25 Stunden kürzen.
  const calendarStart = new Date(Date.UTC(start.getFullYear(), start.getMonth(), start.getDate()))
  const calendarEnd = new Date(Date.UTC(end.getFullYear(), end.getMonth(), end.getDate()))
  const calendarDays = Math.round((calendarEnd.getTime() - calendarStart.getTime()) / day)
  let months = (calendarEnd.getUTCFullYear() - calendarStart.getUTCFullYear()) * 12 + calendarEnd.getUTCMonth() - calendarStart.getUTCMonth()
  if (afterMonths(calendarStart, months).getTime() > calendarEnd.getTime()) months -= 1
  if (months >= 12) {
    add(Math.floor(months / 12), 'Jahr', 'Jahren')
    add(months % 12, 'Monat', 'Monaten')
  } else if (months >= 1) {
    add(months, 'Monat', 'Monaten')
    add(Math.floor((calendarEnd.getTime() - afterMonths(calendarStart, months).getTime()) / week), 'Woche', 'Wochen')
  } else if (calendarDays >= 7 && elapsed >= day) {
    add(Math.floor(calendarDays / 7), 'Woche', 'Wochen')
    add(calendarDays % 7, 'Tag', 'Tagen')
  } else if (elapsed >= day) {
    add(calendarDays, 'Tag', 'Tagen')
  } else if (elapsed >= hour) {
    add(Math.floor(elapsed / hour), 'Stunde', 'Stunden')
    add(Math.floor(elapsed % hour / minute), 'Minute', 'Minuten')
  } else add(Math.floor(elapsed / minute), 'Minute', 'Minuten')
  return { text: parts.join(' und '), includesDays, includesWeeks }
}
