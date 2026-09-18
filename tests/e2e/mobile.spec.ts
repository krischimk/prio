import { expect, test, type Page } from '@playwright/test'
import { resetServer, uniqueEmail } from './support/helpers'

/**
 * E2E-Tests der mobilen Oberfläche.
 *
 * Das Telefonformat (390 × 844) ist entscheidend: Ab 768 px Breite zeigt die
 * App die Desktop-Ansicht mit Seitenleiste. Diese Tests prüfen also genau den
 * Weg, den man auf dem Handy geht – Menü statt Seitenleiste, Antippen statt
 * Knöpfe, Langdruck zum Verschieben.
 */
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true })

const PASSWORD = 'geheim123'

test.beforeEach(async ({ request }) => {
  await resetServer(request)
})

async function register(page: Page, email: string): Promise<void> {
  await page.goto('/')
  await page.getByRole('button', { name: 'Registrieren', exact: true }).click()
  await page.getByLabel('E-Mail', { exact: true }).fill(email)
  await page.getByLabel('Passwort', { exact: true }).fill(PASSWORD)
  await page.getByRole('button', { name: 'Konto erstellen', exact: true }).click()
  await expect(page.getByTestId('app-bar-title')).toBeVisible()
}

async function openMenu(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Menü öffnen' }).click()
  await expect(page.getByRole('dialog', { name: 'Menü' })).toBeVisible()
}

async function createList(page: Page, name: string): Promise<void> {
  await openMenu(page)
  await page.getByLabel('Name der neuen Liste', { exact: true }).fill(name)
  await page.getByRole('button', { name: 'Liste anlegen', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Menü' })).toBeHidden()
  await expect(page.getByTestId('app-bar-title')).toHaveText(name)
}

async function createTask(page: Page, title: string, description?: string): Promise<void> {
  await page.getByRole('button', { name: 'Neue Aufgabe' }).click()
  await expect(page.getByRole('dialog', { name: 'Neue Aufgabe' })).toBeVisible()
  await page.getByLabel('Titel', { exact: true }).fill(title)
  if (description) {
    await page.getByLabel('Beschreibung (optional)', { exact: true }).fill(description)
  }
  await page.getByRole('button', { name: 'Speichern', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Neue Aufgabe' })).toBeHidden()
}

/** Aufgabenzeile anhand ihres Titels. */
function taskRow(page: Page, title: string) {
  return page.getByTestId('task-row').filter({ hasText: title })
}

test('legt über das Menü eine Liste und über den Plus-Knopf eine Aufgabe an', async ({ page }) => {
  await register(page, uniqueEmail('m1'))

  // Ohne Liste weist die App den Weg über das Menü.
  await expect(page.getByText('Öffne oben links das Menü')).toBeVisible()

  await createList(page, 'Haushalt')
  await expect(page.getByText('Noch keine Aufgaben in dieser Liste.')).toBeVisible()

  await createTask(page, 'Milch kaufen', 'Samstagmorgen')
  await expect(taskRow(page, 'Milch kaufen')).toBeVisible()
  await expect(taskRow(page, 'Milch kaufen')).toContainText('Samstagmorgen')
  await expect(page.getByText('1 offene Aufgabe')).toBeVisible()

  // Die Liste selbst zeigt keine Bearbeiten-/Löschen-Knöpfe.
  await expect(page.getByRole('button', { name: 'Bearbeiten' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Löschen' })).toHaveCount(0)
})

test('hakt eine Aufgabe direkt in der Liste ab', async ({ page }) => {
  await register(page, uniqueEmail('m2'))
  await createList(page, 'Haushalt')
  await createTask(page, 'Wohnung saugen')

  const checkbox = page.getByLabel('Aufgabe erledigen: Wohnung saugen')
  await checkbox.click()

  await expect(checkbox).toBeChecked()
  await expect(page.getByText('0 offene Aufgaben')).toBeVisible()
})

test('öffnet per Antippen die Detailansicht und ändert den Titel', async ({ page }) => {
  await register(page, uniqueEmail('m3'))
  await createList(page, 'Haushalt')
  await createTask(page, 'Alter Titel')

  await taskRow(page, 'Alter Titel').click()
  await expect(page.getByRole('dialog', { name: 'Aufgabe' })).toBeVisible()

  await page.getByLabel('Titel', { exact: true }).fill('Neuer Titel')
  await page.getByLabel('Beschreibung (optional)', { exact: true }).fill('Mit Notiz')
  await page.getByRole('button', { name: 'Speichern', exact: true }).click()

  await expect(page.getByRole('dialog', { name: 'Aufgabe' })).toBeHidden()
  await expect(taskRow(page, 'Neuer Titel')).toBeVisible()
  await expect(taskRow(page, 'Neuer Titel')).toContainText('Mit Notiz')
})

test('löscht eine Aufgabe in der Detailansicht', async ({ page }) => {
  await register(page, uniqueEmail('m4'))
  await createList(page, 'Haushalt')
  await createTask(page, 'Wird gelöscht')

  await taskRow(page, 'Wird gelöscht').click()
  await page.getByRole('button', { name: 'Aufgabe löschen' }).click()
  await page.getByRole('button', { name: 'Wirklich löschen' }).click()

  await expect(page.getByText('Noch keine Aufgaben in dieser Liste.')).toBeVisible()
})

test('verschiebt eine Aufgabe per Langdruck in eine andere Liste', async ({ page }) => {
  await register(page, uniqueEmail('m5'))
  await createList(page, 'Haushalt')
  await createTask(page, 'Wandert weiter')
  await createList(page, 'Arbeit')

  // Das Anlegen einer Liste wechselt dorthin – für den Langdruck zurück.
  await openMenu(page)
  await page.getByRole('button', { name: 'Haushalt', exact: true }).click()
  await expect(page.getByTestId('app-bar-title')).toHaveText('Haushalt')

  // Langdruck: drücken, kurz halten, loslassen.
  const row = taskRow(page, 'Wandert weiter')
  const box = await row.boundingBox()
  expect(box).not.toBeNull()
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2)
  await page.mouse.down()
  await page.waitForTimeout(700)
  await page.mouse.up()

  const sheet = page.getByRole('dialog', { name: 'Aufgabe verschieben' })
  await expect(sheet).toBeVisible()
  // Die eigene Liste wird nicht angeboten.
  await expect(sheet.getByRole('button', { name: 'Haushalt' })).toHaveCount(0)
  await sheet.getByRole('button', { name: 'Arbeit' }).click()
  await expect(sheet).toBeHidden()

  // In der Quellliste ist sie weg.
  await expect(page.getByText('Noch keine Aufgaben in dieser Liste.')).toBeVisible()

  // Im Menü auf die andere Liste wechseln – dort liegt sie jetzt.
  await openMenu(page)
  await page.getByRole('button', { name: 'Arbeit', exact: true }).click()
  await expect(page.getByTestId('app-bar-title')).toHaveText('Arbeit')
  await expect(taskRow(page, 'Wandert weiter')).toBeVisible()

  // Zurück in der Ausgangsliste ebenfalls prüfbar.
  await openMenu(page)
  await page.getByRole('button', { name: 'Haushalt', exact: true }).click()
  await expect(page.getByTestId('app-bar-title')).toHaveText('Haushalt')
  await expect(page.getByText('Noch keine Aufgaben in dieser Liste.')).toBeVisible()
})

test('schließt das Menü mit Escape', async ({ page }) => {
  await register(page, uniqueEmail('m6'))
  await createList(page, 'Haushalt')

  await openMenu(page)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: 'Menü' })).toBeHidden()
})
