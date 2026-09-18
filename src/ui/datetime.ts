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

/** `true`, wenn der Zeitpunkt in der Vergangenheit liegt. */
export function isOverdue(iso: string): boolean {
  const date = new Date(iso)
  return !Number.isNaN(date.getTime()) && date.getTime() < Date.now()
}
