import { expect, test } from '@playwright/test'

/**
 * Der PWA-Weg: Service Worker, Cache, Offline-Start.
 *
 * Läuft in einem eigenen Playwright-Projekt gegen den **Produktionsbuild**
 * (`vite preview`, siehe `playwright.config.ts`), weil sich der Service Worker
 * nur dort registriert. Die übrigen E2E-Tests laufen gegen den
 * Entwicklungsserver und berühren diesen Weg nie.
 *
 * Genau deshalb blieben zwei Fehler lange unbemerkt: Die Dateien mit
 * Inhalts-Hash fehlten im Cache, und wegen `Vary` in den Antworten traf die
 * Suche ohnehin nicht. Der erste Offline-Start zeigte eine leere Seite – eine
 * installierte PWA, die offline nichts anzeigt.
 */
test('registriert den Service Worker und legt die App vollständig in den Cache', async ({ page }) => {
  await page.goto('/')

  const registrierung = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready
    return { scope: reg.scope, aktiv: Boolean(reg.active) }
  })
  expect(registrierung.aktiv).toBe(true)
  expect(registrierung.scope).toBe(`${new URL(page.url()).origin}/`)

  // Was das HTML zum Start braucht, muss im Cache liegen – sonst bleibt der
  // Offline-Start leer, weil das HTML aus dem Cache kommt und sein JavaScript
  // nicht.
  const cache = await page.evaluate(async () => {
    const namen = await caches.keys()
    const speicher = await caches.open(namen[0])
    const pfade = (await speicher.keys()).map((anfrage) => new URL(anfrage.url).pathname)
    const verweise = [...document.querySelectorAll('script[src], link[rel=stylesheet]')].map(
      (element) => new URL((element as HTMLScriptElement).src || (element as HTMLLinkElement).href).pathname,
    )
    return { pfade, verweise }
  })
  expect(cache.pfade).toContain('/index.html')
  expect(cache.verweise.length).toBeGreaterThan(0)
  for (const verweis of cache.verweise) {
    expect(cache.pfade, `${verweis} fehlt im Cache`).toContain(verweis)
  }

  const manifest = await page.evaluate(async () => {
    const link = document.querySelector('link[rel=manifest]')
    if (!link) return null
    return (await fetch(link.getAttribute('href') ?? '')).json()
  })
  expect(manifest?.name).toBeTruthy()
  expect(manifest?.start_url).toBe('/')
  expect(manifest?.icons?.length ?? 0).toBeGreaterThanOrEqual(3)
})

test('startet offline aus dem Cache, ohne fehlgeschlagene Anfrage', async ({ page, context }) => {
  await page.goto('/')
  await page.evaluate(() => navigator.serviceWorker.ready)

  // Jede fehlgeschlagene Anfrage ist der Fehler: HTML kommt aus dem Cache,
  // die Bundles nicht.
  const fehlgeschlagen: string[] = []
  page.on('response', (antwort) => {
    if (antwort.status() >= 400) fehlgeschlagen.push(`${antwort.status()} ${antwort.url()}`)
  })
  page.on('requestfailed', (anfrage) => fehlgeschlagen.push(`fehlgeschlagen ${anfrage.url()}`))

  await context.setOffline(true)
  await page.reload()

  // Die Anmeldemaske beweist, dass das Bundle geladen wurde – ohne es wäre die
  // Seite leer.
  await expect(page.getByLabel('E-Mail', { exact: true })).toBeVisible()
  expect(fehlgeschlagen).toEqual([])
})
