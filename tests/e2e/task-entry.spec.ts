import { selectOption } from './support/select'
import { expect, test } from '@playwright/test'
import { createList, register, resetServer, serverState, taskItem, uniqueEmail } from './support/helpers'
import { openOverview } from './support/overview'

test.beforeEach(async ({ request }) => resetServer(request))

for (const overview of [false, true]) test.describe(overview ? 'Erfassung Gesamtansicht' : 'Erfassung Liste', () => {
  test.beforeEach(async ({ page }) => {
    await register(page, uniqueEmail('quick-entry'))
    await createList(page, 'Arbeit')
    if (overview) await openOverview(page, false)
    const composer = page.getByRole('form', { name: 'Neue Aufgabe anlegen', exact: true })
    await composer.getByLabel('Neue Aufgabe', { exact: true }).fill('Erste Aufgabe')
    if (overview) await selectOption(composer.getByLabel('Zielliste', { exact: true }), { label: 'Arbeit' })
  })

  test('Enter erlaubt direktes Weitertippen und erneutes Anlegen', async ({ page, request }) => {
    const title = page.getByLabel('Neue Aufgabe', { exact: true })
    await title.press('Enter')
    await expect(title).toHaveValue('')
    await expect(title).toBeFocused()
    await page.keyboard.type('Zweite Aufgabe')
    await page.keyboard.press('Enter')
    await expect(title).toHaveValue('')
    await expect(title).toBeFocused()
    await expect.poll(async () => (await serverState(request)).tasks.map(task => task.title).sort()).toEqual(['Erste Aufgabe', 'Zweite Aufgabe'])
    if (!overview) {
      await expect(taskItem(page, 'Erste Aufgabe')).toBeVisible()
      await expect(taskItem(page, 'Zweite Aufgabe')).toBeVisible()
    }
  })

  test('Strg+Enter in der Notiz speichert und fokussiert den nächsten Titel', async ({ page, request }) => {
    const composer = page.getByRole('form', { name: 'Neue Aufgabe anlegen', exact: true })
    const description = composer.getByLabel('Notiz', { exact: true })
    await description.fill('Erster Absatz.')
    await description.press('Enter')
    await page.keyboard.type('Zweiter Absatz.')
    await expect(description.locator('p')).toHaveText(['Erster Absatz.', 'Zweiter Absatz.'])
    await expect.poll(async () => (await serverState(request)).tasks).toHaveLength(0)
    await description.press('Control+Enter')
    await expect(composer.getByLabel('Neue Aufgabe', { exact: true })).toHaveValue('')
    await expect(composer.getByLabel('Neue Aufgabe', { exact: true })).toBeFocused()
    await expect.poll(async () => (await serverState(request)).tasks.map(task => task.description)).toEqual(['Erster Absatz.\n\nZweiter Absatz.'])
    await page.keyboard.type('Direkt weitertippen')
    await page.keyboard.press('Enter')
    await expect.poll(async () => (await serverState(request)).tasks.map(task => task.title).sort()).toEqual(['Direkt weitertippen', 'Erste Aufgabe'])
  })
})
