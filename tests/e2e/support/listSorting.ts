import { expect, test, type Page } from '@playwright/test'
import * as desktop from './helpers'
import * as phone from './mobile'
import { moreOptions } from './taskForms'
import { outerTask } from './checklists'
import { listSortModeLabel } from '../../../src/ui/listSortMode'

async function sort(page: Page, mode: string) {
  await page.getByRole('button', { name: 'Sortierung ändern', exact: true }).click()
  await page.getByRole('radio', { name: listSortModeLabel[mode as keyof typeof listSortModeLabel], exact: true }).click()
  await expect(page.getByLabel('Sortierung der Liste', { exact: true })).toBeHidden()
}

export async function listSortingParity(page: Page, mobile: boolean) {
  await (mobile ? phone.register : desktop.register)(page, desktop.uniqueEmail('list-sort'))
  await (mobile ? phone.createList : desktop.createList)(page, 'Arbeit')
  const settings = await desktop.listAction(page, 'Bereiche')
  for (const name of ['B', 'A']) {
    await settings.getByLabel('Neuer Bereich', { exact: true }).fill(name)
    await settings.getByRole('button', { name: 'Bereich anlegen', exact: true }).click()
    await expect(settings.getByLabel('Neuer Bereich', { exact: true })).toHaveValue('')
  }
  await desktop.closeListSettings(page)
  for (const [title, section, value] of [['B-mittel', 'B', '5'], ['A-hoch', 'A', '8'], ['A-niedrig', 'A', '2']]) {
    await (mobile ? phone.createTask : desktop.createTask)(page, title)
    const editor = await desktop.openTaskEditor(page, title)
    await editor.getByRole('slider', { name: 'Wichtigkeit einschätzen', exact: true }).press('Home')
    const importance = editor.getByRole('slider', { name: 'Wichtigkeit', exact: true })
    for (let step = 0; step < Number(value) * 10; step++) await importance.press('ArrowRight')
    const urgency = editor.getByRole('slider', { name: 'Dringlichkeit', exact: true })
    await urgency.press('Home')
    for (let step = 0; step < Number(value) * 10; step++) await urgency.press('ArrowRight')
    await moreOptions(editor)
    await editor.getByLabel('Bereich', { exact: true }).selectOption({ label: section })
    await editor.getByRole('button', { name: 'Speichern', exact: true }).click()
    await expect(editor).toBeHidden()
  }
  await (mobile ? phone.createTask : desktop.createTask)(page, 'Unbewertet')
  const rows = page.getByTestId('task-row')
  // Titel vergleichen, unabhängig von zusätzlichen Rang- oder Bereichsangaben.
  const titles = () => rows.getByText(/^(A-hoch|A-niedrig|B-mittel|Unbewertet)$/).allTextContents()
  const manual = await titles()
  await sort(page, 'priority')
  await expect.poll(titles).toEqual(['A-hoch', 'A-niedrig', 'B-mittel', 'Unbewertet'])
  await page.screenshot({ path: test.info().outputPath('listensortierung-bereiche.png') })
  await sort(page, 'priority_flat')
  await expect.poll(titles).toEqual(['A-hoch', 'B-mittel', 'A-niedrig', 'Unbewertet'])
  for (const [title, section] of [['A-hoch', 'A'], ['A-niedrig', 'A'], ['B-mittel', 'B']]) await expect(outerTask(page, title).getByText(section, { exact: true })).toBeVisible()
  await page.reload()
  if (mobile) {
    await phone.openMenu(page)
    await page.getByRole('dialog', { name: 'Menü', exact: true }).getByRole('button', { name: 'Arbeit', exact: true }).click()
  } else await desktop.selectList(page, 'Arbeit')
  await expect.poll(titles).toEqual(['A-hoch', 'B-mittel', 'A-niedrig', 'Unbewertet'])
  if (mobile) await expect(page.locator('[data-drawer-motion="idle"][data-drawer-visible="false"]')).toBeAttached()
  await page.screenshot({ path: test.info().outputPath('prioritaetsverlauf-dunkel.png') })
  if (mobile) {
    await page.setViewportSize({ width: 740, height: 360 })
    await page.screenshot({ path: test.info().outputPath('prioritaetsverlauf-quer.png') })
    await page.setViewportSize({ width: 390, height: 844 })
    await phone.openMenu(page)
  }
  await page.getByRole('button', { name: 'Hellen Modus einschalten', exact: true }).click()
  if (mobile) await page.getByRole('dialog', { name: 'Menü', exact: true }).getByRole('button', { name: 'Arbeit', exact: true }).click()
  if (mobile) await expect(page.locator('[data-drawer-motion="idle"][data-drawer-visible="false"]')).toBeAttached()
  await page.screenshot({ path: test.info().outputPath('prioritaetsverlauf-hell.png') })
  await sort(page, 'manual')
  await expect.poll(titles).toEqual(manual)
  const completionSettings = await desktop.openListSettings(page)
  await completionSettings.getByLabel('Erledigt am Listenende', { exact: true }).check()
  await expect(completionSettings.getByLabel('Erledigt am Listenende', { exact: true })).toBeEnabled()
  await desktop.closeListSettings(page)
  await page.getByLabel('Aufgabe erledigen: Unbewertet', { exact: true }).click()
  await sort(page, 'priority_flat')
  const completed = page.getByRole('region', { name: 'Erledigt', exact: true })
  await completed.getByRole('button', { name: 'Erledigt 1', exact: true }).click()
  await expect(completed.getByTestId('task-row')).toHaveText('Unbewertet')
  await completed.getByRole('checkbox', { name: 'Aufgabe wieder öffnen: Unbewertet', exact: true }).click()
  await sort(page, 'manual')
  await expect.poll(titles).toEqual(manual)
}
