import { expect, test, type Page } from '@playwright/test'
import * as desktop from './helpers'
import * as phone from './mobile'

export async function discardedNotesParity(page: Page, mobile: boolean) {
  await (mobile ? phone.register : desktop.register)(page, desktop.uniqueEmail('discarded-note'))
  await (mobile ? phone.createList : desktop.createList)(page, 'Notizen')
  await (mobile ? phone.createTask : desktop.createTask)(page, 'Sicherer Entwurf')
  let editor = await desktop.openTaskEditor(page, 'Sicherer Entwurf')
  await editor.getByLabel('Notiz', { exact: true }).fill('Ursprüngliche Notiz')
  await editor.getByRole('button', { name: 'Speichern', exact: true }).click()
  await expect(editor).toBeHidden()
  editor = await desktop.openTaskEditor(page, 'Sicherer Entwurf')
  await editor.getByLabel('Notiz', { exact: true }).fill('Verworfener Absatz\n\nZweiter Absatz')
  await editor.getByRole('button', { name: 'Schließen', exact: true }).click()
  await page.getByRole('alertdialog', { name: 'Änderungen verwerfen', exact: true }).getByRole('button', { name: 'Verwerfen', exact: true }).click()
  await expect(editor).toBeHidden()
  await expect(page.getByTestId('task-row').filter({ hasText: 'Sicherer Entwurf' })).toContainText('Ursprüngliche Notiz')
  await page.reload()
  if (mobile) await phone.openMenu(page)
  await page.getByRole('button', { name: mobile ? 'Aufgaben wiederherstellen' : 'Wiederherstellen', exact: true }).click()
  const panel = page.getByRole('dialog', { name: 'Aufgaben wiederherstellen', exact: true })
  const note = panel.getByRole('region', { name: 'Verworfene Notizen' }).getByRole('listitem').filter({ hasText: 'Sicherer Entwurf' })
  await expect(note).toContainText('Verworfener Absatz')
  if (mobile) {
    await page.screenshot({ path: test.info().outputPath('notiz-wiederherstellen.png') })
    await page.setViewportSize({ width: 740, height: 360 })
    await page.screenshot({ path: test.info().outputPath('notiz-wiederherstellen-quer.png') })
    await page.setViewportSize({ width: 390, height: 844 })
  }
  await note.getByRole('button', { name: 'Als Entwurf öffnen', exact: true }).click()
  editor = page.getByRole('dialog', { name: 'Aufgabe', exact: true })
  await expect(editor.getByLabel('Notiz', { exact: true })).toHaveText('Verworfener Absatz\n\nZweiter Absatz', { useInnerText: true })
  await editor.getByRole('button', { name: 'Speichern', exact: true }).click()
  await expect(editor).toBeHidden()
}
