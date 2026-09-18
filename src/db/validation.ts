/** Fehler bei ungültigen Eingaben aus der Oberfläche. */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ValidationError'
  }
}

export function requireText(value: string, field: string): string {
  const trimmed = value.trim()
  if (trimmed.length === 0) {
    throw new ValidationError(`${field} darf nicht leer sein.`)
  }
  return trimmed
}

export function optionalText(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null
  const trimmed = value.trim()
  return trimmed.length === 0 ? null : trimmed
}
