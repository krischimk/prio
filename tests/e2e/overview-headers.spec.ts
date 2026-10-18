import { expect, test } from '@playwright/test'
import * as desktop from './support/helpers'
import * as phone from './support/mobile'
import { openOverview } from './support/overview'

for (const mobile of [false, true]) test.describe(mobile ? 'Gesamtlisten-Kopf Telefon' : 'Gesamtlisten-Kopf breit', () => {
  test.use({ viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 900 }, hasTouch: mobile })
  test.beforeEach(async ({ request }) => desktop.resetServer(request))
  test('die ganze Listenzeile öffnet die Liste und bietet keine Umbenennung an', async ({ page }, info) => {
    await (mobile ? phone.register : desktop.register)(page, desktop.uniqueEmail('overview-head'))
    await (mobile ? phone.createList : desktop.createList)(page, 'Arbeit')
    await (mobile ? phone.createTask : desktop.createTask)(page, 'Vorbereiten')
    const settings = await desktop.openListSettings(page)
    await settings.getByLabel('In Gesamtansicht aufnehmen', { exact: true }).check()
    await expect(settings.getByLabel('In Gesamtansicht aufnehmen', { exact: true })).toBeEnabled()
    await desktop.closeListSettings(page)
    await openOverview(page, mobile)
    if (mobile) await expect(page.locator('[data-drawer-motion="idle"][data-drawer-visible="false"]')).toBeAttached()
    console.log('toolbar geometry', await page.getByRole('button', { name: 'Sortierung ändern', exact: true }).evaluate(button => {
      const counter = document.querySelector('section[aria-label="Gesamtansicht"] p')!
      const top = counter.parentElement!.getBoundingClientRect()
      const first = document.querySelector('section[aria-label="Aufgaben aus Arbeit"]')!.getBoundingClientRect()
      return { toolbarHeight: top.height, firstListOffset: first.top - top.bottom, buttonHeight: button.getBoundingClientRect().height, minHeight: getComputedStyle(button).minHeight }
    }))
    await page.screenshot({ path: info.outputPath('gesamtansicht.png'), animations: 'disabled' })
    const header = page.getByRole('button', { name: /^Liste Arbeit öffnen$/, exact: true })
    const sectionBox = (await page.getByRole('region', { name: 'Aufgaben aus Arbeit', exact: true }).boundingBox())!
    const box = (await header.boundingBox())!
    // Rechts neben dem kurzen Titel, noch innerhalb derselben Listenzeile.
    await page.mouse.click(sectionBox.x + sectionBox.width - 24, box.y + box.height / 2)
    await expect(mobile ? page.getByTestId('app-bar-title') : page.getByTestId('list-title')).toHaveText('Arbeit')
    await openOverview(page, mobile)
    if (mobile) await expect(page.locator('[data-drawer-motion="idle"][data-drawer-visible="false"]')).toBeAttached()
    await header.dblclick()
    await expect(mobile ? page.getByTestId('app-bar-title') : page.getByTestId('list-title')).toHaveText('Arbeit')
    await expect(page.getByRole('textbox', { name: 'Neuer Listenname', exact: true })).toBeHidden()
    if (mobile) {
      await openOverview(page, true)
      await expect(page.locator('[data-drawer-motion="idle"][data-drawer-visible="false"]')).toBeAttached()
      await page.setViewportSize({ width: 740, height: 360 })
      await page.screenshot({ path: info.outputPath('gesamtansicht-quer.png'), animations: 'disabled' })
    }
  })
})
