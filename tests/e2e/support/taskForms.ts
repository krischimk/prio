import { expect, type Locator, type Page } from '@playwright/test'
import { overviewModeLabel } from '../../../src/ui/overviewMode'

/** Die Fachabläufe bedienen die sichtbaren deutschen Datumsfelder. */
export async function fillDateTime(scope: Page | Locator, label: string, value: string, index = 0) {
  const [day, time] = value.split('T')
  const [year, month, date] = day.split('-')
  const field = scope.getByLabel(label, { exact: true }).nth(index)
  await field.fill(`${date}.${month}.${year}`)
  await field.press('Tab')
  await scope.getByLabel(`${label}: Uhrzeit`, { exact: true }).nth(index).fill(time.slice(0, 5))
  await scope.getByLabel(`${label}: Uhrzeit`, { exact: true }).nth(index).press('Tab')
}

export async function setDueAt(scope: Page | Locator, value: string) {
  const open = scope.getByRole('button', { name: 'Fälligkeit und Wiederholung bearbeiten', exact: true })
  if (await open.getAttribute('aria-expanded') === 'false') await open.click()
  await fillDateTime(scope, 'Fällig am', value)
}

export async function moreOptions(scope: Page | Locator) {
  const summary = scope.getByText('Mehr Optionen', { exact: true })
  if (await summary.locator('..').getAttribute('open') === null) await summary.click()
}

export async function addReminder(scope: Page | Locator) {
  await scope.getByRole('button', { name: /^(Erinnerung hinzufügen|Weitere Erinnerung)$/ }).click()
}

export async function setOverviewMode(page: Page, mode: 'newest' | 'by_list' | 'priority') {
  await page.getByRole('button', { name: 'Sortierung ändern', exact: true }).click()
  const field = page.getByLabel('Ansicht der Gesamtansicht', { exact: true })
  await field.getByRole('radio', { name: overviewModeLabel[mode], exact: true }).click()
  await expect(field).toBeHidden()
}

export async function expectOverviewMode(page: Page, mode: 'newest' | 'by_list' | 'priority') {
  await page.getByRole('button', { name: 'Sortierung ändern', exact: true }).click()
  await expect(page.getByRole('radio', { name: overviewModeLabel[mode], exact: true })).toBeChecked()
  await page.keyboard.press('Escape')
  await expect(page.getByLabel('Ansicht der Gesamtansicht', { exact: true })).toBeHidden()
  await expect(page.getByRole('button', { name: 'Sortierung ändern', exact: true })).toBeFocused()
}
