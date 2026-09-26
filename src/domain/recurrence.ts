/**
 * Wiederkehrende Aufgaben: Termine fortschreiben und Nachfolger benennen.
 *
 * Eine wiederkehrende Aufgabe wird beim Abhaken **ersetzt**, nicht verschoben:
 * Es entsteht eine neue Aufgabe mit dem nächsten Termin. Das hat zwei Gründe –
 * die abgehakte Aufgabe bleibt als Beleg stehen, und sie kann über
 * „Aufgaben wiederherstellen" zurückgeholt werden.
 *
 * Bewusst ohne Datumsbibliothek: Es geht um vier Intervalle, und die einzige
 * Tücke sind Monatsenden und Schaltjahre. Beides lässt sich mit dem
 * eingebauten `Date` sauber lösen, wenn man in **lokalen** Datumsteilen rechnet
 * – so bleibt 18:30 Uhr auch nach der Zeitumstellung 18:30 Uhr.
 */

export const RECURRENCES = ['daily', 'weekly', 'monthly', 'yearly'] as const

export type Recurrence = (typeof RECURRENCES)[number]

/** Ist der Wert eine bekannte Wiederholung? Alles andere gilt als „keine". */
export function isRecurrence(value: string | null | undefined): value is Recurrence {
  return value !== null && value !== undefined && (RECURRENCES as readonly string[]).includes(value)
}

/** Ein Schritt weiter – in lokalen Datumsteilen, nicht in Millisekunden. */
function naechsterSchritt(datum: Date, wiederholung: Recurrence): Date {
  const jahr = datum.getFullYear()
  const monat = datum.getMonth()
  const tag = datum.getDate()

  switch (wiederholung) {
    case 'daily':
      return new Date(jahr, monat, tag + 1, datum.getHours(), datum.getMinutes())
    case 'weekly':
      return new Date(jahr, monat, tag + 7, datum.getHours(), datum.getMinutes())
    case 'monthly': {
      // Monatsende klemmen: Der 31. wird im Februar zum 28. bzw. 29.
      const zielMonat = monat + 1
      const letzterTag = new Date(jahr, zielMonat + 1, 0).getDate()
      return new Date(jahr, zielMonat, Math.min(tag, letzterTag), datum.getHours(), datum.getMinutes())
    }
    case 'yearly': {
      // Der 29. Februar wird im Folgejahr zum 28.
      const letzterTag = new Date(jahr + 1, monat + 1, 0).getDate()
      return new Date(jahr + 1, monat, Math.min(tag, letzterTag), datum.getHours(), datum.getMinutes())
    }
  }
}

/** Obergrenze gegen eine Endlosschleife, falls etwas nicht vorrückt. */
const MAX_SCHRITTE = 5000

/**
 * Der nächste Termin **nach** `now`.
 *
 * Bewusst vom bisherigen Termin aus gerechnet und nicht vom Abhaken: Wer eine
 * Wochenaufgabe montags abhakt, bleibt bei Montag.
 *
 * Es wird so lange vorgerückt, bis der Termin in der Zukunft liegt. Eine seit
 * drei Wochen fällige Wochenaufgabe springt also auf nächste Woche, statt eine
 * Kette überfälliger Einträge zu erzeugen.
 *
 * Liegt der Ausgangstermin bereits in der Zukunft, wird trotzdem ein Schritt
 * gegangen – sonst bliebe die Aufgabe beim nächsten Abhaken stehen.
 */
export function nextOccurrence(dueAt: string, recurrence: Recurrence, now: string): string {
  const start = new Date(dueAt)
  const grenze = new Date(now).getTime()
  if (Number.isNaN(start.getTime())) return dueAt

  let kandidat = naechsterSchritt(start, recurrence)
  let schritte = 0
  while (kandidat.getTime() <= grenze && schritte < MAX_SCHRITTE) {
    kandidat = naechsterSchritt(kandidat, recurrence)
    schritte += 1
  }
  return kandidat.toISOString()
}

/**
 * Die Kennung des Nachfolgers – **berechnet**, nicht zufällig.
 *
 * Warum: Hakst du dieselbe Aufgabe auf zwei Geräten ab, während beide offline
 * sind, entstünden sonst zwei verschiedene Nachfolger, die nach dem Abgleich
 * doppelt in der Liste stünden. Aus Aufgabe und nächstem Termin kommt auf
 * beiden Geräten dieselbe Kennung heraus, und der Upload verschmilzt sie.
 *
 * Format: eine UUID aus den ersten 16 Bytes von SHA-256.
 */
export async function successorId(taskId: string, nextDueAt: string): Promise<string> {
  const daten = new TextEncoder().encode(`${taskId}|${nextDueAt}`)
  const summe = new Uint8Array(await crypto.subtle.digest('SHA-256', daten))
  const bytes = summe.slice(0, 16)

  // Version 5 und Variante setzen – damit es eine gültige UUID ist.
  bytes[6] = (bytes[6] & 0x0f) | 0x50
  bytes[8] = (bytes[8] & 0x3f) | 0x80

  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join('-')
}
