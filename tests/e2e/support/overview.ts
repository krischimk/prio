import { expect, type Page } from '@playwright/test'
import { openMenu } from './mobile'

export async function openOverview(page: Page, mobile: boolean) {
  if (mobile) await openMenu(page)
  await page.getByRole('button', { name: 'Gesamtansicht', exact: true }).click()
  if (mobile) await expect(page.getByTestId('app-bar-title')).toHaveText('Gesamtansicht')
  else await expect(page.getByRole('heading', { name: 'Gesamtansicht', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Sortierung ändern', exact: true })).toBeVisible()
}

export async function overviewSettings(page: Page) {
  await page.getByRole('button', { name: 'Listen für die Gesamtansicht auswählen', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Listen in der Gesamtansicht', exact: true })
  await expect(dialog).toBeVisible()
  return dialog
}

/** Eine echte Erfassung merkt die Zielliste; eine separate Voreinstellung gibt es nicht. */
export async function rememberOverviewTarget(page: Page, mobile: boolean, list: string) {
  if (mobile) await page.getByRole('button', { name: 'Neue Aufgabe', exact: true }).click()
  const composer = page.getByRole('form', { name: 'Neue Aufgabe anlegen', exact: true })
  await composer.getByLabel('Neue Aufgabe', { exact: true }).fill('Erste Gesamtaufgabe')
  await composer.getByLabel('Zielliste', { exact: true }).selectOption({ label: list })
  await composer.getByRole('button', { name: 'Hinzufügen', exact: true }).click()
  if (mobile) await expect(page.getByRole('dialog', { name: 'Neue Aufgabe', exact: true })).toBeHidden()
  else await expect(composer.getByLabel('Neue Aufgabe', { exact: true })).toHaveValue('')
}
