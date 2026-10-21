import { expect, test } from '@playwright/test'
import { selectMenu, selectOption } from './support/select'

for (const mobile of [false, true]) for (const theme of ['dark', 'light'] as const) {
  test.describe(`Auswahl ${mobile ? 'Telefon' : 'breit'} ${theme}`, () => {
    test.use({ viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 800 }, hasTouch: mobile })

    test('bedient App-Menüs per Tastatur, Tippen und Zurück auch innerhalb eines Dialogs', async ({ page }) => {
      await page.addInitScript(value => localStorage.setItem('prio:theme', value), theme)
      await page.goto('/?kueche=1')
      const choice = page.getByRole('combobox', { name: 'Auswahl', exact: true })
      await expect(page.getByRole('combobox', { name: 'Auswahl deaktiviert', exact: true })).toBeDisabled()
      await choice.press('Enter')
      let menu = await selectMenu(choice)
      await expect(menu.getByRole('option', { name: 'täglich', exact: true })).toHaveAttribute('aria-selected', 'true')
      await menu.press('End')
      await menu.press('Enter')
      await expect(choice).toHaveText('wöchentlich')
      await expect(choice).toBeFocused()
      await choice.click()
      await page.screenshot({ path: test.info().outputPath('auswahl-offen.png') })
      await menu.press('Escape')
      await expect(menu).toBeHidden()
      await expect(choice).toBeFocused()
      if (mobile) {
        await choice.tap()
        await menu.getByRole('option', { name: 'täglich', exact: true }).tap()
        await expect(choice).toHaveText('täglich')
      }

      await page.getByRole('button', { name: 'Blatt öffnen', exact: true }).click()
      const dialog = page.getByRole('dialog', { name: 'Beispiel-Blatt', exact: true })
      const long = dialog.getByRole('combobox', { name: 'Lange Auswahl', exact: true })
      await long.click()
      menu = await selectMenu(long)
      await menu.press('End')
      await page.screenshot({ path: test.info().outputPath('auswahl-dialog-lange-liste.png') })
      await menu.press('Enter')
      await expect(long).toHaveText('Eintrag 80')
      await long.click()
      await page.goBack()
      await expect(menu).toBeHidden()
      await expect(dialog).toBeVisible()
      await expect(long).toBeFocused()
      await selectOption(long, '1')
      await long.click()
      await menu.press('Escape')
      await expect(dialog).toBeVisible()
      if (mobile) {
        await page.setViewportSize({ width: 740, height: 360 })
        await long.click()
        await page.screenshot({ path: test.info().outputPath('auswahl-dialog-quer.png') })
        await menu.press('Escape')
      }
      await dialog.getByRole('button', { name: 'Schließen', exact: true }).first().click()
      await expect(dialog).toBeHidden()
    })
  })
}
