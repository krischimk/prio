import { expect, test } from '@playwright/test'
import * as desktop from './support/helpers'
import * as phone from './support/mobile'
import { setDetailedRatings } from './support/ratings'
import { addReminder, setDueAt } from './support/taskForms'
import { expectReminders } from './support/reminders'

test.beforeEach(async ({ request }) => desktop.resetServer(request))

for (const mobile of [false, true]) {
  test(`Regler, Kalendertage und Erinnerungsglocke (${mobile ? 'Telefon' : 'breit'})`, async ({ page }) => {
    await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1280, height: 800 })
    // Drei Kalendertage, aber weniger als drei volle 24-Stunden-Blöcke.
    await page.clock.setFixedTime(new Date(2026, 9, 16, 20))
    await (mobile ? phone.register : desktop.register)(page, desktop.uniqueEmail('ruler'))
    await setDetailedRatings(page, mobile, true)
    await (mobile ? phone.createList : desktop.createList)(page, 'Arbeit')
    await (mobile ? phone.createTask : desktop.createTask)(page, 'Termin vorbereiten')
    const editor = await desktop.openTaskEditor(page, 'Termin vorbereiten')
    const initial = editor.getByRole('slider', { name: 'Wichtigkeit einschätzen', exact: true })
    const box = (await initial.boundingBox())!
    // Die dekorativen Striche lassen den Klick auf die Skala durch.
    await initial.click({ position: { x: box.width * 0.75, y: box.height / 2 } })
    const importance = editor.getByRole('slider', { name: 'Wichtigkeit', exact: true })
    expect(Number(await importance.inputValue())).toBeGreaterThan(7)
    await importance.press('ArrowRight')
    await editor.getByRole('slider', { name: 'Aufwand', exact: true }).press('Home')
    await editor.getByRole('slider', { name: 'Dringlichkeit', exact: true }).press('End')
    await page.screenshot({ path: test.info().outputPath('regler-dunkel.png') })
    await page.evaluate(() => document.documentElement.dataset.theme = 'light')
    await page.screenshot({ path: test.info().outputPath('regler-hell.png') })
    if (mobile) {
      await page.setViewportSize({ width: 740, height: 360 })
      await editor.getByRole('slider', { name: 'Aufwand', exact: true }).scrollIntoViewIfNeeded()
      await page.screenshot({ path: test.info().outputPath('regler-quer.png') })
      await page.setViewportSize({ width: 390, height: 844 })
    }
    await setDueAt(editor, '2026-10-19T09:00')
    await addReminder(editor)
    await editor.getByRole('button', { name: 'Speichern', exact: true }).click()
    await expect(editor).toBeHidden()
    const row = desktop.taskItem(page, 'Termin vorbereiten')
    await expect(row.getByText('In 3 Tagen (Mo)', { exact: true })).toBeVisible()
    await expectReminders(row, 1)
    await expect(row.getByText(/Erinnert:/)).toHaveCount(0)
    if (!mobile) {
      await row.getByRole('img', { name: /^Erinnerungen:/ }).hover()
      await expect(page.getByRole('tooltip')).toContainText('Erinnert:')
    }
    await desktop.openTaskEditor(page, 'Termin vorbereiten')
    await setDueAt(editor, '2026-10-17T19:30')
    await editor.getByRole('button', { name: 'Speichern', exact: true }).click()
    await expect(row.getByText('In 23 Stunden und 30 Minuten', { exact: true })).toBeVisible()
    await desktop.openTaskEditor(page, 'Termin vorbereiten')
    await setDueAt(editor, '2026-11-02T09:00')
    await editor.getByRole('button', { name: 'Speichern', exact: true }).click()
    await expect(row.getByText('In 2 Wochen und 3 Tagen', { exact: true })).toBeVisible()
  })
}
