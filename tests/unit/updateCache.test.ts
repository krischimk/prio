import { describe, expect, it } from 'vitest'
import {
  UPDATE_CHECK_INTERVAL_MS,
  isCachedCheckUsable,
  parseCachedCheck,
  serializeCachedCheck,
  shouldCacheResult,
  type CachedCheck,
} from '../../src/updates/updateCache'

/**
 * Der Zwischenspeicher der Update-Prüfung.
 *
 * Er existiert wegen einer Grenze: GitHub erlaubt 60 Abfragen je Stunde und IP.
 * Ohne ihn fragt die App bei jedem Start – und zeigt nach ein paar Starts eine
 * Grenzmeldung statt einer Antwort.
 */
const JETZT = 1_800_000_000_000

function eintrag(ueberschreiben: Partial<CachedCheck> = {}): CachedCheck {
  return {
    at: JETZT,
    current: '0.15.1',
    result: { status: 'up-to-date', current: '0.15.1', latest: '0.15.1' },
    ...ueberschreiben,
  }
}

describe('Gemerkte Update-Prüfung', () => {
  it('überlebt den Weg durch den Speicher', () => {
    const zurueck = parseCachedCheck(serializeCachedCheck(eintrag()))
    expect(zurueck).toEqual(eintrag())
  })

  it('gilt innerhalb des Zeitfensters', () => {
    expect(isCachedCheckUsable(eintrag(), '0.15.1', JETZT + 60_000)).toBe(true)
  })

  it('verfällt danach', () => {
    expect(isCachedCheckUsable(eintrag(), '0.15.1', JETZT + UPDATE_CHECK_INTERVAL_MS + 1)).toBe(false)
  })

  it('gilt nicht mehr, wenn inzwischen eine andere Fassung läuft', () => {
    // Genau der Fall direkt nach dem Update: Der gemerkte Stand verglich die
    // alte Version und würde eine Fassung anbieten, die schon läuft.
    expect(isCachedCheckUsable(eintrag({ current: '0.15.0' }), '0.15.1', JETZT + 1000)).toBe(false)
  })

  it('verträgt fehlende und kaputte Einträge', () => {
    expect(parseCachedCheck(null)).toBeNull()
    expect(parseCachedCheck('{kein json')).toBeNull()
    expect(parseCachedCheck('{}')).toBeNull()
    expect(parseCachedCheck('{"at":"gestern","current":"0.1.0","result":{}}')).toBeNull()
    expect(isCachedCheckUsable(null, '0.15.1', JETZT)).toBe(false)
  })
})

describe('Fehlschläge gehören nicht in den Speicher', () => {
  it('merkt nur brauchbare Ergebnisse', () => {
    expect(shouldCacheResult({ status: 'up-to-date', current: '0.15.2', latest: '0.15.2' })).toBe(true)
    expect(shouldCacheResult({ status: 'failed', message: 'kein Netz' })).toBe(false)
  })

  it('verwirft einen gemerkten Fehlschlag', () => {
    // Sonst stünde nach einem Start ohne Netz für Stunden eine Fehlermeldung
    // da, obwohl die Verbindung längst wieder steht.
    const fehlschlag = eintrag({ result: { status: 'failed', message: 'GitHub ist nicht erreichbar.' } })
    expect(isCachedCheckUsable(fehlschlag, '0.15.1', JETZT + 1000)).toBe(false)
  })
})
