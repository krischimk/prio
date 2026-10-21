import { selectOption } from './support/select'
import { expect, test } from '@playwright/test'
import * as desktop from './support/helpers'
import * as phone from './support/mobile'
import { openOverview } from './support/overview'
import { moreOptions, setOverviewMode } from './support/taskForms'

test.beforeEach(async ({ request }) => desktop.resetServer(request))
for (const mobile of [false, true]) test.describe(mobile ? 'Leere Bereiche Telefon' : 'Leere Bereiche breit', () => {
  test.use({ viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 900 }, hasTouch: mobile })
  test('bleiben offen, öffnen die Bereichsverwaltung und behalten neue Aufgaben sichtbar', async ({ page }, info) => {
    await (mobile ? phone.register : desktop.register)(page, desktop.uniqueEmail('empty-section'))
    await (mobile ? phone.createList : desktop.createList)(page, 'Projekt')
    const settings = await desktop.openListSettings(page)
    await settings.getByLabel('In Gesamtansicht aufnehmen', { exact: true }).check()
    await expect(settings.getByLabel('In Gesamtansicht aufnehmen', { exact: true })).toBeEnabled()
    await desktop.closeListSettings(page)
    const areas = await desktop.listAction(page, 'Bereiche')
    await expect(areas.getByRole('button', { name: 'Zurück', exact: true })).toHaveCount(0)
    await expect(areas.getByRole('button', { name: 'Zur Übersicht', exact: true })).toBeVisible()
    await areas.getByLabel('Neuer Bereich', { exact: true }).fill('Leer')
    await areas.getByRole('button', { name: 'Bereich anlegen', exact: true }).click()
    await expect(areas.getByLabel('Neuer Bereich', { exact: true })).toHaveValue('')
    await desktop.closeListSettings(page)
    const header = page.getByTestId('section-header').filter({ hasText: 'Leer' })
    await expect(header).toHaveAttribute('aria-expanded', 'true')
    await header.click()
    await expect(page.getByRole('dialog', { name: 'Liste verwalten', exact: true }).getByLabel('Neuer Bereich', { exact: true })).toBeVisible()
    await expect(page.getByRole('dialog', { name: 'Liste verwalten', exact: true }).getByRole('button', { name: 'Zur Übersicht', exact: true })).toHaveCount(0)
    await desktop.closeListSettings(page)
    const createInSection = async (title: string) => {
      await (mobile ? phone.createTask : desktop.createTask)(page, title)
      const editor = await desktop.openTaskEditor(page, title)
      await moreOptions(editor)
      await selectOption(editor.getByLabel('Bereich', { exact: true }), { label: 'Leer' })
      await editor.getByRole('button', { name: 'Speichern', exact: true }).click()
      await expect(editor).toBeHidden()
    }
    await createInSection('Erste Aufgabe')
    await header.click()
    await expect(header).toHaveAttribute('aria-expanded', 'false')
    // Anderswo erledigen: Der Bereich wird leer, während sein alter Klappzustand zu ist.
    await openOverview(page, mobile)
    await setOverviewMode(page, 'newest')
    await page.getByLabel('Aufgabe erledigen: Erste Aufgabe', { exact: true }).click()
    await expect(page.getByLabel('Aufgabe erledigen: Erste Aufgabe', { exact: true })).toBeHidden()
    if (mobile) { await phone.openMenu(page); await page.getByRole('dialog', { name: 'Menü', exact: true }).getByRole('button', { name: 'Projekt', exact: true }).click() }
    else await desktop.selectList(page, 'Projekt')
    await expect(header).toHaveAttribute('aria-expanded', 'true')
    await createInSection('Neue Aufgabe')
    await expect(header).toHaveAttribute('aria-expanded', 'true')
    await expect(page.getByLabel('Aufgabe erledigen: Neue Aufgabe', { exact: true })).toBeVisible()
    await openOverview(page, mobile)
    await setOverviewMode(page, 'by_list')
    // Wieder leeren und den direkten Verwaltungsweg auch in der Gesamtansicht prüfen.
    await page.getByLabel('Aufgabe erledigen: Neue Aufgabe', { exact: true }).click()
    await expect(header).toHaveText('Leer0')
    await expect(header).toHaveAttribute('aria-expanded', 'true')
    await page.screenshot({ path: info.outputPath('leerer-bereich.png') })
    if (mobile) { await page.setViewportSize({ width: 740, height: 360 }); await page.screenshot({ path: info.outputPath('leerer-bereich-quer.png') }) }
    await header.click()
    await expect(page.getByRole('dialog', { name: 'Liste verwalten', exact: true }).getByLabel('Neuer Bereich', { exact: true })).toBeVisible()
  })
})
