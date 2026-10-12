import { expect, test, type Locator, type Page } from '@playwright/test'
import * as desktop from './support/helpers'
import * as phone from './support/mobile'
import { openOverview, overviewSettings } from './support/overview'

async function setup(page: Page, mobile: boolean) {
  const register = mobile ? phone.register : desktop.register
  const createList = mobile ? phone.createList : desktop.createList
  const createTask = mobile ? phone.createTask : desktop.createTask
  await register(page, desktop.uniqueEmail('drag'))
  await createList(page, 'Einkaufen')
  for (const name of ['Wasser', 'Saft', 'Apfel']) await createTask(page, name)
  const settings = await desktop.listAction(page, 'Bereiche')
  for (const name of ['Obst', 'Getränke']) {
    await settings.getByLabel('Neuer Bereich').fill(name)
    await settings.getByRole('button', { name: 'Bereich anlegen', exact: true }).click()
  }
  await desktop.closeListSettings(page)
  for (const [title, section] of [['Apfel', 'Obst'], ['Saft', 'Getränke'], ['Wasser', 'Getränke']]) {
    const editor = await desktop.openTaskEditor(page, title)
    await editor.getByLabel('Bereich', { exact: true }).selectOption({ label: section })
    await editor.getByRole('button', { name: 'Speichern', exact: true }).click()
    await expect(editor).toBeHidden()
  }
}

const row = (page: Page, title: string) => page.locator('[data-task-row]:not([data-dnd-placeholder])').filter({ has: page.getByTestId('task-row').filter({ hasText: new RegExp(`^${title}$`) }) })
const group = (page: Page, name: string) => page.getByTestId('section-header').filter({ hasText: name }).locator('..')
async function lift(page: Page, item: Locator) {
  await page.bringToFront()
  await item.scrollIntoViewIfNeeded()
  const box = (await item.getByTestId('task-row').boundingBox())!
  const id = (await item.getAttribute('data-id'))!
  await page.mouse.move(box.x + box.width * 0.7, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width * 0.7, box.y + box.height / 2 + 8, { steps: 2 })
  await expect(page.locator(`[data-id="${id}"][data-dnd-dragging="true"]`)).toBeVisible()
  return id
}
async function over(page: Page, target: Locator, fraction = 0.25) {
  await target.scrollIntoViewIfNeeded()
  const box = (await target.boundingBox())!
  await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * fraction, { steps: 12 })
}
async function recordAnimations(page: Page) {
  await page.evaluate(() => {
    const original = Element.prototype.animate
    const records: { id: string; duration: number }[] = []
    Object.assign(window, { dragAnimations: records })
    Element.prototype.animate = function (frames, options) {
      const id = this.getAttribute('data-id')
      if (id && this.hasAttribute('data-task-row') && !this.hasAttribute('data-dnd-dragging')) {
        records.push({ id, duration: typeof options === 'number' ? options : Number(options?.duration ?? 0) })
      }
      return original.call(this, frames, options)
    }
  })
}
async function expectAnimated(page: Page, ids: string[]) {
  await expect.poll(() => page.evaluate(taskIds => {
    const records = (window as unknown as { dragAnimations: { id: string; duration: number }[] }).dragAnimations
    return taskIds.some(id => records.some(record => record.id === id && record.duration > 0))
  }, ids)).toBe(true)
}

for (const mobile of [false, true]) test.describe(mobile ? 'Ziehen Telefon' : 'Ziehen breit', () => {
  test.use({ viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 800 }, hasTouch: mobile, reducedMotion: 'no-preference' })
  test.beforeEach(async ({ request }) => desktop.resetServer(request))
  test('gefüllter Zielbereich schafft animiert Platz, bevor gespeichert wird', async ({ page, request }, info) => {
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    await setup(page, mobile)
    const taskId = (await row(page, 'Apfel').getAttribute('data-id'))!
    const neighborIds = await Promise.all(['Saft', 'Wasser'].map(title => row(page, title).getAttribute('data-id')))
    await expect.poll(async () => (await desktop.serverState(request)).tasks.find(task => task.id === taskId)?.section_id).toBeTruthy()
    const original = (await desktop.serverState(request)).tasks.find(task => task.id === taskId)!
    await recordAnimations(page)
    await lift(page, row(page, 'Apfel'))
    await over(page, row(page, 'Saft'))
    try {
      await expect(group(page, 'Getränke').locator(`[data-id="${taskId}"][data-dnd-placeholder]`)).toBeAttached()
      await expectAnimated(page, neighborIds as string[])
      expect((await desktop.serverState(request)).tasks.find(task => task.id === taskId)?.section_id).toBe(original.section_id)
      await page.screenshot({ path: info.outputPath('drag-filled.png') })
    } finally { await page.mouse.up() }
    await expect.poll(async () => (await desktop.serverState(request)).tasks.find(task => task.id === taskId)?.section_id).not.toBe(original.section_id)
    await expect(group(page, 'Getränke').locator('[data-task-row]:not([data-dnd-placeholder])')).toHaveText(['Apfel', 'Saft', 'Wasser'])
    await expect(page.getByRole('dialog', { name: 'Aufgabe', exact: true })).toBeHidden()
    expect(errors).toEqual([])
  })

  test('innerhalb eines Bereichs animieren die Nachbarn und die Reihenfolge bleibt gespeichert', async ({ page, request }) => {
    await setup(page, mobile)
    const neighborId = (await row(page, 'Wasser').getAttribute('data-id'))!
    await recordAnimations(page)
    const id = await lift(page, row(page, 'Saft'))
    await over(page, row(page, 'Wasser'), 0.9)
    try { await expectAnimated(page, [neighborId]) } finally { await page.mouse.up() }
    await expect(group(page, 'Getränke').locator('[data-task-row]')).toHaveText(['Wasser', 'Saft'])
    await expect.poll(async () => {
      const tasks = (await desktop.serverState(request)).tasks
      return (tasks.find(task => task.id === id)?.position ?? -Infinity) > (tasks.find(task => task.id === neighborId)?.position ?? Infinity)
    }).toBe(true)
  })

  test('kopfloser leerer Teil und leerer Bereich nehmen Aufgaben auf', async ({ page, request }) => {
    await setup(page, mobile)
    await expect(page.getByTestId('section-header').filter({ hasText: 'Ohne Bereich' })).toHaveCount(0)
    const ungrouped = page.locator('[data-task-group]').first()
    const id = await lift(page, row(page, 'Apfel'))
    await over(page, ungrouped.getByTestId('gruppe-leer'), 0.5)
    try { await expect(ungrouped.locator(`[data-id="${id}"][data-dnd-placeholder]`)).toBeAttached() } finally { await page.mouse.up() }
    await expect.poll(async () => (await desktop.serverState(request)).tasks.find(task => task.id === id)?.section_id).toBeNull()
    await lift(page, row(page, 'Apfel'))
    await over(page, group(page, 'Obst').getByTestId('gruppe-leer'), 0.5)
    await page.mouse.up()
    await expect.poll(async () => (await desktop.serverState(request)).tasks.find(task => task.id === id)?.section_id).toBeTruthy()
    await expect(group(page, 'Obst').locator('[data-task-row]')).toHaveText(['Apfel'])
  })

  test('Abbrechen nimmt die Vorschau zurück und schreibt nichts', async ({ page, request }) => {
    await setup(page, mobile)
    const id = (await row(page, 'Apfel').getAttribute('data-id'))!
    await expect.poll(async () => (await desktop.serverState(request)).tasks.find(task => task.id === id)?.section_id).toBeTruthy()
    const original = (await desktop.serverState(request)).tasks.find(task => task.id === id)!
    await lift(page, row(page, 'Apfel'))
    await over(page, row(page, 'Saft'))
    await expect(group(page, 'Getränke').locator(`[data-id="${id}"][data-dnd-placeholder]`)).toBeAttached()
    await page.keyboard.press('Escape')
    await page.mouse.up()
    await expect(group(page, 'Obst').locator('[data-task-row]')).toHaveText(['Apfel'])
    expect((await desktop.serverState(request)).tasks.find(task => task.id === id)).toEqual(original)
  })

  test('zugeklappter Zielbereich öffnet nur die Vorschau und behält seine Klappstellung', async ({ page, request }) => {
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    await setup(page, mobile)
    const header = page.getByTestId('section-header').filter({ hasText: 'Getränke' })
    await header.click()
    await expect(row(page, 'Saft')).toHaveCount(0)
    const id = await lift(page, row(page, 'Apfel'))
    await over(page, header, 0.5)
    try { await expect(group(page, 'Getränke').locator(`[data-id="${id}"][data-dnd-placeholder]`)).toBeAttached() } finally { await page.mouse.up() }
    await expect(header).toHaveAttribute('aria-expanded', 'false')
    await expect(row(page, 'Apfel')).toHaveCount(0)
    await header.click()
    await expect(row(page, 'Apfel')).toBeVisible()
    await expect.poll(async () => (await desktop.serverState(request)).tasks.find(task => task.id === id)?.section_id).toBe(await header.getAttribute('data-section-id'))
    expect(errors).toEqual([])
  })

  test('Enter öffnet den Editor, ohne eine Ziehgeste zu starten', async ({ page }) => {
    await setup(page, mobile)
    await row(page, 'Apfel').getByTestId('task-row').focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('dialog', { name: 'Aufgabe', exact: true })).toBeVisible({ timeout: 2500 })
    await expect(page.getByRole('dialog', { name: 'Aufgabe', exact: true }).getByLabel('Titel', { exact: true })).toHaveValue('Apfel')
    await expect(page.locator('[data-dnd-dragging]')).toHaveCount(0)
  })

  test('Tastatur sortiert mit Leertaste und Pfeil; Escape verwirft den nächsten Zug', async ({ page }) => {
    await setup(page, mobile)
    await page.bringToFront()
    const item = row(page, 'Saft')
    const id = await item.getAttribute('data-id')
    await item.getByTestId('task-row').focus()
    await page.keyboard.press('Space')
    await expect(page.locator(`[data-id="${id}"][data-dnd-dragging="true"]`)).toBeVisible()
    await page.keyboard.press('ArrowDown')
    await expect(group(page, 'Getränke').locator('[data-task-row]:not([data-dnd-dragging])')).toHaveText(['Wasser', 'Saft'])
    await page.keyboard.press('Space')
    await expect(group(page, 'Getränke').locator('[data-task-row]')).toHaveText(['Wasser', 'Saft'])
    await item.getByTestId('task-row').focus()
    await page.keyboard.press('Space')
    await expect(page.locator(`[data-id="${id}"][data-dnd-dragging="true"]`)).toBeVisible()
    await page.keyboard.press('ArrowUp')
    await page.keyboard.press('Escape')
    await expect(group(page, 'Getränke').locator('[data-task-row]')).toHaveText(['Wasser', 'Saft'])
    await expect(page.getByRole('dialog', { name: 'Aufgabe', exact: true })).toBeHidden()
  })

  test('Gesamtansicht verschiebt zwischen Listen und Originalansicht zeigt denselben Stand', async ({ page, request }, info) => {
    await setup(page, mobile)
    const createList = mobile ? phone.createList : desktop.createList
    const createTask = mobile ? phone.createTask : desktop.createTask
    await createList(page, 'Arbeit')
    await createTask(page, 'Bericht')
    await openOverview(page, mobile)
    const settings = await overviewSettings(page)
    for (const name of ['Einkaufen', 'Arbeit']) {
      await settings.getByLabel(name, { exact: true }).check()
      await expect(settings.getByLabel(name, { exact: true })).toBeEnabled()
    }
    await settings.getByRole('button', { name: 'Schließen', exact: true }).click()
    const id = await lift(page, row(page, 'Apfel'))
    await over(page, row(page, 'Bericht'))
    const target = page.getByRole('region', { name: 'Aufgaben aus Arbeit', exact: true })
    try { await expect(target.locator(`[data-id="${id}"][data-dnd-placeholder]`)).toBeAttached() } finally { await page.mouse.up() }
    await expect(target.getByTestId('overview-task')).toHaveText(['Apfel', 'Bericht'])
    if (mobile) {
      const create = page.getByRole('button', { name: 'Neue Aufgabe', exact: true })
      await expect(create).toBeInViewport()
      await create.click()
      const choose = page.getByRole('dialog', { name: 'Zielliste wählen', exact: true })
      await expect(choose).toBeVisible()
      await choose.getByRole('button', { name: 'Schließen', exact: true }).click()
    }
    await page.screenshot({ path: info.outputPath('overview-after-move.png') })
    await expect.poll(async () => {
      const state = await desktop.serverState(request)
      return state.tasks.find(task => task.id === id)?.list_id === state.lists.find(list => list.name === 'Arbeit')?.id
    }).toBe(true)
    await page.getByRole('button', { name: /^Liste Arbeit öffnen$/ }).click()
    await expect(page.locator('[data-task-row]')).toHaveText(['Apfel', 'Bericht'])
    const editor = await desktop.openTaskEditor(page, 'Apfel')
    await expect(editor).toContainText('Liste: Arbeit')
    expect((await desktop.serverState(request)).tasks.find(task => task.id === id)?.section_id).toBeNull()
  })
})

test.describe('Echte Touch-Gesten', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true })
  test.beforeEach(async ({ request }) => desktop.resetServer(request))
  test('Langdruck verschiebt; kurzes Wischen scrollt ohne Verschiebung', async ({ page, context, request }, info) => {
    await setup(page, true)
    const client = await context.newCDPSession(page)
    await page.bringToFront()
    const source = row(page, 'Apfel')
    const id = (await source.getAttribute('data-id'))!
    const box = (await source.getByTestId('task-row').boundingBox())!
    const x = box.x + box.width * 0.7
    const y = box.y + box.height / 2
    await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] })
    await expect(page.locator(`[data-id="${id}"][data-dnd-dragging="true"]`)).toBeVisible()
    const target = (await row(page, 'Saft').boundingBox())!
    await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: target.y + target.height * 0.25 }] })
    await expect(group(page, 'Getränke').locator(`[data-id="${id}"][data-dnd-placeholder]`)).toBeAttached()
    const previewIds = await group(page, 'Getränke').locator('[data-task-row]:not([data-dnd-dragging])').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-id')))
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await expect.poll(() => group(page, 'Getränke').locator('[data-task-row]:not([data-dnd-placeholder])').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-id')))).toEqual(previewIds)
    await expect(page.getByRole('dialog', { name: 'Aufgabe', exact: true })).toBeHidden()
    for (let i = 0; i < 10; i++) await phone.createTask(page, `Scrollaufgabe ${i}`)
    await row(page, 'Scrollaufgabe 9').scrollIntoViewIfNeeded()
    const beforeScroll = await page.evaluate(() => window.scrollY)
    const again = (await row(page, 'Scrollaufgabe 9').getByTestId('task-row').boundingBox())!
    const startY = again.y + again.height / 2
    const measurements = await page.evaluate(({ x, y }) => {
      const result = []
      let node = document.elementFromPoint(x, y)
      while (node) {
        const css = getComputedStyle(node)
        result.push({ tag: node.tagName, cls: node.className, height: node.clientHeight, content: node.scrollHeight, top: node.scrollTop, overflow: css.overflowY, overscroll: css.overscrollBehaviorY, touch: css.touchAction })
        node = node.parentElement
      }
      return result
    }, { x, y: startY })
    await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: startY }] })
    for (const delta of [20, 40, 80]) await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: startY - delta }] })
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await info.attach('touch-scroll.json', { body: JSON.stringify({ measurements, beforeScroll, afterScroll: await page.evaluate(() => window.scrollY) }), contentType: 'application/json' })
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(beforeScroll)
    await expect(page.locator('[data-dnd-dragging]')).toHaveCount(0)
    await expect(group(page, 'Getränke').getByTestId('task-row')).toHaveCount(3)
    await expect.poll(async () => (await desktop.serverState(request)).tasks.filter(task => previewIds.includes(task.id)).sort((a, b) => a.position - b.position).map(task => task.id)).toEqual(previewIds)
  })
})
