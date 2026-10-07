import { describe, expect, it } from 'vitest'
import {
  LEER_BEREICHE,
  LEER_MITGLIEDER,
  leerAufgaben,
  leerListen,
} from '../../src/ui/emptyTexts'

/**
 * Leerzustände (unit).
 *
 * Der Leerzustand ist der Zustand, den kein Screenshot mit Daten zeigt – und
 * deshalb der, den man vergisst (P34, P36). Zwei Zusicherungen halten ihn fest:
 * Er **lädt ein**, und die Information ist in beiden Ansichten **gleich
 * formuliert** (P57), nur der Weg unterscheidet sich (P62).
 */
const ALLE = [
  leerAufgaben('breit'),
  leerAufgaben('mobil'),
  leerListen('breit'),
  leerListen('mobil'),
  LEER_BEREICHE,
  LEER_MITGLIEDER,
]

describe('Leerzustände', () => {
  it('lädt ein, statt nur festzustellen', () => {
    for (const text of ALLE) {
      expect(text, text).toMatch(/(Schreib|Tippe|Leg|Teile)/)
    }
  })

  it('beginnt in beiden Ansichten mit demselben Satz', () => {
    expect(leerAufgaben('breit').startsWith('Noch keine Aufgaben in dieser Liste.')).toBe(true)
    expect(leerAufgaben('mobil').startsWith('Noch keine Aufgaben in dieser Liste.')).toBe(true)
    expect(leerListen('breit').startsWith('Noch keine Liste vorhanden.')).toBe(true)
    expect(leerListen('mobil').startsWith('Noch keine Liste vorhanden.')).toBe(true)
  })

  it('nennt den Weg so, wie man ihn dort geht', () => {
    // Auf dem Telefon tippt man, in der breiten Ansicht gibt es das Feld darüber.
    expect(leerAufgaben('breit')).not.toBe(leerAufgaben('mobil'))
    expect(leerAufgaben('mobil')).toContain('Tippe')
    expect(leerAufgaben('breit')).toContain('Schreib')
  })
})
