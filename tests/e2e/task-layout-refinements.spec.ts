import { expect, test } from '@playwright/test'
import * as desktop from './support/helpers'
import * as phone from './support/mobile'
import { addChecklistPoint, outerTask } from './support/checklists'
import { moreOptions, setDueAt } from './support/taskForms'
import { setDetailedRatings } from './support/ratings'

test.beforeEach(async ({ request }) => desktop.resetServer(request))
for (const mobile of [false, true]) test.describe(mobile ? 'Kompakte Aufgaben Telefon' : 'Kompakte Aufgaben breit', () => {
  test.use({ viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 900 }, hasTouch: mobile })
  test('Aufwand bleibt bei Bedarf erreichbar, Bewertung lässt sich direkt entfernen', async ({ page }, info) => {
    await (mobile ? phone.register : desktop.register)(page, desktop.uniqueEmail('task-layout'))
    await (mobile ? phone.createList : desktop.createList)(page, 'Hausaufgaben')
    await (mobile ? phone.createTask : desktop.createTask)(page, 'Auffrischungsaufgaben', 'Eine kurze Notiz.\nNoch ein Absatz.')
    let editor = await desktop.openTaskEditor(page, 'Auffrischungsaufgaben')
    await editor.getByRole('slider', { name: 'Wichtigkeit einschätzen', exact: true }).press('End')
    await expect(editor.getByRole('slider', { name: 'Aufwand', exact: true })).toBeHidden()
    await expect(editor.getByRole('button', { name: 'Bewertung entfernen', exact: true })).toBeVisible()
    await setDueAt(editor, '2030-12-18T18:00')
    await expect(editor.getByRole('slider', { name: 'Aufwand', exact: true })).toBeVisible()
    await moreOptions(editor)
    await editor.getByRole('button', { name: 'Manuell', exact: true }).click()
    await expect(editor.getByRole('slider', { name: 'Aufwand', exact: true })).toBeHidden()
    await addChecklistPoint(editor, 'Erster Schritt')
    await expect(editor.getByRole('slider', { name: 'Gesamtaufwand', exact: true })).toBeVisible()
    await editor.getByLabel('Checkliste reduziert den Restaufwand', { exact: true }).uncheck()
    await expect(editor.getByRole('slider', { name: 'Aufwand', exact: true })).toBeHidden()
    await editor.getByRole('button', { name: 'Speichern', exact: true }).click()
    await expect(editor).toBeHidden()
    await page.screenshot({ path: info.outputPath('kompakte-liste-dunkel.png'), animations: 'disabled' })
    if (mobile) {
      await page.setViewportSize({ width: 740, height: 360 })
      await page.screenshot({ path: info.outputPath('kompakte-liste-quer.png'), animations: 'disabled' })
      await page.setViewportSize({ width: 390, height: 844 })
      await phone.openMenu(page)
    }
    await page.getByRole('button', { name: 'Konto', exact: true }).click()
    await page.getByRole('dialog', { name: 'Konto', exact: true }).getByRole('button', { name: 'Hellen Modus einschalten', exact: true }).click()
    await page.getByRole('dialog', { name: 'Konto', exact: true }).getByRole('button', { name: 'Schließen', exact: true }).click()
    await page.screenshot({ path: info.outputPath('kompakte-liste-hell.png'), animations: 'disabled' })
    await setDetailedRatings(page, mobile, true)
    editor = await desktop.openTaskEditor(page, 'Auffrischungsaufgaben')
    await expect(editor.getByRole('slider', { name: 'Aufwand', exact: true })).toBeVisible()
    await editor.getByRole('slider', { name: 'Wichtigkeit', exact: true }).scrollIntoViewIfNeeded()
    await page.screenshot({ path: info.outputPath('bewertung-entfernen.png'), animations: 'disabled' })
    await editor.getByRole('button', { name: 'Bewertung entfernen', exact: true }).click()
    await expect(editor.getByRole('slider', { name: 'Wichtigkeit einschätzen', exact: true })).toBeVisible()
    await expect(editor.getByRole('slider', { name: 'Aufwand', exact: true })).toBeHidden()
    await editor.getByRole('button', { name: 'Speichern', exact: true }).click()
    await expect(outerTask(page, 'Auffrischungsaufgaben').getByRole('meter')).toHaveCount(0)
  })
})
