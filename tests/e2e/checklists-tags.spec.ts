import { expect, test } from '@playwright/test'
import * as desktop from './support/helpers'
import * as phone from './support/mobile'
import { addChecklistPoint, outerTask } from './support/checklists'

test.beforeEach(async ({ request }) => desktop.resetServer(request))
for (const mobile of [false, true]) test.describe(mobile ? 'Punkte Telefon' : 'Punkte breit', () => {
  test.use({ viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 900 }, hasTouch: mobile })
  test('Punkte per Griff umsortieren, abbrechen und in beiden Themen anzeigen', async ({ page, request, context }, info) => {
    await (mobile ? phone.register : desktop.register)(page, desktop.uniqueEmail('checklist-sort'))
    await (mobile ? phone.createList : desktop.createList)(page, 'Vorbereitung')
    await (mobile ? phone.createTask : desktop.createTask)(page, 'Koffer packen')
    const editor = await desktop.openTaskEditor(page, 'Koffer packen')
    for (const text of ['Kleidung', 'Zahnbürste', 'Ladekabel']) await addChecklistPoint(editor, text)
    const grip = editor.getByRole('button', { name: 'Checklistenpunkt verschieben: Ladekabel', exact: true })
    const destination = editor.getByRole('textbox', { name: 'Checklistenpunkt 1', exact: true })
    await grip.scrollIntoViewIfNeeded()
    const from = (await grip.boundingBox())!, to = (await destination.boundingBox())!
    if (mobile) {
      const client = await context.newCDPSession(page)
      const x = from.x + from.width / 2, y = from.y + from.height / 2
      await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] })
      await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y - 8 }] })
      await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: to.y + to.height * 0.15 }] })
      await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
      await client.detach()
    } else {
      await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
      await page.mouse.down()
      await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2 - 8, { steps: 3 })
      await page.mouse.move(from.x + from.width / 2, to.y + to.height * 0.15, { steps: 12 })
      await page.mouse.up()
    }
    await expect(editor.locator('[data-dnd-dragging="true"], [data-dnd-dropping="true"]')).toHaveCount(0)
    await expect(destination).toHaveValue('Ladekabel')
    // Tastatur-Abbruch erhält genau die bereits gewählte Reihenfolge.
    await grip.focus()
    await page.keyboard.press('Space')
    await expect(editor.locator('[data-checklist-item][data-dnd-dragging="true"]')).toHaveCount(1)
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('Escape')
    await expect(page.getByRole('alertdialog', { name: 'Änderungen verwerfen' })).toBeHidden()
    await expect(destination).toHaveValue('Ladekabel')
    await editor.getByLabel('Checklistenpunkt erledigt: Kleidung', { exact: true }).check()
    await editor.getByLabel('Neuer Tag', { exact: true }).fill('Reise')
    await page.evaluate(() => Promise.all(document.getAnimations().filter(animation => animation.effect?.getComputedTiming().iterations !== Infinity).map(animation => animation.finished.catch(() => undefined))))
    await page.screenshot({ path: info.outputPath('checklist-editor-dark.png') })
    await editor.getByRole('button', { name: 'Speichern', exact: true }).click()
    await expect.poll(async () => (await desktop.serverState(request)).tasks.find(task => task.title === 'Koffer packen')?.checklist.map(item => item.text)).toEqual(['Ladekabel', 'Kleidung', 'Zahnbürste'])
    const row = outerTask(page, 'Koffer packen')
    await expect(row).toContainText('Reise')
    await row.getByRole('button', { name: 'Checkliste: Koffer packen', exact: true }).click()
    await expect(row.getByLabel('Checklistenpunkt: Kleidung', { exact: true })).toBeChecked()
    await page.screenshot({ path: info.outputPath('checklist-expanded-dark.png') })
    // Nur die Cloud abschalten: Der Entwicklungsserver hat keinen Offline-
    // Cache. Den Offline-Start des Produktionsbuilds prüft pwa.spec.ts.
    await context.route(`http://127.0.0.1:${process.env.MOCK_SUPABASE_PORT ?? 54321}/**`, route => route.abort('internetdisconnected'))
    await row.getByLabel('Checklistenpunkt: Zahnbürste', { exact: true }).check()
    await expect(row.getByRole('button', { name: 'Checkliste: Koffer packen', exact: true })).toHaveText('2/3')
    await page.reload()
    if (mobile) {
      await phone.openMenu(page)
      await page.getByRole('button', { name: 'Hellen Modus einschalten', exact: true }).click()
      await page.getByRole('dialog', { name: 'Menü', exact: true }).getByRole('button', { name: /^Vorbereitung$/ }).click()
    } else {
      await desktop.selectList(page, 'Vorbereitung')
      await page.getByRole('button', { name: 'Hellen Modus einschalten', exact: true }).click()
    }
    await expect(row.getByRole('button', { name: 'Checkliste: Koffer packen', exact: true })).toHaveText('2/3')
    await row.getByRole('button', { name: 'Checkliste: Koffer packen', exact: true }).click()
    if (mobile) await expect(page.locator('[data-drawer-visible="false"]')).toBeAttached()
    await page.evaluate(() => Promise.all(document.getAnimations().filter(animation => animation.effect?.getComputedTiming().iterations !== Infinity).map(animation => animation.finished.catch(() => undefined))))
    await page.screenshot({ path: info.outputPath('checklist-expanded-light.png') })
    if (mobile) { await page.setViewportSize({ width: 740, height: 360 }); await page.evaluate(() => Promise.all(document.getAnimations().filter(animation => animation.effect?.getComputedTiming().iterations !== Infinity).map(animation => animation.finished.catch(() => undefined)))); await page.screenshot({ path: info.outputPath('checklist-landscape.png') }) }
  })
})
