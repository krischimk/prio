import { selectMenu, selectOption } from './select'
import { expect, test, type Page } from '@playwright/test'
import * as phone from './mobile'
import * as desktop from './helpers'

export async function openAccount(page: Page, mobile: boolean) {
  if (mobile) await phone.openMenu(page)
  await page.getByRole('button', { name: 'Konto', exact: true }).click()
  return page.getByRole('dialog', { name: 'Konto', exact: true })
}

export async function setTheme(page: Page, mobile: boolean, theme: 'light' | 'dark') {
  const account = await openAccount(page, mobile)
  await selectOption(account.getByRole('combobox', { name: 'Farbschema', exact: true }), theme)
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
  await account.getByRole('button', { name: 'Schließen', exact: true }).click()
  await expect(account).toBeHidden()
}

export async function systemThemeParity(page: Page, mobile: boolean) {
  await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1280, height: 800 })
  await page.emulateMedia({ colorScheme: 'light' })
  await (mobile ? phone.register : desktop.register)(page, desktop.uniqueEmail('system-theme'))
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  expect(await page.evaluate(() => localStorage.getItem('prio:theme'))).toBeNull()
  await page.emulateMedia({ colorScheme: 'dark' })
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await expect(page.getByRole('combobox', { name: 'Farbschema', exact: true })).toHaveCount(0)
  if (mobile) {
    await phone.openMenu(page)
    await expect(page.getByRole('combobox', { name: 'Farbschema', exact: true })).toHaveCount(0)
    await page.getByRole('button', { name: 'Konto', exact: true }).click()
  } else await openAccount(page, mobile)
  const account = page.getByRole('dialog', { name: 'Konto', exact: true })
  const theme = account.getByRole('combobox', { name: 'Farbschema', exact: true })
  await expect(theme).toHaveAttribute('data-value', 'system')
  await theme.click()
  await expect((await selectMenu(theme)).getByRole('option')).toHaveText(['Gerätestandard', 'Hell', 'Dunkel'])
  await selectOption(theme, 'light')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await page.emulateMedia({ colorScheme: 'light' })
  await page.emulateMedia({ colorScheme: 'dark' })
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await page.screenshot({ path: test.info().outputPath('konto-thema-hell.png') })
  if (mobile) {
    await page.setViewportSize({ width: 740, height: 360 })
    await page.screenshot({ path: test.info().outputPath('konto-thema-quer.png') })
    await page.setViewportSize({ width: 390, height: 844 })
  }
  await selectOption(theme, 'dark')
  await page.emulateMedia({ colorScheme: 'light' })
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await selectOption(theme, 'system')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await page.emulateMedia({ colorScheme: 'dark' })
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await account.getByRole('button', { name: 'Schließen', exact: true }).click()
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.emulateMedia({ colorScheme: 'light' })
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
}
