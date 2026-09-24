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
