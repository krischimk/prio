import { expect, test, type Page } from '@playwright/test'
import * as desktop from './helpers'
import * as phone from './mobile'
import { addChecklistPoint, outerTask } from './checklists'

export async function recoverChecklistParity(page: Page, mobile: boolean) {
  await (mobile ? phone.register : desktop.register)(page, desktop.uniqueEmail('hidden-checks'))
  await (mobile ? phone.createList : desktop.createList)(page, 'Schritte')
  await (mobile ? phone.createTask : desktop.createTask)(page, 'Einpacken')
  const editor = await desktop.openTaskEditor(page, 'Einpacken')
  await addChecklistPoint(editor, 'Zelt')
  await addChecklistPoint(editor, 'Schlafsack')
  await editor.getByLabel('Erledigte Checklistenpunkte ausblenden', { exact: true }).check()
  await editor.getByRole('button', { name: 'Speichern', exact: true }).click()
  const row = outerTask(page, 'Einpacken')
  await row.getByRole('button', { name: 'Checkliste: Einpacken', exact: true }).click()
  await row.getByLabel('Checklistenpunkt: Zelt', { exact: true }).check()
  await expect(row.getByLabel('Checklistenpunkt: Zelt', { exact: true })).toHaveCount(0)
  await expect(row.getByRole('button', { name: 'Checkliste: Einpacken', exact: true })).toHaveText('1/2')
  await row.getByRole('button', { name: 'Erledigte anzeigen (1)', exact: true }).click()
  await row.getByLabel('Checklistenpunkt: Zelt', { exact: true }).uncheck()
  await expect(row.getByRole('button', { name: 'Checkliste: Einpacken', exact: true })).toHaveText('0/2')
  await expect(row.getByLabel('Aufgabe erledigen: Einpacken', { exact: true })).not.toBeChecked()
  await desktop.openTaskEditor(page, 'Einpacken')
  await expect(editor.getByLabel('Erledigte Checklistenpunkte ausblenden', { exact: true })).toBeChecked()
  await expect(editor.getByLabel('Checklistenpunkt 1', { exact: true })).toHaveValue('Zelt')
  await editor.getByRole('button', { name: 'Schließen', exact: true }).click()
}

export async function noteControlsParity(page: Page, mobile: boolean) {
  await (mobile ? phone.register : desktop.register)(page, desktop.uniqueEmail('note-controls'))
  await (mobile ? phone.createList : desktop.createList)(page, 'Notizen')
  await (mobile ? phone.createTask : desktop.createTask)(page, 'Nachlesen')
  const editor = await desktop.openTaskEditor(page, 'Nachlesen')
  await editor.getByLabel('Notiz', { exact: true }).fill(Array.from({ length: 20 }, (_, i) => `Absatz ${i + 1}: Eine lange Notiz bleibt unter dem Aufgabenkopf.`).join('\n\n'))
  await editor.getByRole('button', { name: 'Speichern', exact: true }).click()
  const row = outerTask(page, 'Nachlesen')
  const checkbox = row.getByLabel('Aufgabe erledigen: Nachlesen', { exact: true })
  const before = await checkbox.boundingBox()
  await row.getByRole('button', { name: 'Notiz aufklappen', exact: true }).click()
  await expect(row.getByRole('button', { name: 'Notiz oben einklappen', exact: true })).toBeVisible()
  await test.info().attach('checkbox-position', { body: JSON.stringify({ before, after: await checkbox.boundingBox() }), contentType: 'application/json' })
  await page.screenshot({ path: test.info().outputPath('notiz-geoeffnet.png'), animations: 'disabled' })
  if (mobile) {
    await page.setViewportSize({ width: 740, height: 390 })
    await page.screenshot({ path: test.info().outputPath('notiz-quer.png'), animations: 'disabled' })
    await page.setViewportSize({ width: 390, height: 844 })
  }
  await row.getByRole('button', { name: 'Notiz oben einklappen', exact: true }).click()
  await expect(row.getByRole('button', { name: 'Notiz aufklappen', exact: true })).toBeVisible()
}
