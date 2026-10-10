/**
 * Die Art des Fehlers – für Aufrufer, die unterscheiden müssen.
 *
 * Ohne Kennung blieb ihnen nur, den deutschen Satz zu lesen: „existiert nicht
 * mehr“ gegen „darf nicht leer sein“. Das ist genau die Kopplung, die eine
 * Umformulierung zum Fehler macht.
 */
export type ValidationCode =
  /** Ein Wert gehört nicht zu den erlaubten Eingaben. */
  | 'invalid'
  /** Der Datensatz ist weg (gelöscht oder nie da gewesen). */
  | 'not-found'
  /** Eine Pflichtangabe fehlt. */
  | 'empty'
  /** Eine Adresse fehlt oder ist unbrauchbar. */
  | 'email'
  /** Die Eingabe verletzt eine Grenze (zu lang, zu viele). */
  | 'limit'

/** Fehler bei ungültigen Eingaben aus der Oberfläche. */
export class ValidationError extends Error {
  readonly code: ValidationCode

  constructor(code: ValidationCode, message: string) {
    super(message)
    this.name = 'ValidationError'
    this.code = code
  }
}

/** Dieselbe Prüfung, ohne den Aufrufer mit einer Kennung zu behelligen. */
export function istNichtGefunden(error: unknown): boolean {
  return error instanceof ValidationError && error.code === 'not-found'
}

export function requireText(value: string, field: string): string {
  const trimmed = value.trim()
  if (trimmed.length === 0) {
    throw new ValidationError('empty', `${field} darf nicht leer sein.`)
  }
  return trimmed
}

export function optionalText(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null
  const trimmed = value.trim()
  return trimmed.length === 0 ? null : trimmed
}
