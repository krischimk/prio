import { expect, test, type CDPSession, type Page } from '@playwright/test'
import * as desktop from './support/helpers'
import * as phone from './support/mobile'

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true })
test.beforeEach(async ({ request }) => desktop.resetServer(request))
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const events: unknown[] = []
    Object.assign(window, { navigationLog: events })
    for (const name of ['pushState', 'replaceState', 'go'] as const) {
      const original = window.history[name].bind(window.history)
      Object.assign(window.history, { [name]: (...args: unknown[]) => {
        events.push({ name, args, at: performance.now() })
        return Reflect.apply(original, window.history, args)
      } })
    }
    window.addEventListener('popstate', event => events.push({ name: 'popstate', state: event.state, at: performance.now() }))
  })
})
test.afterEach(async ({ page, request }, info) => {
  if (info.status === info.expectedStatus) return
  console.log('navigation evidence', JSON.stringify(await page.evaluate(() => (window as unknown as { navigationLog: unknown[] }).navigationLog)), JSON.stringify(await desktop.serverState(request)))
})

async function touch(client: CDPSession, type: 'touchStart' | 'touchMove' | 'touchEnd', x = 0, y = 0) {
  await client.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] })
}
async function setup(page: Page) {
  await phone.register(page, desktop.uniqueEmail('mobile-edge'))
  await phone.createList(page, 'Arbeit')
  await phone.createTask(page, 'Bericht')
  await phone.createList(page, 'Einkaufen')
  await phone.createTask(page, 'Vorhanden')
  await phone.openMenu(page)
  await page.getByRole('dialog', { name: 'Menü', exact: true }).getByRole('button', { name: 'Arbeit', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Menü', exact: true })).toBeHidden()
  // Für die gemessenen Fingerwege beginnt die Geste am geschlossenen Anschlag.
  // Die Bedienung endet bereits vor dem Ende der Schließanimation.
  await expect(page.locator('[data-drawer-motion="idle"][data-drawer-visible="false"]')).toBeAttached()
}
async function menuSettled(page: Page) {
  await expect(page.locator('[data-drawer-motion="idle"][data-drawer-visible="true"]')).toBeVisible()
}
async function lift(page: Page, client: CDPSession) {
  await page.bringToFront()
  const row = page.locator('[data-task-row]').filter({ hasText: 'Bericht' })
  const id = (await row.getAttribute('data-id'))!
  const box = (await row.getByTestId('task-row').boundingBox())!
  await touch(client, 'touchStart', box.x + box.width * 0.65, box.y + box.height / 2)
  await expect(page.locator(`[data-id="${id}"][data-dnd-dragging]`)).toBeVisible()
  return id
}

test('Wischen vom linken Rand öffnet das Menü ohne Langdruck', async ({ page, context }, info) => {
  await phone.register(page, desktop.uniqueEmail('swipe-menu'))
  const client = await context.newCDPSession(page)
  await touch(client, 'touchStart', 5, 220)
  await touch(client, 'touchMove', 40, 221)
  await touch(client, 'touchMove', 100, 222)
  await touch(client, 'touchEnd')
  await expect(page.getByRole('dialog', { name: 'Menü', exact: true })).toBeVisible()
  await menuSettled(page)
  await page.screenshot({ path: info.outputPath('drawer-swipe.png') })
})

test('Aufgabe öffnet das Menü am Rand und landet am Ende der gewählten Liste', async ({ page, context, request }, info) => {
  await setup(page)
  const client = await context.newCDPSession(page)
  const id = await lift(page, client)
  await touch(client, 'touchMove', 8, 240)
  const menu = page.getByRole('dialog', { name: 'Menü', exact: true })
  await expect(menu).toBeVisible()
  await menuSettled(page)
  const target = menu.getByRole('button', { name: 'Einkaufen', exact: true })
  const box = (await target.boundingBox())!
  await touch(client, 'touchMove', box.x + box.width / 2, box.y + box.height / 2)
  await expect(target).toHaveAttribute('data-drop-target', 'true')
  await page.screenshot({ path: info.outputPath('task-to-mobile-list.png') })
  await touch(client, 'touchEnd')
  await expect(menu).toBeHidden()
  await expect.poll(async () => {
    const data = await desktop.serverState(request)
    const list = data.lists.find(row => row.name === 'Einkaufen')!
    return data.tasks.find(row => row.id === id)?.list_id === list.id
  }).toBe(true)
  const data = await desktop.serverState(request)
  const moved = data.tasks.find(row => row.id === id)!
  expect(moved.section_id).toBeNull()
  expect(moved.position).toBeGreaterThan(data.tasks.find(row => row.title === 'Vorhanden')!.position)
})

test('Loslassen auf freier Menüfläche verwirft die gesamte Verschiebung', async ({ page, context, request }) => {
  await setup(page)
  await expect.poll(async () => (await desktop.serverState(request)).tasks.some(row => row.title === 'Bericht')).toBe(true)
  const before = (await desktop.serverState(request)).tasks.find(row => row.title === 'Bericht')!
  const client = await context.newCDPSession(page)
  await lift(page, client)
  await touch(client, 'touchMove', 8, 240)
  await expect(page.getByRole('dialog', { name: 'Menü', exact: true })).toBeVisible()
  await menuSettled(page)
  await touch(client, 'touchMove', 80, 38)
  await touch(client, 'touchEnd')
  await expect(page.getByRole('dialog', { name: 'Menü', exact: true })).toBeHidden()
  await expect(page.locator('[data-dnd-dragging]')).toHaveCount(0)
  await expect(phone.taskRow(page, 'Bericht')).toBeVisible()
  expect((await desktop.serverState(request)).tasks.find(row => row.id === before.id)).toEqual(before)
})

test('rechter Rand schließt die Leiste während derselben Aufgaben-Ziehung', async ({ page, context }) => {
  await setup(page)
  const client = await context.newCDPSession(page)
  await lift(page, client)
  await touch(client, 'touchMove', 8, 240)
  const menu = page.getByRole('dialog', { name: 'Menü', exact: true })
  await expect(menu).toBeVisible()
  await menuSettled(page)
  await touch(client, 'touchMove', 383, 240)
  await expect(menu).toBeHidden()
  await expect(page.locator('[data-dnd-dragging]')).toBeVisible()
  await touch(client, 'touchEnd')
  await expect(page.locator('[data-dnd-dragging]')).toHaveCount(0)
  await expect(phone.taskRow(page, 'Bericht')).toBeVisible()
})

test('direktes Wischen folgt dem Finger, lässt sich umkehren und auch rechts schließen', async ({ page, context }, info) => {
  await setup(page)
  const client = await context.newCDPSession(page)
  const row = page.getByTestId('task-row').filter({ hasText: 'Bericht' })
  const box = (await row.boundingBox())!
  const y = box.y + box.height / 2
  const sheet = page.getByTestId('drawer-sheet')
  // Diese Geometrie prüft direkte Manipulation: zusätzlicher Fingerweg muss
  // derselbe zusätzliche Leistenweg sein, kein Test eines festen Abstands.
  await touch(client, 'touchStart', 140, y)
  await touch(client, 'touchMove', 195, y)
  await expect.poll(async () => { const rect = (await sheet.boundingBox())!; return rect.x + rect.width }).toBeCloseTo(55, 0)
  const first = (await sheet.boundingBox())!
  await touch(client, 'touchMove', 255, y)
  await expect.poll(async () => (await sheet.boundingBox())!.x - first.x).toBeCloseTo(60, 0)
  await page.screenshot({ path: info.outputPath('drawer-follows-finger.png') })
  await page.waitForTimeout(500) // Auch eine Pause mitten im Wischen bleibt Menübedienung.
  await expect(page.locator('[data-dnd-dragging]')).toHaveCount(0)
  await touch(client, 'touchMove', 142, y)
  await page.waitForTimeout(120) // Loslassen ohne Restgeschwindigkeit.
  await touch(client, 'touchEnd')
  await expect(page.getByRole('dialog', { name: 'Menü', exact: true })).toBeHidden()
  await expect(page.getByRole('dialog', { name: 'Aufgabe', exact: true })).toBeHidden()

  await touch(client, 'touchStart', 60, y)
  await touch(client, 'touchMove', 280, y)
  await touch(client, 'touchEnd')
  await menuSettled(page)
  await touch(client, 'touchStart', 382, 420)
  await touch(client, 'touchMove', 302, 420)
  await expect.poll(async () => (await sheet.boundingBox())!.x).toBeCloseTo(-80, 0)
  await touch(client, 'touchMove', 142, 420)
  await touch(client, 'touchEnd')
  await expect(page.getByRole('dialog', { name: 'Menü', exact: true })).toBeHidden()
  await expect(phone.taskRow(page, 'Bericht')).toBeVisible()

  await page.emulateMedia({ reducedMotion: 'reduce' })
  await phone.openMenu(page)
  await page.getByRole('button', { name: 'Menü schließen', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Menü', exact: true })).toBeHidden()
})

test('horizontale Bewegung in einem Eingabefeld schließt das Menü nicht', async ({ page, context }) => {
  await phone.register(page, desktop.uniqueEmail('swipe-input'))
  await phone.openMenu(page)
  const input = page.getByLabel('Name der neuen Liste', { exact: true })
  await input.fill('Dieser Entwurf bleibt')
  const box = (await input.boundingBox())!
  const client = await context.newCDPSession(page)
  await touch(client, 'touchStart', box.x + box.width - 15, box.y + box.height / 2)
  await touch(client, 'touchMove', box.x + 20, box.y + box.height / 2)
  await touch(client, 'touchEnd')
  await expect(page.getByRole('dialog', { name: 'Menü', exact: true })).toBeVisible()
  await expect(input).toHaveValue('Dieser Entwurf bleibt')
})

test('senkrechtes Wischen scrollt Aufgaben, ohne Menü oder Editor zu öffnen', async ({ page, context }) => {
  await phone.register(page, desktop.uniqueEmail('swipe-scroll'))
  await phone.createList(page, 'Lang')
  for (let i = 0; i < 16; i += 1) await phone.createTask(page, `Aufgabe ${i}`)
  const client = await context.newCDPSession(page)
  await touch(client, 'touchStart', 185, 680)
  for (const y of [610, 530, 450, 370]) {
    await touch(client, 'touchMove', 185, y)
    await page.waitForTimeout(30)
  }
  await touch(client, 'touchEnd')
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(100)
  await expect(page.getByRole('dialog', { name: 'Menü', exact: true })).toBeHidden()
  await expect(page.getByRole('dialog', { name: 'Aufgabe', exact: true })).toBeHidden()
})

test('Listen-Langdruck sortiert im Menü und aktiviert keinen Randwechsel', async ({ page, context }) => {
  await phone.register(page, desktop.uniqueEmail('list-touch'))
  for (const name of ['A', 'B']) await phone.createList(page, name)
  await phone.openMenu(page)
  const menu = page.getByRole('dialog', { name: 'Menü', exact: true })
  const client = await context.newCDPSession(page)
  const from = (await menu.getByRole('button', { name: 'B', exact: true }).boundingBox())!
  await touch(client, 'touchStart', from.x + from.width / 2, from.y + from.height / 2)
  await expect(page.locator('[data-navigation-list][data-dnd-dragging]')).toBeVisible()
  await touch(client, 'touchMove', 383, from.y)
  await page.waitForTimeout(650)
  await expect(menu).toBeVisible()
  const to = (await menu.getByRole('button', { name: 'A', exact: true }).boundingBox())!
  await touch(client, 'touchMove', to.x + to.width / 2, to.y + to.height * 0.2)
  await touch(client, 'touchEnd')
  await expect(menu).toBeVisible()
  await expect(menu.getByTestId('list-of-lists').getByRole('button')).toHaveText(['B', 'A'])
})
