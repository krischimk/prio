import { describe, expect, it } from 'vitest'
import { ValidationError, istNichtGefunden, optionalText, requireText } from '../../src/db/validation'

/**
 * Eingabefehler tragen eine Kennung.
 *
 * Ohne sie blieb dem Aufrufer nur, den deutschen Satz zu lesen („existiert
 * nicht mehr“ gegen „darf nicht leer sein“) – eine Umformulierung wäre damit
 * zum Fehler geworden.
 */
describe('ValidationError', () => {
  it('kennzeichnet eine leere Pflichtangabe', () => {
    expect(() => requireText('   ', 'Titel')).toThrow(ValidationError)

    try {
      requireText('', 'Titel')
    } catch (fehler) {
      expect(fehler).toBeInstanceOf(ValidationError)
      expect((fehler as ValidationError).code).toBe('empty')
    }
  })

  it('erkennt „nicht gefunden“ an der Kennung statt am Wortlaut', () => {
    expect(istNichtGefunden(new ValidationError('not-found', 'Diese Aufgabe existiert nicht mehr.'))).toBe(true)
    expect(istNichtGefunden(new ValidationError('empty', 'Titel darf nicht leer sein.'))).toBe(false)
    expect(istNichtGefunden(new Error('irgendwas'))).toBe(false)
  })

  it('nimmt Leerraum als „nichts“', () => {
    expect(optionalText('  ')).toBeNull()
    expect(optionalText(null)).toBeNull()
    expect(optionalText(' Notiz ')).toBe('Notiz')
  })
})
