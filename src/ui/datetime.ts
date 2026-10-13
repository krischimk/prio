/**
 * Anzeige- und Eingabehilfen für Datum und Uhrzeit.
 *
 * Gespeichert wird immer UTC im ISO-Format. Angezeigt und eingegeben wird in
 * der lokalen Zeitzone – das erledigt `Date` zuverlässig und ohne zusätzliche
 * Bibliothek.
 */

/** ISO-Zeitstempel → Wert für `<input type="datetime-local">`. */
export function toDateTimeLocalValue(iso: string | null): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** Wert aus `<input type="datetime-local">` → ISO-Zeitstempel (UTC) oder null. */
export function fromDateTimeLocalValue(value: string): string | null {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

/** Deutsches Eingabedatum → ISO-Kalendertag, ohne stille Korrektur falscher Tage. */
export function parseGermanDate(value: string): string | null {
  const match = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(value.trim())
  if (!match) return null
  const [, d, m, y] = match
  const date = new Date(Number(y), Number(m) - 1, Number(d), 12)
  if (date.getFullYear() !== Number(y) || date.getMonth() !== Number(m) - 1 || date.getDate() !== Number(d)) return null
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
}

export function formatGermanDate(day: string): string {
  const [year, month, date] = day.split('-')
  return `${date}.${month}.${year}`
}

export function formatCalendarDay(day: string): string {
  return new Date(`${day}T12:00`).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

/** Die Uhrzeit verwendet unabhängig von der Browsersprache die 24-Stunden-Uhr. */
export function normalizeTime(value: string): string | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim())
  if (!match || Number(match[1]) > 23 || Number(match[2]) > 59) return null
  return `${match[1].padStart(2, '0')}:${match[2]}`
}

/** Kurze, gut lesbare Anzeige, z. B. "31.01.2026, 14:30". */
export function formatDateTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Kompakte Terminzeile im Formular; das Kalenderzeichen benennt das Feld. */
export function formatScheduleLabel(iso: string): string {
  return formatDateTime(iso)
}

export function localTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone
}

/** `true`, wenn der Zeitpunkt in der Vergangenheit liegt. */
export function isOverdue(iso: string): boolean {
  const date = new Date(iso)
  return !Number.isNaN(date.getTime()) && date.getTime() < Date.now()
}

export interface DueLabel {
  /** Fertiger Text, z. B. „Fällig: 15.02.2027, 18:30 · überfällig". */
  text: string
  /** `true`, wenn hervorgehoben werden soll. */
  overdue: boolean
}

/**
 * Aufbereitung der Fälligkeit – die einzige Stelle, an der dieser Text entsteht.
 *
 * Breite und mobile Ansicht zeigen dieselbe Information; vorher hat jede ihre
 * eigene Schreibweise benutzt (`Fällig: … (überfällig)` bzw. `… · überfällig`).
 * Erledigte Aufgaben gelten nicht als überfällig.
 */
/**
 * Wann eine Aufgabe abgehakt wurde – für die Wiederherstellen-Liste.
 *
 * Steht hier und nicht in der Komponente, weil jede Datumsdarstellung an einer
 * Stelle liegen soll (siehe `uiConventions.test.ts`).
 */
export function formatCompletedLabel(completedAt: string): string {
  return `abgehakt am ${formatDateTime(completedAt)}`
}

/** Erstellzeitpunkt, mit derselben Schreibweise in beiden Ansichten. */
export function formatCreatedLabel(createdAt: string): string {
  return `Erstellt: ${formatDateTime(createdAt)}`
}

export function formatDueLabel(dueAt: string, completed: boolean): DueLabel {
  const zeitpunkt = formatDateTime(dueAt)
  const overdue = !completed && isOverdue(dueAt)
  return {
    text: overdue ? `Fällig: ${zeitpunkt} · überfällig` : `Fällig: ${zeitpunkt}`,
    overdue,
  }
}

/**
 * Wann erinnert wird – für die Zeile unter einer Aufgabe und für die Vorschau
 * im Formular.
 *
 * Steht hier und nicht in `reminder.ts`, weil dort die Textbausteine für den
 * Vorlauf leben und jede Datumsdarstellung an dieser einen Stelle entstehen
 * soll (siehe `uiConventions.test.ts`).
 */
export function formatReminderLabel(at: string): string {
  return `Erinnert: ${formatDateTime(at)}`
}
