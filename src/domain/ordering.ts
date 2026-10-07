import type { IsoDateTime, LocalList, LocalListMember, LocalTask } from './types'

/**
 * Reihenfolgen – als reine Funktionen im Domänenmodell.
 *
 * Sie standen in `src/db/repositories.ts`, also in der Datenschicht. Das war
 * insofern praktisch, als die Abfragen damit gleich sortiert zurückkamen – aber
 * es machte die **Anzeigeentscheidung** zu einer Eigenschaft der Datenbank: Wer
 * eine andere Reihenfolge wollte, musste die Datenschicht ändern. Hier kann sie
 * jeder benutzen, der eine Liste sortieren will.
 */

/**
 * Die Reihenfolge innerhalb einer Liste.
 *
 * Zuerst die vom Benutzer bestimmte Position, dann Ungelerntes vor Gelerntem,
 * dann die Fälligkeit, dann das Anlegedatum, zuletzt der Titel. Die Position
 * steht bewusst vorn: Eine erledigte Aufgabe bleibt an ihrem Platz, statt unter
 * dem Finger wegzuspringen.
 */
export function compareTasks(a: LocalTask, b: LocalTask): number {
  const positionA = Number.isFinite(a.position) ? a.position : 0
  const positionB = Number.isFinite(b.position) ? b.position : 0
  if (positionA !== positionB) return positionA - positionB
  if (a.completed !== b.completed) return a.completed ? 1 : -1
  const dueA = a.due_at === null ? Number.POSITIVE_INFINITY : Date.parse(a.due_at)
  const dueB = b.due_at === null ? Number.POSITIVE_INFINITY : Date.parse(b.due_at)
  if (dueA !== dueB) return dueA - dueB
  const createdA = Date.parse(a.created_at)
  const createdB = Date.parse(b.created_at)
  if (createdA !== createdB) return createdA - createdB
  return a.title.localeCompare(b.title)
}

/** Zuletzt abgehakte zuerst. Die Zeitstempel liegen im selben ISO-Format vor. */
export function compareRestorable(a: LocalTask, b: LocalTask): number {
  return (b.completed_at ?? '').localeCompare(a.completed_at ?? '')
}

/** Listen alphabetisch. */
export function compareListsByName(a: LocalList, b: LocalList): number {
  return a.name.localeCompare(b.name)
}

/** Mitglieder nach Kennung – die Adresse kennt der Server, nicht die Zeile. */
export function compareMembersById(a: LocalListMember, b: LocalListMember): number {
  return a.user_id.localeCompare(b.user_id)
}

/**
 * Wie lange eine abgehakte Aufgabe wiederherstellbar bleibt.
 *
 * Eine Regel der Domäne, keine der Datenbank: Die Oberfläche nennt die Zahl in
 * ihrem Text („Abgehakt in den letzten 7 Tagen"), die Abfrage grenzt damit ein.
 * Vorher importierte die Oberfläche dafür eine Konstante aus der Datenschicht.
 */
export const RESTORE_WINDOW_DAYS = 7

/**
 * Der früheste Zeitpunkt, der noch wiederherstellbar ist.
 *
 * Nimmt die Uhrzeit in Millisekunden, wie `timeOf` sie liefert.
 */
export function restoreCutoff(nowMs: number): IsoDateTime {
  return new Date(nowMs - RESTORE_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString()
}
