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

/** Titel aller Aufgaben in der angezeigten Reihenfolge. */
async function taskTitles(page: Page): Promise<string[]> {
  return page.getByTestId('task-row').allInnerTexts()
}

/** Hält eine Zeile gedrückt und zieht sie ein Stück nach unten. */
async function dragRowDown(page: Page, title: string, distancePx: number): Promise<void> {
  const box = await taskRow(page, title).boundingBox()
  if (!box) throw new Error(`Zeile "${title}" nicht gefunden`)

  const x = box.x + box.width / 2
  const y = box.y + box.height / 2

  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.waitForTimeout(600) // Langdruck – ab hier ist die Zeile aufgenommen
  await page.mouse.move(x, y + distancePx, { steps: 10 })
  await page.waitForTimeout(100)
  await page.mouse.up()
  await page.waitForTimeout(300)
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

test('hakt eine Aufgabe ab, die dadurch aus der Liste verschwindet', async ({ page }) => {
  await register(page, uniqueEmail('m2'))
  await createList(page, 'Haushalt')
  await createTask(page, 'Wohnung saugen')

  await page.getByLabel('Aufgabe erledigen: Wohnung saugen').click()

  // Die Aufgabe verschwindet sofort aus der Liste …
  await expect(page.getByText('Noch keine Aufgaben in dieser Liste.')).toBeVisible()

  // … und die Leiste bietet den Rückweg an.
  const leiste = page.getByTestId('undo-bar')
  await expect(leiste).toBeVisible()
  await expect(leiste).toContainText('Wohnung saugen')

  await leiste.getByRole('button', { name: 'Rückgängig' }).click()
  await expect(taskRow(page, 'Wohnung saugen')).toBeVisible()
  await expect(page.getByText('1 offene Aufgabe')).toBeVisible()
})

test('stellt eine abgehakte Aufgabe über die Einstellungen wieder her', async ({ page }) => {
  await register(page, uniqueEmail('m9'))
  await createList(page, 'Haushalt')
  await createTask(page, 'Zurückholen')

  await page.getByLabel('Aufgabe erledigen: Zurückholen').click()
  await expect(page.getByText('Noch keine Aufgaben in dieser Liste.')).toBeVisible()

  await openMenu(page)
  await page.getByRole('button', { name: 'Aufgaben wiederherstellen' }).click()

  const panel = page.getByRole('dialog', { name: 'Aufgaben wiederherstellen' })
  await expect(panel).toBeVisible()
  await expect(page.getByTestId('restore-list')).toContainText('Zurückholen')
  await expect(page.getByTestId('restore-list')).toContainText('Haushalt')

  await panel.getByRole('button', { name: 'Wiederherstellen' }).click()
  await expect(page.getByTestId('restore-empty')).toBeVisible()

  await panel.getByRole('button', { name: 'Schließen' }).click()
  await expect(taskRow(page, 'Zurückholen')).toBeVisible()
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

test('verschiebt eine Aufgabe über die Detailansicht in eine andere Liste', async ({ page }) => {
  await register(page, uniqueEmail('m5'))
  await createList(page, 'Haushalt')
  await createTask(page, 'Wandert weiter')
  await createList(page, 'Arbeit')

  // Das Anlegen einer Liste wechselt dorthin – für den Test zurück.
  await openMenu(page)
  await page.getByRole('button', { name: 'Haushalt', exact: true }).click()
  await expect(page.getByTestId('app-bar-title')).toHaveText('Haushalt')

  // In der Liste gibt es dafür keine Geste und keinen Knopf – nur die Zeile.
  await expect(page.getByRole('button', { name: 'In andere Liste verschieben' })).toHaveCount(0)

  await taskRow(page, 'Wandert weiter').click()
  await expect(page.getByRole('dialog', { name: 'Aufgabe' })).toBeVisible()
  await page.getByRole('button', { name: 'In andere Liste verschieben' }).click()

  const sheet = page.getByRole('dialog', { name: 'Aufgabe verschieben' })
  await expect(sheet).toBeVisible()
  // Die eigene Liste wird nicht angeboten.
  await expect(sheet.getByRole('button', { name: 'Haushalt' })).toHaveCount(0)
  await sheet.getByRole('button', { name: 'Arbeit' }).click()
  await expect(sheet).toBeHidden()

  // Die Detailansicht bleibt offen; schließen zeigt die leere Quellliste.
  await page.getByRole('button', { name: 'Schließen' }).click()
  await expect(page.getByText('Noch keine Aufgaben in dieser Liste.')).toBeVisible()

  // Im Menü auf die andere Liste wechseln – dort liegt sie jetzt.
  await openMenu(page)
  await page.getByRole('button', { name: 'Arbeit', exact: true }).click()
  await expect(page.getByTestId('app-bar-title')).toHaveText('Arbeit')
  await expect(taskRow(page, 'Wandert weiter')).toBeVisible()
})

test('schließt das Menü mit Escape', async ({ page }) => {
  await register(page, uniqueEmail('m6'))
  await createList(page, 'Haushalt')

  await openMenu(page)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: 'Menü' })).toBeHidden()
})

test('sortiert eine Aufgabe per Langdruck und Ziehen um', async ({ page }) => {
  await register(page, uniqueEmail('m7'))
  await createList(page, 'Reihenfolge')
  await createTask(page, 'Erste')
  await createTask(page, 'Zweite')
  await createTask(page, 'Dritte')

  expect(await taskTitles(page)).toEqual(['Erste', 'Zweite', 'Dritte'])

  // Erste Zeile aufnehmen und unter die dritte ziehen.
  await dragRowDown(page, 'Erste', 150)

  expect(await taskTitles(page)).toEqual(['Zweite', 'Dritte', 'Erste'])

  // Die Reihenfolge ist gespeichert, nicht nur Anzeige.
  await page.reload()
  await expect(page.getByTestId('app-bar-title')).toHaveText('Reihenfolge')
  expect(await taskTitles(page)).toEqual(['Zweite', 'Dritte', 'Erste'])
})

test('sortiert bei kurzem Wischen nicht um', async ({ page }) => {
  await register(page, uniqueEmail('m8'))
  await createList(page, 'Reihenfolge')
  await createTask(page, 'Erste')
  await createTask(page, 'Zweite')

  // Zu kurz für den Langdruck – das ist ein Scrollversuch.
  const box = await taskRow(page, 'Erste').boundingBox()
  if (box) {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 120, { steps: 8 })
    await page.mouse.up()
    await page.waitForTimeout(200)
  }

  expect(await taskTitles(page)).toEqual(['Erste', 'Zweite'])
})

test('benennt eine Liste über die App-Leiste um', async ({ page }) => {
  await register(page, uniqueEmail('m10'))
  await createList(page, 'Erster Name')

  await page.getByTestId('app-bar-title').click()
  await expect(page.getByRole('dialog', { name: 'Liste verwalten' })).toBeVisible()
  await page.getByRole('button', { name: 'Umbenennen' }).click()

  await page.getByLabel('Neuer Name').fill('Zweiter Name')
  await page.getByRole('button', { name: 'Speichern', exact: true }).click()

  await expect(page.getByRole('dialog', { name: 'Liste verwalten' })).toBeHidden()
  await expect(page.getByTestId('app-bar-title')).toHaveText('Zweiter Name')
})

test('löscht eine Liste über die App-Leiste', async ({ page }) => {
  await register(page, uniqueEmail('m11'))
  await createList(page, 'Wegwerfliste')

  await page.getByTestId('app-bar-title').click()
  await page.getByRole('button', { name: 'Liste löschen' }).click()
  // Erst nach der Rückfrage wird wirklich gelöscht.
  await page.getByRole('button', { name: 'Wirklich löschen' }).click()

  await expect(page.getByRole('dialog', { name: 'Liste verwalten' })).toBeHidden()
  await expect(page.getByText('Öffne oben links das Menü und lege eine Liste an.')).toBeVisible()
})
