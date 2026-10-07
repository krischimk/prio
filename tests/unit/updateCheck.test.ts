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
function antwort(
  payload: unknown,
  ok = true,
  status = 200,
  headers: Record<string, string> = {},
): typeof fetch {
  return (async () => ({
    ok,
    status,
    headers: { get: (name: string) => headers[name.toLowerCase()] ?? null },
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

describe('Fehlschläge erklären', () => {
  it('nennt die Stundengrenze statt eines Statuscodes', async () => {
    const ergebnis = await checkForUpdate('0.15.0', antwort({}, false, 403))

    expect(ergebnis.status).toBe('failed')
    if (ergebnis.status !== 'failed') return
    expect(ergebnis.message).toContain('begrenzt gerade die Abfragen')
    expect(ergebnis.message).toContain('60 je Stunde')
  })

  it('rechnet die Wartezeit aus, wenn GitHub sie mitteilt', async () => {
    const inZehnMinuten = Math.floor(Date.now() / 1000) + 600
    const ergebnis = await checkForUpdate(
      '0.15.0',
      antwort({}, false, 403, { 'x-ratelimit-reset': String(inZehnMinuten) }),
    )

    expect(ergebnis.status).toBe('failed')
    if (ergebnis.status !== 'failed') return
    expect(ergebnis.message).toMatch(/In etwa (10|11) Minuten/)
  })

  it('erklärt ein fehlendes Repository', async () => {
    const ergebnis = await checkForUpdate('0.15.0', antwort({}, false, 404))

    expect(ergebnis.status).toBe('failed')
    if (ergebnis.status !== 'failed') return
    expect(ergebnis.message).toContain('öffentlich')
  })

  it('nennt andere Fehler weiterhin mit Statuscode', async () => {
    const ergebnis = await checkForUpdate('0.15.0', antwort({}, false, 503))

    expect(ergebnis).toEqual({ status: 'failed', message: 'Abfrage fehlgeschlagen (503).' })
  })
})

describe('Netzfehler', () => {
  it('sagt „nicht erreichbar" statt „Failed to fetch"', async () => {
    const ohneNetz = (async () => {
      throw new TypeError('Failed to fetch')
    }) as unknown as typeof fetch

    const ergebnis = await checkForUpdate('0.15.2', ohneNetz)

    expect(ergebnis.status).toBe('failed')
    if (ergebnis.status !== 'failed') return
    expect(ergebnis.message).toContain('nicht erreichbar')
    expect(ergebnis.message).not.toContain('Failed to fetch')
  })
})
