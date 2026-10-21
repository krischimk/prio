import { expect, test } from '@playwright/test'
import * as desktop from './support/helpers'
import * as phone from './support/mobile'
import { setDetailedRatings } from './support/ratings'
import { outerTask } from './support/checklists'
import { setDueAt } from './support/taskForms'

test.beforeEach(async ({ request }) => desktop.resetServer(request))

for (const mobile of [false, true]) {
  test(`Einfache Dringlichkeit: erst manuell, dann Termin und Ansichtswechsel (${mobile ? 'Telefon' : 'breit'})`, async ({ page, request }) => {
    await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1280, height: 800 })
    await page.clock.setFixedTime(new Date(2026, 9, 21, 10))
    await (mobile ? phone.register : desktop.register)(page, desktop.uniqueEmail('simple-urgency'))
    await (mobile ? phone.createList : desktop.createList)(page, 'Arbeit')
    await (mobile ? phone.createTask : desktop.createTask)(page, 'Frist vorbereiten')
    const editor = await desktop.openTaskEditor(page, 'Frist vorbereiten')
    await editor.getByRole('slider', { name: 'Wichtigkeit einschätzen', exact: true }).press('End')
    await editor.getByRole('slider', { name: 'Dringlichkeit', exact: true }).press('Home')
    await setDueAt(editor, '2026-10-21T14:00')
    await expect(editor.getByRole('slider', { name: 'Dringlichkeit', exact: true })).toHaveCount(0)
    await expect(editor.getByRole('button', { name: 'Manuell', exact: true })).toHaveCount(0)
    await expect(editor.getByRole('slider', { name: 'Aufwand', exact: true })).toBeVisible()
    await page.screenshot({ path: test.info().outputPath('einfache-bewertung.png') })
    if (mobile) {
      await page.setViewportSize({ width: 740, height: 360 })
      await editor.getByRole('slider', { name: 'Wichtigkeit', exact: true }).scrollIntoViewIfNeeded()
      await page.screenshot({ path: test.info().outputPath('einfache-bewertung-quer.png') })
      await page.setViewportSize({ width: 390, height: 844 })
    }
    await editor.getByRole('button', { name: 'Speichern', exact: true }).click()
    await expect(editor).toBeHidden()
    await expect.poll(async () => (await desktop.serverState(request)).tasks.find(task => task.title === 'Frist vorbereiten')?.rating?.urgencyMode).toBe('auto')
    const priority = outerTask(page, 'Frist vorbereiten').getByRole('meter', { name: 'Priorität', exact: true })
    await expect(priority).toHaveAttribute('aria-valuenow', '10')

    // Ein alter manueller Modus darf beim Wechsel zur einfachen Ansicht nicht
    // unsichtbar weitergelten. Die persönliche Darstellung verändert andere
    // Konten und deren gespeicherte manuelle Einschätzung nicht.
    await setDetailedRatings(page, mobile, true)
    await desktop.openTaskEditor(page, 'Frist vorbereiten')
    await editor.getByRole('button', { name: 'Manuell', exact: true }).click()
    await editor.getByRole('slider', { name: 'Dringlichkeit', exact: true }).press('Home')
    await editor.getByRole('button', { name: 'Speichern', exact: true }).click()
    await expect(editor).toBeHidden()
    await expect(priority).toHaveAttribute('aria-valuenow', '5')
    await setDetailedRatings(page, mobile, false)
    await expect(priority).toHaveAttribute('aria-valuenow', '10')
    await page.reload()
    if (mobile) {
      await phone.openMenu(page)
      await page.getByRole('dialog', { name: 'Menü', exact: true }).getByRole('button', { name: 'Arbeit', exact: true }).click()
    } else await desktop.selectList(page, 'Arbeit')
    await expect(priority).toHaveAttribute('aria-valuenow', '10')
    await setDetailedRatings(page, mobile, true)
    await expect(priority).toHaveAttribute('aria-valuenow', '5')
  })
}
