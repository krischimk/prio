import { expect, type Locator, type Page } from '@playwright/test'
import * as desktop from './helpers'
import * as phone from './mobile'

async function drag(page: Page, source: Locator, target: Locator) {
  await page.bringToFront()
  const from = (await source.boundingBox())!
  await page.mouse.move(from.x + from.width * 0.65, from.y + from.height / 2)
  await page.mouse.down()
  await page.mouse.move(from.x + from.width * 0.65, from.y + from.height / 2 - 10, { steps: 3 })
  await expect(page.locator('[data-navigation-list][data-dnd-dragging]')).toBeVisible()
  const to = (await target.boundingBox())!
  await page.mouse.move(to.x + to.width * 0.6, to.y + to.height * 0.2, { steps: 12 })
  await page.mouse.up()
  await expect(page.getByRole('navigation', { name: 'Listennavigation' })).toHaveAttribute('aria-busy', 'false')
  await expect(page.locator('[data-navigation-list][data-dnd-dragging]')).toHaveCount(0)
}

export async function checkListSorting(page: Page, mobile: boolean) {
  await (mobile ? phone.register : desktop.register)(page, desktop.uniqueEmail('list-sorting'))
  for (const name of ['A', 'B']) await (mobile ? phone.createList : desktop.createList)(page, name)
  if (mobile) await phone.openMenu(page)
  const nav = page.getByRole('navigation', { name: 'Listennavigation' })
  const visible = nav.getByTestId('list-of-lists')
  await drag(page, nav.getByRole('button', { name: 'B', exact: true }), nav.getByRole('button', { name: 'A', exact: true }))
  await expect(visible.getByRole('button')).toHaveText(['B', 'A'])
  await drag(page, nav.getByRole('button', { name: 'B', exact: true }), nav.getByRole('button', { name: /^Versteckt/ }))
  await expect(visible.getByRole('button')).toHaveText(['A'])
  await page.reload()
  if (mobile) await phone.openMenu(page)
  await expect(visible.getByRole('button')).toHaveText(['A'])
  await nav.getByRole('button', { name: /^Versteckt/ }).click()
  await expect(nav.getByRole('list', { name: 'Versteckte Listen' }).getByRole('button', { name: 'B', exact: true })).toBeVisible()
  await drag(page, nav.getByRole('button', { name: 'B', exact: true }), nav.getByRole('button', { name: 'A', exact: true }))
  await expect(visible.getByRole('button')).toHaveText(['B', 'A'])
}
