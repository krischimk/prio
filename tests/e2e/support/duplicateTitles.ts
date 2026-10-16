import { expect, type Page } from '@playwright/test'
import * as desktop from './helpers'
import * as phone from './mobile'

export async function duplicateTitlesParity(page: Page, mobile: boolean) {
  const createList = mobile ? phone.createList : desktop.createList
  const createTask = mobile ? phone.createTask : desktop.createTask
  await (mobile ? phone.register : desktop.register)(page, desktop.uniqueEmail('duplicates'))
  await createList(page, 'Packen')
  await createTask(page, 'Zelt')
  const settings = await desktop.openListSettings(page)
  const duplicates = settings.getByLabel('Gleiche Aufgabennamen erlauben', { exact: true })
  await expect(duplicates).toBeChecked()
  await settings.getByLabel('Erledigt am Listenende', { exact: true }).check()
  await expect(settings.getByLabel('Erledigt am Listenende', { exact: true })).toBeEnabled()
  await duplicates.uncheck()
  await expect(duplicates).toBeEnabled()
  await desktop.closeListSettings(page)
  await page.getByLabel('Aufgabe erledigen: Zelt', { exact: true }).click()
  await expect(page.getByRole('button', { name: 'Erledigt 1', exact: true })).toBeVisible()
  if (mobile) await page.getByRole('button', { name: 'Neue Aufgabe', exact: true }).click()
  const form = mobile ? page.getByRole('dialog', { name: 'Neue Aufgabe', exact: true }) : page.getByRole('form', { name: 'Neue Aufgabe anlegen' })
  await form.getByLabel(mobile ? 'Titel' : 'Neue Aufgabe', { exact: true }).fill(' ZELT ')
  await form.getByRole('button', { name: mobile ? 'Speichern' : 'Hinzufügen', exact: true }).click()
  await expect(form.getByRole('alert')).toContainText('bereits eine offene oder erledigte Aufgabe')
  await expect(form.getByLabel(mobile ? 'Titel' : 'Neue Aufgabe', { exact: true })).toHaveValue(' ZELT ')
  await form.getByLabel(mobile ? 'Titel' : 'Neue Aufgabe', { exact: true }).fill('Schlafsack')
  await form.getByRole('button', { name: mobile ? 'Speichern' : 'Hinzufügen', exact: true }).click()
  await expect(page.getByTestId('task-row').filter({ hasText: 'Schlafsack' })).toBeVisible()
  await desktop.openListSettings(page)
  await duplicates.check()
  await expect(duplicates).toBeEnabled()
  await desktop.closeListSettings(page)
  await createTask(page, 'Zelt')
  await expect(page.getByLabel('Aufgabe erledigen: Zelt', { exact: true })).toBeVisible()
}
