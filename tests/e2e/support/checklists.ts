import { expect, type APIRequestContext, type Locator, type Page } from '@playwright/test'
import * as desktop from './helpers'
import * as phone from './mobile'
import { openOverview } from './overview'

export const outerTask = (page: Page, title: string) => page.locator('[data-task-row]:not([data-dnd-placeholder])').filter({ has: page.getByTestId('task-row').getByText(title, { exact: true }) })

export async function addChecklistPoint(editor: Locator, text: string) {
  await openChecklistEditor(editor)
  await editor.getByLabel('Neuer Checklistenpunkt', { exact: true }).fill(text)
  await editor.getByLabel('Neuer Checklistenpunkt', { exact: true }).press('Enter')
}

export async function openChecklistEditor(editor: Locator) {
  const toggle = editor.getByRole('button', { name: /^(Checkliste hinzufügen|Checkliste bearbeiten)$/ })
  if (await toggle.getAttribute('aria-expanded') !== 'true') await toggle.click()
}

export async function addTags(editor: Locator, tags: string[]) {
  for (const tag of tags) {
    await editor.getByLabel('Neuer Tag', { exact: true }).fill(tag)
    await editor.getByLabel('Neuer Tag', { exact: true }).press('Enter')
  }
}

export async function checklistParity(page: Page, mobile: boolean, request: APIRequestContext) {
  await (mobile ? phone.register : desktop.register)(page, desktop.uniqueEmail('checklist'))
  await (mobile ? phone.createList : desktop.createList)(page, 'Mit Schritten')
  const settings = await desktop.openListSettings(page)
  await settings.getByLabel('Erledigt am Listenende', { exact: true }).check()
  await expect(settings.getByLabel('Erledigt am Listenende', { exact: true })).toBeEnabled()
  await desktop.closeListSettings(page)
  await (mobile ? phone.createTask : desktop.createTask)(page, 'Hauptaufgabe')
  const editor = await desktop.openTaskEditor(page, 'Hauptaufgabe')
  await addChecklistPoint(editor, 'Erster Punkt')
  await addChecklistPoint(editor, 'Zweiter Punkt')
  await editor.getByRole('button', { name: 'Speichern', exact: true }).click()
  const row = outerTask(page, 'Hauptaufgabe')
  await expect(row.getByRole('button', { name: 'Checkliste: Hauptaufgabe', exact: true })).toHaveText('0/2')
  await row.getByRole('button', { name: 'Checkliste: Hauptaufgabe', exact: true }).click()
  await row.getByLabel('Checklistenpunkt: Erster Punkt', { exact: true }).check()
  await row.getByLabel('Checklistenpunkt: Zweiter Punkt', { exact: true }).check()
  await expect(row.getByRole('button', { name: 'Checkliste: Hauptaufgabe', exact: true })).toHaveText('2/2')
  await expect(row.getByLabel('Aufgabe erledigen: Hauptaufgabe', { exact: true })).not.toBeChecked()
  await row.getByLabel('Checklistenpunkt: Zweiter Punkt', { exact: true }).uncheck()
  await row.getByLabel('Aufgabe erledigen: Hauptaufgabe', { exact: true }).click()
  await page.getByTestId('section-header').filter({ hasText: 'Erledigt' }).click()
  const done = page.getByRole('region', { name: 'Erledigt', exact: true })
  await done.getByRole('button', { name: 'Checkliste: Hauptaufgabe', exact: true }).click()
  await expect(done.getByLabel('Checklistenpunkt: Erster Punkt', { exact: true })).toBeChecked()
  await expect(done.getByLabel('Checklistenpunkt: Zweiter Punkt', { exact: true })).not.toBeChecked()
  await done.getByLabel('Aufgabe wieder öffnen: Hauptaufgabe', { exact: true }).click()
  await row.getByRole('button', { name: 'Checkliste: Hauptaufgabe', exact: true }).click()
  await expect(row.getByLabel('Checklistenpunkt: Erster Punkt', { exact: true })).toBeChecked()
  await expect(row.getByLabel('Checklistenpunkt: Zweiter Punkt', { exact: true })).not.toBeChecked()
  await desktop.openTaskEditor(page, 'Hauptaufgabe')
  await openChecklistEditor(editor)
  await editor.getByLabel('Checklistenpunkt 1', { exact: true }).fill('Umbenannt')
  await editor.getByRole('button', { name: 'Checklistenpunkt löschen: Zweiter Punkt', exact: true }).click()
  await addChecklistPoint(editor, 'Neuer Punkt')
  await editor.getByRole('button', { name: 'Speichern', exact: true }).click()
  await expect.poll(async () => (await desktop.serverState(request)).tasks.find(task => task.title === 'Hauptaufgabe')?.checklist.filter(item => item.deleted_at === null).map(item => item.text)).toEqual(['Umbenannt', 'Neuer Punkt'])
  await page.reload()
  if (mobile) { await phone.openMenu(page); await page.getByRole('dialog', { name: 'Menü' }).getByRole('button', { name: /^Mit Schritten$/ }).click() }
  else await desktop.selectList(page, 'Mit Schritten')
  await expect(outerTask(page, 'Hauptaufgabe').getByRole('button', { name: 'Checkliste: Hauptaufgabe', exact: true })).toHaveText('1/2')
}

export async function tagFilterParity(page: Page, mobile: boolean) {
  await (mobile ? phone.register : desktop.register)(page, desktop.uniqueEmail('tags'))
  await (mobile ? phone.createList : desktop.createList)(page, 'Mit Tags')
  const settings = await desktop.openListSettings(page)
  await settings.getByLabel('In Gesamtansicht aufnehmen', { exact: true }).check()
  await expect(settings.getByLabel('In Gesamtansicht aufnehmen', { exact: true })).toBeEnabled()
  await desktop.closeListSettings(page)
  for (const [title, tags] of [['Nur Uni', ['Uni']], ['Beide Tags', ['Uni', 'Dringend']], ['Privat', ['Privat']]] as const) {
    await (mobile ? phone.createTask : desktop.createTask)(page, title)
    const editor = await desktop.openTaskEditor(page, title)
    await addTags(editor, [...tags])
    await editor.getByRole('button', { name: 'Speichern', exact: true }).click()
    await expect(editor).toBeHidden()
  }
  const editor = await desktop.openTaskEditor(page, 'Privat')
  await expect(editor.getByRole('group', { name: 'Vorhandene Tags' }).getByRole('button', { name: /^Uni$/ })).toBeEnabled()
  await editor.getByRole('button', { name: 'Schließen', exact: true }).click()
  for (const overview of [false, true]) {
    if (overview) await openOverview(page, mobile)
    await page.getByRole('button', { name: overview ? 'Sortierung ändern' : 'Nach Tags filtern', exact: true }).click()
    await page.getByLabel('Tagfilter: Uni', { exact: true }).check()
    await page.getByLabel('Tagfilter: Dringend', { exact: true }).check()
    await page.keyboard.press('Escape')
    await expect(page.locator('[data-task-row]')).toHaveCount(1)
    await expect(outerTask(page, 'Beide Tags')).toBeVisible()
    await expect(page.getByLabel('Aktive Tagfilter', { exact: true })).toContainText('Uni')
    await page.getByRole('button', { name: 'Tagfilter entfernen: Dringend', exact: true }).click()
    await expect(page.locator('[data-task-row]')).toHaveCount(2)
  }
}
