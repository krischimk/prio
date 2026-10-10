import { expect, test } from '@playwright/test'
import { resetServer, uniqueEmail, selectList } from './support/helpers'
import * as telefon from './support/mobile'

// Telefonformat wie in mobile.spec.ts: Ab 768 px zeigt die App die breite
// Ansicht, und die Helfer hier sind die der Telefon-Ansicht.
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true })

/**
 * Der Update-Weg: **alte Daten, neuer Code.**
 *
 * Alle anderen Tests legen ihre Daten mit dem aktuellen Code an – sie prüfen
 * damit nur den Fall „frisch installiert". Genau das hat den schwarzen
 * Bildschirm von 0.18.0 durchgelassen: Listen aus der Fassung davor haben das
 * Feld `sections` nicht, und die Ansicht griff ungeprüft darauf zu.
 *
 * Dieser Test stellt eine Zeile aus der Vorfassung her, indem er das Feld aus
 * dem IndexedDB entfernt, und lädt neu. Er läuft bewusst in beiden Ansichten,
 * weil beide Stellen betroffen waren.
 */
async function feldEntfernen(page: import('@playwright/test').Page) {
  await page.evaluate(async () => {
    const dbs = await indexedDB.databases()
    const name = dbs.map((d) => d.name ?? '').find((n) => n.startsWith('prio'))
    if (!name) throw new Error('keine prio-Datenbank gefunden')
    await new Promise<void>((fertig, fehlschlag) => {
      const anfrage = indexedDB.open(name)
      anfrage.onerror = () => fehlschlag(new Error('open fehlgeschlagen'))
      anfrage.onsuccess = () => {
        const db = anfrage.result
        const tx = db.transaction(['lists','tasks'], 'readwrite')
        const speicher = tx.objectStore('lists')
        const alle = speicher.getAll()
        alle.onsuccess = () => {
          for (const zeile of alle.result as Record<string, unknown>[]) {
            delete zeile.sections
            delete zeile.keep_completed
            delete zeile.completion_retention_started_at
            speicher.put(zeile)
          }
        }
        const aufgaben = tx.objectStore('tasks')
        const alteAufgaben = aufgaben.getAll()
        alteAufgaben.onsuccess = () => {
          for (const zeile of alteAufgaben.result as Record<string, unknown>[]) {
            delete zeile.completed_expires_at
            delete zeile.expired_at
            delete zeile.reopen_context
            aufgaben.put(zeile)
          }
        }
        tx.oncomplete = () => {
          db.close()
          fertig()
        }
      }
    })
  })
}

test('E2E 7: Listen aus einer älteren Fassung stürzen die Ansicht nicht ab', async ({
  page,
  request,
}) => {
  const fehler: string[] = []
  page.on('pageerror', (e) => fehler.push(e.message))

  await resetServer(request)
  await telefon.register(page, uniqueEmail('update'))
  await telefon.createList(page, 'Einkauf')
  await telefon.createTask(page, 'Milch')

  // Zeile aus der Fassung vor 0.18.0 herstellen.
  await page.route('**/rest/v1/**', route => route.abort())
  await feldEntfernen(page)
  await page.reload()

  await telefon.openMenu(page)
  await page.getByRole('dialog', { name: 'Menü' }).getByRole('button', { name: 'Einkauf', exact: true }).click()

  // Telefon-Ansicht
  await expect(page.getByTestId('app-bar-title')).toHaveText('Einkauf')
  await expect(telefon.taskRow(page, 'Milch')).toBeVisible()

  // Breite Ansicht: dieselbe Zeile, andere Komponente – auch sie ist betroffen.
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.reload()
  await selectList(page, 'Einkauf')
  await expect(page.getByTestId('list-title')).toHaveText('Einkauf')
  await expect(page.getByTestId('task-list')).toContainText('Milch')

  expect(fehler, `Unerwartete Fehler: ${fehler.join(' | ')}`).toEqual([])
})
