import { expect, test } from '@playwright/test'
import * as desktop from './support/helpers'
import { addChecklistPoint, outerTask } from './support/checklists'

test.beforeEach(async ({ page, request }) => {
  await desktop.resetServer(request)
  await desktop.register(page, desktop.uniqueEmail('rating-refinements'))
  await desktop.createList(page, 'Arbeit')
})

test('Checklisten und Tags sind direkt erreichbar und Strg+Enter speichert den letzten Text', async ({ page, request }) => {
  const form = page.getByRole('form', { name: 'Neue Aufgabe anlegen', exact: true })
  await form.getByLabel('Neue Aufgabe', { exact: true }).fill('Mit Details')
  await expect(form.getByLabel('Neuer Checklistenpunkt', { exact: true })).toBeVisible()
  await expect(form.getByLabel('Neuer Tag', { exact: true })).toBeVisible()
  await form.getByLabel('Neuer Checklistenpunkt', { exact: true }).fill('Noch nicht einzeln bestätigt')
  await form.getByLabel('Neuer Tag', { exact: true }).fill('Uni')
  await form.getByLabel('Neuer Tag', { exact: true }).press('Control+Enter')
  await expect(form.getByLabel('Neue Aufgabe', { exact: true })).toHaveValue('')
  await expect(form.getByLabel('Neue Aufgabe', { exact: true })).toBeFocused()
  await expect.poll(async () => (await desktop.serverState(request)).tasks.find(task => task.title === 'Mit Details')).toMatchObject({
    checklist: [{ text: 'Noch nicht einzeln bestätigt', completed: false }], tags: ['Uni'],
  })
  const editor = await desktop.openTaskEditor(page, 'Mit Details')
  await editor.getByLabel('Titel', { exact: true }).fill('Umbenannt')
  await editor.getByLabel('Titel', { exact: true }).press('Control+Enter')
  await expect(editor).toBeHidden()
  await desktop.openTaskEditor(page, 'Umbenannt')
  await editor.getByLabel('Neuer Checklistenpunkt', { exact: true }).fill('Zweiter Punkt')
  await editor.getByLabel('Neuer Checklistenpunkt', { exact: true }).press('Control+Enter')
  await expect(editor).toBeHidden()
  await expect.poll(async () => (await desktop.serverState(request)).tasks.find(task => task.title === 'Umbenannt')?.checklist.length).toBe(2)
})

test('Ablegen unter der Liste fügt am Listenende ein', async ({ page }) => {
  for (const title of ['A', 'B', 'C']) await desktop.createTask(page, title)
  await page.getByTestId('list-title').click()
  const source = outerTask(page, 'C')
  await source.scrollIntoViewIfNeeded()
  const box = (await source.getByTestId('task-row').boundingBox())!
  await page.mouse.move(box.x + box.width * 0.7, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width * 0.7, box.y + box.height / 2 + 9, { steps: 3 })
  await expect(page.locator('[data-dnd-dragging="true"]')).toBeVisible()
  // Der sichtbare freie Raum direkt unter der letzten Aufgabe gehört zum Ende.
  const last = (await outerTask(page, 'A').boundingBox())!
  const y = page.viewportSize()!.height - 50
  await page.mouse.move(last.x + last.width * 0.7, y, { steps: 16 })
  await page.mouse.up()
  await expect(page.locator('[data-task-row]:not([data-dnd-placeholder])').getByTestId('task-row')).toHaveText(['B', 'A', 'C'])
  await expect(page.getByRole('status').filter({ hasText: 'Position wird gespeichert' })).toBeHidden()
  await page.reload()
  await desktop.selectList(page, 'Arbeit')
  await expect(page.locator('[data-task-row]').getByTestId('task-row')).toHaveText(['B', 'A', 'C'])
})

test('Checklistenbereich zieht die Hauptaufgabe, Kästchen bleiben unabhängig', async ({ page }) => {
  await desktop.createTask(page, 'Mit Checkliste')
  const editor = await desktop.openTaskEditor(page, 'Mit Checkliste')
  await addChecklistPoint(editor, 'Greifbarer Text')
  await editor.getByRole('button', { name: 'Speichern', exact: true }).click()
  await expect(editor).toBeHidden()
  await desktop.createTask(page, 'Andere Aufgabe')
  const source = outerTask(page, 'Mit Checkliste')
  await source.getByRole('button', { name: 'Checkliste: Mit Checkliste', exact: true }).click()
  const box = (await source.getByText('Greifbarer Text', { exact: true }).boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 - 9, { steps: 3 })
  await expect(page.locator('[data-dnd-dragging="true"]')).toBeVisible()
  const target = (await outerTask(page, 'Andere Aufgabe').boundingBox())!
  await page.mouse.move(target.x + target.width * 0.7, target.y + 4, { steps: 15 })
  await page.mouse.up()
  await expect(page.locator('[data-task-row]:not([data-dnd-placeholder])').first()).toHaveAttribute('data-id', await source.getAttribute('data-id') ?? '')
  await expect(source.getByLabel('Checklistenpunkt: Greifbarer Text', { exact: true })).not.toBeChecked()
  await source.getByLabel('Checklistenpunkt: Greifbarer Text', { exact: true }).check()
  await expect(source.getByRole('button', { name: 'Checkliste: Mit Checkliste', exact: true })).toHaveText('1/1')
})

test('Eine Aufgabenzeile hat nur einen Tastaturstopp zum Bearbeiten', async ({ page }) => {
  await desktop.createTask(page, 'Tastatur')
  const row = outerTask(page, 'Tastatur')
  await row.getByRole('checkbox', { name: 'Aufgabe erledigen: Tastatur', exact: true }).focus()
  await page.keyboard.press('Shift+Tab')
  await expect(row.getByRole('button', { name: 'Bearbeiten', exact: true })).toBeFocused()
  await page.keyboard.press('Shift+Tab')
  expect(await row.evaluate(el => el.contains(document.activeElement))).toBe(false)
})
