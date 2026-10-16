import { expect, test } from '@playwright/test'
import * as desktop from './support/helpers'
import { openOverview, overviewSettings } from './support/overview'
import { setDueAt } from './support/taskForms'

test.beforeEach(async ({ request }) => desktop.resetServer(request))

for (const overview of [false, true]) for (const filled of [false, true]) {
  test(`Ein Klick hakt ab trotz geöffneter ${overview ? 'Gesamterfassung' : 'Listenerfassung'} (${filled ? 'mit Eingabe' : 'leer'})`, async ({ page, request }) => {
    await desktop.register(page, desktop.uniqueEmail('creation-check'))
    await desktop.createList(page, 'Arbeit')
    await desktop.createTask(page, 'Bestehende Aufgabe')
    if (overview) {
      await openOverview(page, false)
      const settings = await overviewSettings(page)
      await settings.getByLabel('Arbeit', { exact: true }).check()
      await settings.getByRole('button', { name: 'Schließen', exact: true }).click()
    }
    const title = page.getByLabel('Neue Aufgabe', { exact: true })
    if (filled) await title.fill('Noch nicht speichern')
    else await title.focus()
    await expect(page.getByLabel('Beschreibung', { exact: true })).toBeVisible()
    await page.getByRole('checkbox', { name: 'Aufgabe erledigen: Bestehende Aufgabe', exact: true }).click({ delay: 120 })
    await expect.poll(async () => (await desktop.serverState(request)).tasks.find(task => task.title === 'Bestehende Aufgabe')?.completed).toBe(true)
    if (filled) {
      await expect(title).toHaveValue('Noch nicht speichern')
      await expect(page.getByLabel('Beschreibung', { exact: true })).toBeVisible()
    }
  })
}

test('Gesamtentwurf bleibt beim Zielwechsel unabhängig vom Listenentwurf', async ({ page }) => {
  await desktop.register(page, desktop.uniqueEmail('separate-drafts'))
  await desktop.createList(page, 'Arbeit')
  await desktop.createList(page, 'Einkaufen')
  await page.getByLabel('Neue Aufgabe', { exact: true }).fill('Listenentwurf')
  await page.getByLabel('Beschreibung', { exact: true }).fill('Notiz nur für die Liste')
  await openOverview(page, false)
  const title = page.getByLabel('Neue Aufgabe', { exact: true })
  await title.fill('Gesamtentwurf')
  await page.getByLabel('Beschreibung', { exact: true }).fill('Notiz für die Gesamtansicht')
  await page.getByLabel('Zielliste', { exact: true }).selectOption({ label: 'Arbeit' })
  await expect(title).toHaveValue('Gesamtentwurf')
  await page.getByLabel('Zielliste', { exact: true }).selectOption({ label: 'Einkaufen' })
  await expect(title).toHaveValue('Gesamtentwurf')
  await expect(page.getByRole('group', { name: 'Entwurf auswählen', exact: true })).toHaveCount(0)
  await desktop.selectList(page, 'Einkaufen')
  await expect(title).toHaveValue('Listenentwurf')
  await expect(page.getByLabel('Beschreibung', { exact: true })).toHaveValue('Notiz nur für die Liste')
  await openOverview(page, false)
  await expect(title).toHaveValue('Gesamtentwurf')
  await expect(page.getByLabel('Zielliste', { exact: true })).toHaveValue(await page.getByLabel('Zielliste').locator('option').filter({ hasText: 'Einkaufen' }).getAttribute('value') ?? '')
})

test('Sortierhinweis bleibt an seinem Knopf verankert', async ({ page }) => {
  await desktop.register(page, desktop.uniqueEmail('sort-hint'))
  await desktop.createList(page, 'Arbeit')
  await openOverview(page, false)
  const trigger = page.getByRole('button', { name: 'Sortierung ändern', exact: true })
  const anchor = (await trigger.boundingBox())!
  await trigger.hover()
  const hint = page.getByRole('tooltip').filter({ hasText: 'Sortierung ändern' })
  await expect(hint).toBeVisible()
  const position = (await hint.boundingBox())!
  expect(Math.abs(position.x + position.width / 2 - anchor.x - anchor.width / 2)).toBeLessThan(180)
  expect(Math.abs(position.y - anchor.y)).toBeLessThan(130)
})

for (const mobile of [false, true]) test.describe(mobile ? 'Feedback Telefon' : 'Feedback breit', () => {
  test.use({ viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 800 }, hasTouch: mobile, timezoneId: 'UTC' })
  test('Fälligkeiten erscheinen relativ, der genaue Termin bleibt im Hinweis', async ({ page }, info) => {
    const phone = await import('./support/mobile')
    const now = Math.floor(Date.now() / 60_000) * 60_000
    await page.clock.setFixedTime(new Date(now))
    await (mobile ? phone.register : desktop.register)(page, desktop.uniqueEmail('relative-due'))
    await (mobile ? phone.createList : desktop.createList)(page, 'Relative Termine')
    await (mobile ? phone.createTask : desktop.createTask)(page, 'Ohne Zusatzangaben')
    for (const [title, offset] of [['Später fällig', 200], ['Schon überfällig', -120]] as const) {
      await (mobile ? phone.createTask : desktop.createTask)(page, title)
      const editor = await desktop.openTaskEditor(page, title)
      await editor.getByLabel('Beschreibung', { exact: true }).fill('Zusatzangaben unter dem Titel')
      await setDueAt(editor, new Date(now + offset * 60_000).toISOString().slice(0, 16))
      await editor.getByRole('button', { name: 'Speichern', exact: true }).click()
      await expect(editor).toBeHidden()
    }
    await expect(page.getByText('Seit 2 Stunden überfällig', { exact: true })).toBeVisible()
    const future = page.getByText('In 3 Stunden und 20 Minuten', { exact: true })
    await expect(future).toBeVisible()
    if (!mobile) {
      await future.hover()
      const exact = new Date(now + 200 * 60_000).toLocaleString('de-DE', { timeZone: 'UTC', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
      await expect(page.getByRole('tooltip')).toHaveText(`Fällig: ${exact}`)
    }
    await page.screenshot({ path: info.outputPath('relative-due.png') })
    if (mobile) {
      await page.setViewportSize({ width: 740, height: 360 })
      await page.screenshot({ path: info.outputPath('relative-due-landscape.png') })
    }
  })
  test('Abmelden ist über Konto erreichbar', async ({ page }) => {
    const phone = await import('./support/mobile')
    await (mobile ? phone.register : desktop.register)(page, desktop.uniqueEmail('account-logout'))
    if (mobile) await phone.openMenu(page)
    await expect(page.getByRole('button', { name: 'Abmelden', exact: true })).toHaveCount(0)
    await page.getByRole('button', { name: 'Konto', exact: true }).click()
    await page.getByRole('dialog', { name: 'Konto', exact: true }).getByRole('button', { name: 'Abmelden', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Anmelden', exact: true })).toBeVisible()
  })
  test('der freie Rand der äußeren Aufgabenzeile öffnet dieselbe Aufgabe', async ({ page }, info) => {
    const phone = await import('./support/mobile')
    await (mobile ? phone.register : desktop.register)(page, desktop.uniqueEmail('outer-row'))
    await (mobile ? phone.createList : desktop.createList)(page, 'Fläche')
    await (mobile ? phone.createTask : desktop.createTask)(page, 'Eine Aufgabe')
    const editor = await desktop.openTaskEditor(page, 'Eine Aufgabe')
    await editor.getByLabel('Beschreibung', { exact: true }).fill('Beschreibung über der freien Fläche')
    await editor.getByRole('button', { name: 'Speichern', exact: true }).click()
    await expect(editor).toBeHidden()
    const item = page.locator('[data-task-row]').filter({ hasText: 'Eine Aufgabe' })
    const box = (await item.boundingBox())!
    await page.mouse.click(box.x + 10, box.y + box.height - 4)
    await expect(editor).toBeVisible({ timeout: 2500 })
    await editor.getByRole('button', { name: 'Schließen', exact: true }).click()
    if (!mobile) {
      const updated = (await item.boundingBox())!
      await page.mouse.move(updated.x + 10, updated.y + updated.height - 4)
      await page.mouse.down()
      await page.mouse.move(updated.x + 10, updated.y + updated.height - 14, { steps: 3 })
      try { await expect(page.locator('[data-dnd-dragging]')).toBeVisible({ timeout: 2000 }) }
      finally { await page.keyboard.press('Escape'); await page.mouse.up() }
      await expect(page.locator('[data-dnd-dragging]')).toHaveCount(0)
      await expect(editor).toBeHidden()
      await item.hover()
    }
    const [r, b, t, c] = await Promise.all([item.boundingBox(), item.getByTestId('task-row').boundingBox(),
      item.getByText('Eine Aufgabe', { exact: true }).boundingBox(), item.getByRole('checkbox').boundingBox()])
    if (!r || !b || !t || !c) throw new Error('Die sichtbaren Teile der Aufgabenzeile müssen messbar sein.')
    await info.attach('Zeilenmaße', { body: JSON.stringify({ rowWidth: r.width, clickableWidth: b.width,
      titleCenter: t.y + t.height / 2, checkboxCenter: c.y + c.height / 2 }), contentType: 'application/json' })
    await page.screenshot({ path: info.outputPath('outer-task-row.png') })
  })

  test('neue Liste behält Symbol und Einstellungen bis zum Anlegen', async ({ page, request }, info) => {
    const phone = await import('./support/mobile')
    await (mobile ? phone.register : desktop.register)(page, desktop.uniqueEmail('list-options'))
    if (mobile) await phone.openMenu(page)
    const form = page.getByRole('form', { name: 'Neue Liste', exact: true })
    const title = form.getByLabel('Name der neuen Liste', { exact: true })
    await expect(form.getByRole('group', { name: 'Einstellungen der neuen Liste', exact: true })).toHaveCount(0)
    await title.focus()
    await expect(form.getByRole('group', { name: 'Einstellungen der neuen Liste', exact: true })).toBeVisible()
    await expect(form.getByLabel('In Gesamtansicht aufnehmen', { exact: true })).not.toBeChecked()
    await expect(form.getByLabel('Erledigt am Listenende', { exact: true })).not.toBeChecked()
    await title.fill('Musik mit Einstellungen')
    await form.getByLabel('In Gesamtansicht aufnehmen', { exact: true }).check()
    await form.getByLabel('Erledigt am Listenende', { exact: true }).check()
    await form.getByRole('button', { name: 'Symbol der neuen Liste auswählen', exact: true }).click()
    const picker = page.getByRole('dialog', { name: 'Symbol auswählen', exact: true })
    await picker.getByRole('button', { name: 'Musik', exact: true }).click()
    if (mobile) {
      await page.getByRole('button', { name: 'Menü schließen', exact: true }).click()
      await phone.openMenu(page)
    } else {
      await page.setViewportSize({ width: 390, height: 844 })
      await phone.openMenu(page)
      await expect(page.getByLabel('Name der neuen Liste', { exact: true })).toHaveValue('Musik mit Einstellungen')
      await page.getByRole('button', { name: 'Menü schließen', exact: true }).click()
      await page.setViewportSize({ width: 1280, height: 800 })
    }
    await expect(title).toHaveValue('Musik mit Einstellungen')
    await expect(form.getByLabel('Erledigt am Listenende', { exact: true })).toBeChecked()
    await page.screenshot({ path: info.outputPath('new-list.png') })
    await form.getByRole('button', { name: 'Liste anlegen', exact: true }).click()
    await expect.poll(async () => (await desktop.serverState(request)).lists.find(list => list.name === 'Musik mit Einstellungen')?.keep_completed).toBe(true)
    const saved = (await desktop.serverState(request)).lists.find(list => list.name === 'Musik mit Einstellungen')!
    expect(saved.icon).toBeTruthy()
    await openOverview(page, mobile)
    const settings = await overviewSettings(page)
    await expect(settings.getByLabel('Musik mit Einstellungen', { exact: true })).toBeChecked()
  })

  test('Namen und Kontoinformationen sind verständlich erreichbar', async ({ page, browser, request }) => {
    const recipient = desktop.uniqueEmail('named-member')
    await desktop.createAccount(request, recipient)
    const recipientName = desktop.usernameFor(recipient)
    const phone = await import('./support/mobile')
    await (mobile ? phone.register : desktop.register)(page, desktop.uniqueEmail('named-owner'))
    await (mobile ? phone.createList : desktop.createList)(page, 'Gemeinsam')
    const settings = await desktop.listAction(page, 'Teilen')
    await settings.getByLabel('Benutzername oder E-Mail', { exact: true }).fill('@' + recipientName.toUpperCase())
    await settings.getByRole('button', { name: 'Freigeben', exact: true }).click()
    await expect(settings.getByText('@' + recipientName, { exact: true })).toBeVisible()
    await expect(settings.getByText(/^Mitglied [a-f0-9]{8}$/)).toHaveCount(0)
    const other = await browser.newContext({ viewport: { width: 1280, height: 800 }, hasTouch: false })
    try {
      const friend = await other.newPage()
      await desktop.login(friend, recipient)
      await friend.getByRole('button', { name: 'Konto', exact: true }).click()
      await friend.getByLabel('Benutzername', { exact: true }).fill('renamed_friend')
      await friend.getByRole('dialog', { name: 'Konto', exact: true }).getByRole('button', { name: 'Speichern', exact: true }).click()
      await expect(friend.getByText('Benutzername gespeichert.', { exact: true })).toBeVisible()
      await desktop.closeListSettings(page)
      if (mobile) await phone.openMenu(page)
      await page.getByRole('button', { name: 'Jetzt synchronisieren', exact: true }).click()
      if (mobile) await page.getByRole('button', { name: 'Menü schließen', exact: true }).click()
      const refreshed = await desktop.listAction(page, 'Teilen')
      await expect(refreshed.getByText('@renamed_friend', { exact: true })).toBeVisible()
      await desktop.closeListSettings(page)
      if (mobile) await phone.openMenu(page)
      await page.getByRole('button', { name: 'Konto', exact: true }).click()
      const account = page.getByRole('dialog', { name: 'Konto', exact: true })
      await account.getByText('Technische Informationen', { exact: true }).click()
      await expect(account.getByTestId('backend-label')).toContainText('Mock')
    } finally { await other.close() }
  })

  test('kompakte Gesamtansicht und klar getrennte Menüaktionen', async ({ page }, info) => {
    const phone = await import('./support/mobile')
    await (mobile ? phone.register : desktop.register)(page, desktop.uniqueEmail('overview-polish'))
    await (mobile ? phone.createList : desktop.createList)(page, 'Einkaufsliste')
    await (mobile ? phone.createTask : desktop.createTask)(page, 'Zwiebeln')
    await (mobile ? phone.createTask : desktop.createTask)(page, 'Schon erledigt')
    const settings = await desktop.openListSettings(page)
    await settings.getByLabel('Erledigt am Listenende', { exact: true }).check()
    await settings.getByRole('button', { name: 'Schließen', exact: true }).click()
    await page.getByRole('checkbox', { name: 'Aufgabe erledigen: Schon erledigt', exact: true }).click()
    await (mobile ? phone.createList : desktop.createList)(page, 'Hausaufgaben')
    await (mobile ? phone.createTask : desktop.createTask)(page, 'P2 Auffrischungsaufgaben')
    await openOverview(page, mobile)
    const choose = await overviewSettings(page)
    for (const label of ['Einkaufsliste', 'Hausaufgaben']) await choose.getByLabel(label, { exact: true }).check()
    await expect(choose.getByRole('combobox')).toHaveCount(0)
    await choose.getByRole('button', { name: 'Schließen', exact: true }).click()
    await expect(page.getByRole('region', { name: 'Erledigt', exact: true })).toBeVisible()
    if (!mobile) await page.getByTestId('overview-task').filter({ hasText: 'Zwiebeln' }).getByTestId('task-row').hover()
    await page.screenshot({ path: info.outputPath('overview.png') })
    if (mobile) {
      await page.setViewportSize({ width: 740, height: 360 })
      await page.screenshot({ path: info.outputPath('overview-landscape.png') })
      await page.setViewportSize({ width: 390, height: 844 })
      await phone.openMenu(page)
      await expect(page.getByRole('region', { name: 'Erinnerungen', exact: true })).toBeVisible()
      await page.screenshot({ path: info.outputPath('menu.png') })
    }
  })
})

test('ein bestehendes Konto wählt einmalig einen Namen und bleibt danach auch offline angemeldet', async ({ page, request }) => {
  const email = desktop.uniqueEmail('legacy-name')
  const response = await request.post(`${desktop.MOCK_URL}/auth/v1/signup`, { data: { email, password: desktop.PASSWORD } })
  expect(response.ok()).toBe(true)
  await page.goto('/')
  await page.getByLabel('E-Mail', { exact: true }).fill(email)
  await page.getByLabel('Passwort', { exact: true }).fill(desktop.PASSWORD)
  await page.getByRole('button', { name: 'Anmelden', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Wähle deinen Benutzernamen', exact: true })).toBeVisible()
  await page.getByLabel('Benutzername', { exact: true }).fill('mein_benutzername')
  await page.getByRole('button', { name: 'Benutzernamen speichern', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Gesamtansicht', exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Gesamtansicht', exact: true })).toBeVisible()
  await page.context().setOffline(true)
  await desktop.createList(page, 'Offline nach der Namenswahl')
  await desktop.createTask(page, 'Lokal weiterarbeiten')
  await expect(desktop.taskItem(page, 'Lokal weiterarbeiten')).toBeVisible()
})

test('eine ältere Sitzung übernimmt einen bereits auf einem anderen Gerät gesetzten Namen', async ({ page }) => {
  await desktop.register(page, desktop.uniqueEmail('cached-name'))
  await page.evaluate(() => {
    const cached = JSON.parse(localStorage.getItem('prio.auth')!)
    delete cached.user.user_metadata.username
    localStorage.setItem('prio.auth', JSON.stringify(cached))
  })
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Gesamtansicht', exact: true })).toBeVisible()
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('prio.auth')!).user.user_metadata.username)).toBeTruthy()
})
