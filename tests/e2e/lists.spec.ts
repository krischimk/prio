import { expect, test, type Page } from '@playwright/test'
import { createList, register, resetServer, uniqueEmail } from './support/helpers'

/**
 * Listenverwaltung in der **breiten** Ansicht.
 *
 * Gegenstück zu den Fällen in `mobile.spec.ts`: Jede Aktion muss auf beiden
 * Oberflächen erreichbar sein. Genau das war schon einmal verletzt – die
 * Symbolauswahl gab es nur auf dem Telefon. Diese Tests halten die Regel fest
 * (siehe `AGENTS.md`, Abschnitt „Oberfläche“).
 */
test.beforeEach(async ({ request }) => {
  await resetServer(request)
})

/** Ein Fälligkeitswert für morgen – wie ihn `datetime-local` erwartet. */
function morgenUm(stunde: number): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  const zweistellig = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${zweistellig(d.getMonth() + 1)}-${zweistellig(d.getDate())}T${zweistellig(stunde)}:00`
}

/** Das Symbol am Listentitel – nicht die Symbole in der Auswahl. */
function titelIcon(page: Page) {
  return page.getByTestId('list-title').locator('..').getByTestId('list-icon')
}

/** Das Symbol der Liste in der Seitenleiste. */
function seitenleistenIcon(page: Page) {
  return page.getByRole('complementary', { name: 'Listen' }).getByTestId('list-icon')
}

test('benennt eine Liste in der breiten Ansicht um', async ({ page }) => {
  await register(page, uniqueEmail('l1'))
  await createList(page, 'Erster Name')

  await page.getByRole('button', { name: 'Umbenennen', exact: true }).click()
  await page.getByLabel('Neuer Listenname').fill('Zweiter Name')
  await page.getByRole('button', { name: 'Speichern', exact: true }).click()

  await expect(page.getByTestId('list-title')).toHaveText('Zweiter Name')
})

test('gibt einer Liste in der breiten Ansicht ein Symbol', async ({ page }) => {
  await register(page, uniqueEmail('l2'))
  await createList(page, 'Haushalt')

  await page.getByRole('button', { name: 'Symbol', exact: true }).click()

  const auswahl = page.getByTestId('icon-picker')
  await expect(auswahl).toBeVisible()
  await auswahl.getByRole('button', { name: 'Sport' }).click()

  // Am Listentitel und in der Seitenleiste. Bewusst eng gefasst: Die Auswahl
  // selbst besteht aus lauter Symbolen.
  await expect(titelIcon(page)).toHaveAttribute('data-icon', 'std:sport')
  await expect(seitenleistenIcon(page)).toHaveAttribute('data-icon', 'std:sport')
})

test('entfernt das Symbol einer Liste in der breiten Ansicht', async ({ page }) => {
  await register(page, uniqueEmail('l3'))
  await createList(page, 'Haushalt')

  await page.getByRole('button', { name: 'Symbol', exact: true }).click()
  await page.getByTestId('icon-picker').getByRole('button', { name: 'Musik' }).click()
  await expect(titelIcon(page)).toHaveAttribute('data-icon', 'std:music')

  await page.getByRole('button', { name: 'Symbol entfernen' }).click()
  await expect(titelIcon(page)).toHaveCount(0)
  await expect(seitenleistenIcon(page)).toHaveCount(0)
})

test('löscht eine Liste in der breiten Ansicht', async ({ page }) => {
  await register(page, uniqueEmail('l4'))
  await createList(page, 'Wegwerfliste')

  await page.getByRole('button', { name: 'Liste löschen', exact: true }).click()
  await page.getByRole('button', { name: 'Wirklich löschen', exact: true }).click()

  await expect(page.getByText('Lege links eine Liste an, um Aufgaben zu erfassen.')).toBeVisible()
})

test('teilt eine Liste in der breiten Ansicht', async ({ page }) => {
  await register(page, uniqueEmail('l5'))
  await createList(page, 'Geteilte Liste')

  await page.getByRole('button', { name: 'Teilen', exact: true }).click()

  await expect(page.getByRole('form', { name: 'Liste teilen' })).toBeVisible()
  await expect(page.getByText('Noch keine Mitglieder.')).toBeVisible()
})

test('macht eine Aufgabe in der breiten Ansicht wiederkehrend', async ({ page }) => {
  await register(page, uniqueEmail('l6'))
  await createList(page, 'Routinen')

  await page.getByLabel('Neue Aufgabe', { exact: true }).fill('Zähne putzen')
  await page.getByRole('button', { name: 'Hinzufügen', exact: true }).click()

  const morgen = new Date()
  morgen.setDate(morgen.getDate() + 1)
  const zweistellig = (n: number) => String(n).padStart(2, '0')
  const eingabe = `${morgen.getFullYear()}-${zweistellig(morgen.getMonth() + 1)}-${zweistellig(morgen.getDate())}T09:00`

  const zeile = page.getByTestId('task-list').locator('li').filter({ hasText: 'Zähne putzen' })
  await zeile.getByRole('button', { name: 'Bearbeiten' }).click()

  const formular = page.getByRole('form', { name: /Aufgabe bearbeiten/ })
  await formular.getByLabel('Fällig am (optional)', { exact: true }).fill(eingabe)
  await formular.getByLabel('Wiederholung', { exact: true }).selectOption('daily')
  await formular.getByRole('button', { name: 'Speichern' }).click()

  await expect(zeile).toContainText('Täglich')

  // Abhaken: Die Aufgabe bleibt mit dem nächsten Termin stehen.
  const vorher = await zeile.innerText()
  await zeile.getByRole('checkbox').click()
  await expect(zeile).toBeVisible()
  await expect(zeile).toContainText('Täglich')
  // Wartende Zusicherung: Das Schreiben in die Datenbank ist asynchron.
  await expect(zeile).not.toHaveText(vorher)

  // Auch die fortgeschriebene Aufgabe bleibt sieben Tage auffindbar – eine
  // Regel für alle. Der Nachfolger steht daneben offen in der Liste.
  await page.getByRole('button', { name: 'Wiederherstellen', exact: true }).click()
  const panel = page.getByRole('dialog', { name: 'Aufgaben wiederherstellen' })
  await expect(panel.locator('li').filter({ hasText: 'Zähne putzen' })).toBeVisible()
})

test('holt eine abgehakte Aufgabe in der breiten Ansicht zurück', async ({ page }) => {
  await register(page, uniqueEmail('l7'))
  await createList(page, 'Haushalt')

  await page.getByLabel('Neue Aufgabe', { exact: true }).fill('Müll rausbringen')
  await page.getByRole('button', { name: 'Hinzufügen', exact: true }).click()

  const zeile = page.getByTestId('task-list').locator('li').filter({ hasText: 'Müll rausbringen' })
  await zeile.getByRole('checkbox').click()
  await expect(zeile).toHaveCount(0)

  // Abgehakt heißt: aus der Liste verschwunden, aber sieben Tage auffindbar.
  await page.getByRole('button', { name: 'Wiederherstellen', exact: true }).click()
  const panel = page.getByRole('dialog', { name: 'Aufgaben wiederherstellen' })
  const eintrag = panel.locator('li').filter({ hasText: 'Müll rausbringen' })
  await expect(eintrag).toBeVisible()
  await expect(eintrag).toContainText('Haushalt')

  await eintrag.getByRole('button', { name: 'Wiederherstellen' }).click()

  // Zurück in der Liste – und nicht mehr im Fenster.
  await expect(page.getByTestId('task-list').locator('li').filter({ hasText: 'Müll rausbringen' })).toBeVisible()
  await expect(panel.locator('li').filter({ hasText: 'Müll rausbringen' })).toHaveCount(0)
})

test('setzt in der breiten Ansicht einen eigenen Vorlauf für eine wiederkehrende Aufgabe', async ({ page }) => {
  await register(page, uniqueEmail('l8'))
  await createList(page, 'Routinen')

  await page.getByLabel('Neue Aufgabe', { exact: true }).fill('Zähne putzen')
  await page.getByRole('button', { name: 'Hinzufügen', exact: true }).click()

  const zeile = page.getByTestId('task-list').locator('li').filter({ hasText: 'Zähne putzen' })
  await zeile.getByRole('button', { name: 'Bearbeiten' }).click()

  const formular = page.getByRole('form', { name: /Aufgabe bearbeiten/ })
  await formular.getByLabel('Fällig am (optional)', { exact: true }).fill(morgenUm(9))
  await formular.getByLabel('Wiederholung', { exact: true }).selectOption('daily')

  // Die Form folgt der Wiederholung: relativer Vorlauf statt Zeitpunkt.
  await formular.getByLabel('Erinnerung', { exact: true }).selectOption('custom')
  await formular.getByLabel('Stunden vorher oder nachher', { exact: true }).fill('4')

  await expect(formular.getByText(/4 Std vorher/)).toBeVisible()
  await formular.getByRole('button', { name: 'Speichern' }).click()

  await expect(zeile).toContainText('Erinnert:')
})

test('nimmt einen Vorlauf in der breiten Ansicht in die Schnellauswahl auf', async ({ page }) => {
  await register(page, uniqueEmail('l9'))
  await createList(page, 'Routinen')

  await page.getByLabel('Neue Aufgabe', { exact: true }).fill('Gießen')
  await page.getByRole('button', { name: 'Hinzufügen', exact: true }).click()

  const zeile = page.getByTestId('task-list').locator('li').filter({ hasText: 'Gießen' })
  await zeile.getByRole('button', { name: 'Bearbeiten' }).click()

  const formular = page.getByRole('form', { name: /Aufgabe bearbeiten/ })
  await formular.getByLabel('Fällig am (optional)', { exact: true }).fill(morgenUm(9))
  await formular.getByLabel('Wiederholung', { exact: true }).selectOption('weekly')
  await formular.getByLabel('Erinnerung', { exact: true }).selectOption('custom')
  await formular.getByLabel('Stunden vorher oder nachher', { exact: true }).fill('6')

  await formular.getByRole('button', { name: 'In die Schnellauswahl aufnehmen' }).click()
  await expect(
    formular.getByRole('button', { name: 'Aus der Schnellauswahl entfernen' }),
  ).toBeVisible()

  await formular.getByRole('button', { name: 'Speichern' }).click()
  await expect(zeile).toBeVisible()

  // Beim nächsten Mal steht der Wert direkt in der Auswahl.
  await zeile.getByRole('button', { name: 'Bearbeiten' }).click()
  await expect(
    page.getByRole('form', { name: /Aufgabe bearbeiten/ }).getByLabel('Erinnerung', { exact: true }),
  ).toContainText('6 Std vorher')
})
