import { expect, type Page } from '@playwright/test'
import { openMenu } from './mobile'

export async function openOverview(page: Page, mobile: boolean) {
  if (mobile) await openMenu(page)
  await page.getByRole('button', { name: 'Gesamtansicht', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Gesamtansicht', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Sortierung ändern', exact: true })).toBeVisible()
}

export async function overviewSettings(page: Page) {
  await page.getByRole('button', { name: 'Gesamtansicht einstellen', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Gesamtansicht einstellen', exact: true })
  await expect(dialog.getByLabel('Standardliste für neue Aufgaben')).toBeVisible()
  return dialog
}
