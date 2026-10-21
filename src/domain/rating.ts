import { ValidationError } from './validation'
import { checklistRemaining, type ChecklistItem } from './checklist'

/** Gemeinsam aktivierte Einschätzung; null bezeichnet eine unbewertete Aufgabe. */
export interface TaskRating {
  importance: number
  urgency: number
  effort: number
  urgencyMode: 'auto' | 'manual'
  effortFromChecklist: boolean
}

const validValue = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 10

export function parseRating(value: unknown): TaskRating | null {
  if (!value || typeof value !== 'object') return null
  const row = value as Partial<TaskRating>
  if (!validValue(row.importance) || !validValue(row.urgency) || !validValue(row.effort) || !['auto', 'manual'].includes(row.urgencyMode ?? '')) return null
  if (row.effortFromChecklist !== undefined && typeof row.effortFromChecklist !== 'boolean') return null
  return { importance: row.importance, urgency: row.urgency, effort: row.effort, urgencyMode: row.urgencyMode!, effortFromChecklist: row.effortFromChecklist !== false }
}

export function validateRating(value: unknown): TaskRating | null {
  if (value === null || value === undefined) return null
  const rating = parseRating(value)
  if (!rating) throw new ValidationError('invalid', 'Die Bewertung braucht drei gültige Einschätzungen und einen Dringlichkeitsmodus.')
  return rating
}

export const startRating = (importance: number): TaskRating => ({ importance, urgency: 5, effort: 5, urgencyMode: 'auto', effortFromChecklist: true })

/**
 * Testkurve v1: Bei mittlerem Aufwand drei Tage vor Fälligkeit halbe Stärke,
 * zwölf Stunden davor maximal. Der Aufwand skaliert beide Abstände um Faktor
 * 1/3 bis 3. Exponentiell beschleunigter Anstieg, danach gedeckelt. Ausschließlich
 * Restzeit, keine Abhängigkeit von Erstellung, Alter oder vorheriger Bewertung.
 * Berechnete Werte werden weder gespeichert noch als neue Änderungen versendet.
 */
export function automaticUrgency(dueAt: string, effort: number, nowMs: number): number | null {
  const remaining = Date.parse(dueAt) - nowMs
  if (!Number.isFinite(remaining) || !validValue(effort)) return null
  const hour = 60 * 60 * 1000
  const factor = 3 ** ((effort - 5) / 5)
  const half = 72 * hour * factor
  const maximum = 12 * hour * factor
  return 10 * Math.exp(-Math.LN2 * Math.max(0, remaining - maximum) / (half - maximum))
}

/** In der einfachen Ansicht bestimmt eine Fälligkeit immer die Dringlichkeit.
 * Der gespeicherte manuelle Wert bleibt für die Detailansicht erhalten. */
export function ratingValues(rating: TaskRating, dueAt: string | null, nowMs: number, checklist: readonly ChecklistItem[] = [], detailedRatings = true) {
  const automatic = dueAt !== null && (!detailedRatings || rating.urgencyMode === 'auto')
  const effort = rating.effort * (rating.effortFromChecklist ? checklistRemaining(checklist) : 1)
  const urgency = automatic ? automaticUrgency(dueAt, effort, nowMs) ?? rating.urgency : rating.urgency
  return { importance: rating.importance, urgency, effort, priority: (rating.importance + urgency) / 2, automatic }
}

/** Ein Wechsel zu Manuell friert den Wert auf der bedienbaren Slider-Präzision ein. */
export function changeUrgencyMode(rating: TaskRating, mode: TaskRating['urgencyMode'], dueAt: string | null, nowMs: number, checklist: readonly ChecklistItem[] = []): TaskRating {
  if (mode === rating.urgencyMode) return rating
  return { ...rating, urgencyMode: mode, urgency: mode === 'manual' ? Math.round(ratingValues(rating, dueAt, nowMs, checklist).urgency * 10) / 10 : rating.urgency }
}
