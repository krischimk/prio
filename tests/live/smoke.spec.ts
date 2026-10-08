import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

/**
 * Rauchprüfung der veröffentlichten Fassung.
 *
 * Sie meldet sich mit dem Testkonto an, legt eine Liste und eine Aufgabe an und
 * sieht nach, ob der Abgleich durchläuft. Damit fallen drei Dinge auf, die in
 * den lokalen Tests unsichtbar sind:
 *
 *  * ein Bündel, das beim Nutzer gar nicht startet (schwarzer Bildschirm),
 *  * eine fehlende Spalte auf dem Server (PGRST204),
 *  * eine verletzte Zugriffsregel („permission denied").
 *
 * Der Fall von 0.18.0 – schwarzer Bildschirm über bestehenden Daten – wäre hier
 * aufgefallen, **bevor** ihn jemand meldet.
 */
function konto(): { email: string; passwort: string } | null {
  // Im CI kommen die Werte aus Secrets (Umgebungsvariablen), lokal aus der
  // privaten Ablage. Derselbe Weg wie bei der Datenbank-Verbindung.
  const ausUmgebung = {
    email: process.env.PRIO_TEST_A_EMAIL,
    passwort: process.env.PRIO_TEST_A_PASSWORT,
  }
  if (ausUmgebung.email && ausUmgebung.passwort) {
    return { email: ausUmgebung.email, passwort: ausUmgebung.passwort }
  }
  try {
    const inhalt = readFileSync(join(homedir(), '.prio-android', 'testkonten.env'), 'utf8')
    const werte: Record<string, string> = {}
    for (const zeile of inhalt.split('\n')) {
      const treffer = /^([A-Z_]+)\s*=\s*(.*)$/.exec(zeile.trim())
      if (treffer) werte[treffer[1]] = treffer[2]
    }
    if (!werte.PRIO_TEST_A_EMAIL || !werte.PRIO_TEST_A_PASSWORT) return null
    return { email: werte.PRIO_TEST_A_EMAIL, passwort: werte.PRIO_TEST_A_PASSWORT }
  } catch {
    return null
  }
}

test('die veröffentlichte Fassung startet, meldet sich an und gleicht ab', async ({ page }) => {
  const zugang = konto()
  test.skip(
    zugang === null,
    'Ohne Testkonto (PRIO_TEST_A_EMAIL/PASSWORT oder ~/.prio-android/testkonten.env) nicht prüfbar.',
  )

  const fehler: string[] = []
  page.on('pageerror', (e) => fehler.push(e.message))

  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Anmelden' })).toBeVisible()

  await page.getByLabel('E-Mail', { exact: true }).fill(zugang!.email)
  await page.getByLabel('Passwort', { exact: true }).fill(zugang!.passwort)
  await page.getByRole('button', { name: 'Anmelden' }).click()

  // Die App zeigt die Aufgabenliste (nicht nur „lädt") – hier fiele ein
  // schwarzer Bildschirm auf.
  await expect(page.getByTestId('app-bar-title')).toBeVisible()

  const listenname = `Rauchprüfung ${new Date().toISOString().slice(0, 16)}`
  await page.getByRole('button', { name: /Menü/ }).click()
  await page.getByLabel('Name der neuen Liste', { exact: true }).fill(listenname)
  await page.getByRole('button', { name: 'Liste anlegen', exact: true }).click()
  await expect(page.getByTestId('app-bar-title')).toHaveText(listenname)

  await page.getByRole('button', { name: 'Neue Aufgabe' }).click()
  await expect(page.getByRole('dialog', { name: 'Neue Aufgabe' })).toBeVisible()
  await page.getByLabel('Titel', { exact: true }).fill('Rauchprüfung')
  await page.getByRole('button', { name: 'Speichern', exact: true }).click()
  await expect(page.getByTestId('task-row').filter({ hasText: 'Rauchprüfung' })).toBeVisible()

  // Abgleich: Der Status steht im Menü. Hier schlägt PGRST204 oder eine
  // verletzte Regel sichtbar fehl.
  await page.getByRole('button', { name: /Menü/ }).click()
  await expect(page.getByText('Alles synchronisiert.')).toBeVisible({ timeout: 30_000 })

  const inhalt = (await page.locator('body').innerText()).toLowerCase()
  for (const verdacht of ['pgrst', 'could not find', 'permission denied', 'jwt', 'fehlgeschlagen']) {
    expect(inhalt, `Verdächtiger Text: ${verdacht}`).not.toContain(verdacht)
  }

  // Aufräumen: die Prüfliste wieder entfernen. Das Menü ist offen, also erst
  // schließen – die Listeneinstellungen öffnet ein Tippen auf den Listennamen.
  await page.keyboard.press('Escape')
  await page.getByTestId('app-bar-title').click()
  await expect(page.getByRole('dialog', { name: 'Liste verwalten' })).toBeVisible()
  // Kein Bestätigungsdialog mehr: Löschen wirkt sofort, die Rückgängig-Leiste
  // ist der Weg zurück.
  await page.getByRole('button', { name: 'Liste löschen' }).click()
  await page.getByRole('button', { name: 'Löschen', exact: true }).click()
  await expect(page.getByTestId('app-bar-title')).not.toHaveText(listenname)

  expect(fehler, `Unerwartete Fehler: ${fehler.join(' | ')}`).toEqual([])
})
