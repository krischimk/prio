import { expect, test } from '@playwright/test'
import * as desktop from './support/helpers'
import * as phone from './support/mobile'
import { setDueAt } from './support/taskForms'
import { formatCalendarDay } from '../../src/ui/datetime'

test.beforeEach(async ({ request }) => desktop.resetServer(request))

for (const mobile of [false, true]) test.describe(mobile ? 'Kalender Telefon' : 'Kalender breit', () => {
  test.use({ viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 800 }, hasTouch: mobile, timezoneId: 'Europe/Berlin' })
  test('übernimmt blasse Tage aus beiden Nachbarmonaten vor dem Wechsel zur Uhrzeit', async ({ page }, info) => {
    await page.clock.setFixedTime(new Date('2026-10-16T12:00:00+02:00'))
    await (mobile ? phone.register : desktop.register)(page, desktop.uniqueEmail('adjacent-month'))
    await (mobile ? phone.createList : desktop.createList)(page, 'Termine')
    await (mobile ? phone.createTask : desktop.createTask)(page, 'Monatswechsel')
    const editor = await desktop.openTaskEditor(page, 'Monatswechsel')
    const clock = page.getByRole('dialog', { name: 'Uhrzeit wählen', exact: true })
    for (const [day, shown] of [['2026-11-01', '01.11.2026'], ['2026-09-30', '30.09.2026']]) {
      await setDueAt(editor, '2026-10-16T10:00')
      await editor.getByRole('button', { name: 'Fällig am: Kalender öffnen', exact: true }).click()
      const target = page.getByRole('button', { name: formatCalendarDay(day), exact: true })
      await expect(target).toBeVisible()
      await expect(target).toBeEnabled()
      await page.screenshot({ path: info.outputPath(`kalender-${day}.png`) })
      await target.click()
      await expect(editor.getByLabel('Fällig am', { exact: true })).toHaveValue(shown)
      await expect(clock).toBeVisible()
      await clock.getByLabel('Fällig am: Uhrzeit: Minute', { exact: true }).selectOption('15')
    }
    await editor.getByRole('button', { name: 'Erinnerung hinzufügen', exact: true }).click()
    await page.getByLabel('Monat', { exact: true }).selectOption('10')
    await page.getByRole('button', { name: formatCalendarDay('2026-11-01'), exact: true }).click()
    await expect(editor.getByLabel('Erinnerung am', { exact: true })).toHaveValue('01.11.2026')
    await expect(clock).toBeVisible()
    await clock.getByLabel('Erinnerung am: Uhrzeit: Minute', { exact: true }).selectOption('30')
    await editor.getByRole('button', { name: 'Speichern', exact: true }).click()
    await expect(editor).toBeHidden()
    await desktop.openTaskEditor(page, 'Monatswechsel')
    await editor.getByRole('button', { name: 'Fälligkeit und Wiederholung bearbeiten', exact: true }).click()
    await expect(editor.getByLabel('Fällig am', { exact: true })).toHaveValue('30.09.2026')
    await expect(editor.getByLabel('Erinnerung am', { exact: true })).toHaveValue('01.11.2026')
  })
})
