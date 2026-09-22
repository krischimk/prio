import { describe, expect, it } from 'vitest'
import { checkForUpdate, parseRelease } from '../../src/updates/updateCheck'

const veroeffentlichung = {
  tag_name: 'v0.6.0',
  body: 'Neue Fassung',
  assets: [
    { name: 'prio-0.6.0.apk', browser_download_url: 'https://example.com/prio-0.6.0.apk', size: 3_300_000 },
  ],
}

/** Antwort eines Servers nachstellen. */
function antwort(payload: unknown, ok = true, status = 200): typeof fetch {
  return (async () => ({
    ok,
    status,
    json: async () => payload,
  })) as unknown as typeof fetch
}

describe('Veröffentlichung auswerten', () => {
  it('findet die APK und entfernt das v aus der Version', () => {
    expect(parseRelease(veroeffentlichung)).toEqual({
      version: '0.6.0',
      apkUrl: 'https://example.com/prio-0.6.0.apk',
      fileName: 'prio-0.6.0.apk',
      sizeBytes: 3_300_000,
      notes: 'Neue Fassung',
    })
  })

  it('überspringt Anhänge, die keine APK sind', () => {
    const ergebnis = parseRelease({
      tag_name: 'v1.0.0',
      assets: [
        { name: 'quelltext.zip', browser_download_url: 'https://example.com/x.zip' },
        { name: 'prio-1.0.0.apk', browser_download_url: 'https://example.com/prio.apk' },
      ],
    })
    expect(ergebnis?.fileName).toBe('prio-1.0.0.apk')
  })

  it('liefert null ohne APK', () => {
    expect(parseRelease({ tag_name: 'v1.0.0', assets: [] })).toBeNull()
    expect(parseRelease(null)).toBeNull()
    expect(parseRelease({ assets: [] })).toBeNull()
  })
})

describe('Nach Updates suchen', () => {
  it('meldet eine neue Fassung', async () => {
    const ergebnis = await checkForUpdate('0.5.0', antwort(veroeffentlichung))
    expect(ergebnis.status).toBe('available')
  })

  it('meldet, wenn die laufende Fassung aktuell ist', async () => {
    const ergebnis = await checkForUpdate('0.6.0', antwort(veroeffentlichung))
    expect(ergebnis).toEqual({ status: 'up-to-date', current: '0.6.0', latest: '0.6.0' })
  })

  it('meldet einen Fehlerstatus des Servers', async () => {
    const ergebnis = await checkForUpdate('0.5.0', antwort({}, false, 503))
    expect(ergebnis).toEqual({ status: 'failed', message: 'Abfrage fehlgeschlagen (503).' })
  })

  it('meldet einen Abbruch der Verbindung, statt zu werfen', async () => {
    const kaputt = (async () => {
      throw new Error('Netzwerk weg')
    }) as unknown as typeof fetch
    const ergebnis = await checkForUpdate('0.5.0', kaputt)
    expect(ergebnis).toEqual({ status: 'failed', message: 'Netzwerk weg' })
  })
})
