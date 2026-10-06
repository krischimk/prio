import { expect, type Page } from '@playwright/test'
import { PASSWORD } from './helpers'

/**
 * Bedienung der **mobilen** Oberfläche (Telefonformat, unter 768 px Breite).
 *
 * Gegenstück zu `helpers.ts`, das die breite Ansicht bedient. Hier stehen die
 * Wege, die es nur auf dem Telefon gibt: Menü statt Seitenleiste, App-Leiste
 * statt Kopfzeile, Antippen statt Knöpfe. Beide Dateien werden von
 * `mobile.spec.ts` und von `parity.spec.ts` benutzt – dort läuft dieselbe
 * Funktionstabelle über beide Ansichten.
 */

export async function register(page: Page, email: string): Promise<void> {
  await page.goto('/')
  await page.getByRole('button', { name: 'Registrieren', exact: true }).click()
  await page.getByLabel('E-Mail', { exact: true }).fill(email)
  await page.getByLabel('Passwort', { exact: true }).fill(PASSWORD)
  await page.getByRole('button', { name: 'Konto erstellen', exact: true }).click()
  await expect(page.getByTestId('app-bar-title')).toBeVisible()
}

export async function openMenu(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Menü öffnen' }).click()
  await expect(page.getByRole('dialog', { name: 'Menü' })).toBeVisible()
}

export async function createList(page: Page, name: string): Promise<void> {
  await openMenu(page)
  await page.getByLabel('Name der neuen Liste', { exact: true }).fill(name)
  await page.getByRole('button', { name: 'Liste anlegen', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Menü' })).toBeHidden()
  await expect(page.getByTestId('app-bar-title')).toHaveText(name)
}

export async function createTask(page: Page, title: string, description?: string): Promise<void> {
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
export function taskRow(page: Page, title: string) {
  return page.getByTestId('task-row').filter({ hasText: title })
}
