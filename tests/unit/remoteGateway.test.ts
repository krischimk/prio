import { describe, expect, it } from 'vitest'
import { classifyRemoteError } from '../../src/sync/remoteGateway'

/**
 * Fehlerklassifizierung.
 *
 * Der erste Fall ist ein echter Fehler aus dem Betrieb: Supabase liefert bei
 * PostgREST-Problemen ein **einfaches Objekt**, kein `Error`. Vorher landete
 * deshalb das komplette JSON in der Oberfläche – unlesbar und wegen der langen
 * Zeichenkette nicht einmal umbrechbar.
 */
describe('Serverfehler einordnen', () => {
  it('nimmt die Meldung aus einem Supabase-Fehlerobjekt, nicht das ganze JSON', () => {
    const fehler = {
      code: 'PGRST204',
      details: null,
      hint: null,
      message: "Could not find the 'completed_at' column of 'tasks' in the schema cache",
    }

    const klassifiziert = classifyRemoteError(fehler)

    expect(klassifiziert.kind).toBe('server')
    expect(klassifiziert.message).toBe(
      "Could not find the 'completed_at' column of 'tasks' in the schema cache",
    )
    expect(klassifiziert.message).not.toContain('{')
  })

  it('fällt bei einem Objekt ohne Meldung auf JSON zurück', () => {
    const klassifiziert = classifyRemoteError({ seltsam: true })
    expect(klassifiziert.message).toContain('seltsam')
  })

  it('erkennt ein abgelaufenes Anmeldezeichen', () => {
    expect(classifyRemoteError({ status: 401, message: 'JWT expired' }).kind).toBe('auth')
  })

  it('erkennt einen Netzwerkausfall', () => {
    expect(classifyRemoteError(new TypeError('Failed to fetch')).kind).toBe('offline')
  })

  it('nimmt bei einem echten Error die Meldung', () => {
    expect(classifyRemoteError(new Error('kaputt')).message).toBe('kaputt')
  })
})
