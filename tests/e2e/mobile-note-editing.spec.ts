import { expect, test } from '@playwright/test'
import * as desktop from './support/helpers'
import * as phone from './support/mobile'
import { outerTask } from './support/checklists'

test.use({ viewport: { width: 390, height: 650 }, hasTouch: true })
test.beforeEach(async ({ request }) => desktop.resetServer(request))

test('lange Notizen bleiben beim Schreiben an derselben Scrollposition', async ({ page }) => {
  await phone.register(page, desktop.uniqueEmail('long-note'))
  await phone.createList(page, 'Notizen')
  await page.getByRole('button', { name: 'Neue Aufgabe', exact: true }).click()
  await page.getByLabel('Titel', { exact: true }).fill('Lange Notiz')
  const note = page.getByRole('textbox', { name: 'Notiz', exact: true })
  const text = Array.from({ length: 120 }, (_, index) => `Zeile ${index}: Ein kurzer Absatz.`).join('\n')
  await note.fill(text)
  for (const top of [350, 700]) {
    await note.evaluate((element, scrollTop) => {
      const field = element as HTMLElement
      field.focus({ preventScroll: true })
      const area = field.closest('.scroll-area')!
      area.scrollTop = scrollTop
      const range = document.caretRangeFromPoint(field.getBoundingClientRect().left + 30, area.getBoundingClientRect().top + area.clientHeight / 2)
      if (!range || !field.contains(range.startContainer)) throw new Error('Schreibposition liegt außerhalb der Notiz')
      const selection = window.getSelection()!
      selection.removeAllRanges(); selection.addRange(range)
    }, top)
    const before = await note.evaluate(element => element.closest('.scroll-area')!.scrollTop)
    for (const character of ['x', '!', '@', 'ä']) {
      await page.keyboard.insertText(character)
      await expect.poll(() => note.evaluate(element => element.closest('.scroll-area')!.scrollTop)).toBe(before)
      await expect(note).toBeFocused()
    }
  }
})

test('Cursorbewegung nach links bleibt am Anfang der Notiz', async ({ page }) => {
  await phone.register(page, desktop.uniqueEmail('note-caret'))
  await phone.createList(page, 'Notizen')
  await page.getByRole('button', { name: 'Neue Aufgabe', exact: true }).click()
  const note = page.getByRole('textbox', { name: 'Notiz', exact: true })
  await note.fill('Text')
  // Über den Anfang hinaus bewegen, wie bei der Cursorsteuerung der Handytastatur.
  for (let index = 0; index < 7; index++) await note.press('ArrowLeft')
  await expect(note).toBeFocused()
  expect(await note.evaluate(() => window.getSelection()!.focusOffset)).toBe(0)
})

test('Ziehen über eine lange aufgeklappte Notiz hat keine innere Scrollfläche', async ({ page, request }) => {
  await phone.register(page, desktop.uniqueEmail('drag-long-note'))
  await phone.createList(page, 'Notizen')
  await phone.createTask(page, 'Mit langer Notiz', Array.from({ length: 24 }, (_, index) => `Absatz ${index}`).join('\n'))
  await phone.createTask(page, 'Verschieben')
  await expect.poll(async () => (await desktop.serverState(request)).tasks.filter(task => !task.deleted_at)
    .sort((a, b) => a.position - b.position).map(task => task.title)).toEqual(['Verschieben', 'Mit langer Notiz'])
  const long = outerTask(page, 'Mit langer Notiz')
  await long.getByRole('button', { name: 'Notiz aufklappen', exact: true }).click()
  const description = long.getByTestId('task-description').locator('..')
  // Die Liste besitzt den Scrollvorgang; die Notiz verschluckt ihn nicht mehr.
  expect(await description.evaluate(element => { element.scrollTop = 100; return element.scrollTop })).toBe(0)
  const source = outerTask(page, 'Verschieben')
  await source.scrollIntoViewIfNeeded()
  const box = (await source.boundingBox())!
  await page.mouse.move(box.x + box.width * 0.7, box.y + box.height / 2)
  await page.mouse.down()
  try {
    await page.mouse.move(box.x + box.width * 0.7, box.y + box.height / 2 + 10, { steps: 3 })
    await expect(page.locator('[data-dnd-dragging="true"]')).toBeVisible()
    const target = (await long.boundingBox())!
    await page.mouse.move(target.x + target.width * 0.7, Math.min(590, target.y + target.height * 0.8), { steps: 16 })
  } finally { await page.mouse.up() }
  await expect.poll(async () => (await desktop.serverState(request)).tasks.filter(task => !task.deleted_at)
    .sort((a, b) => a.position - b.position).map(task => task.title)).toEqual(['Mit langer Notiz', 'Verschieben'])
  expect(await description.evaluate(element => element.scrollTop)).toBe(0)
})
