import { expect, test, type Page } from '@playwright/test'
import { createAccount, resetServer, uniqueEmail } from './support/helpers'
import { createList, createTask, openMenu, register, taskRow, taskZeile } from './support/mobile'

/**
 * E2E-Tests der mobilen Oberfläche.
 *
 * Das Telefonformat (390 × 844) ist entscheidend: Ab 768 px Breite zeigt die
 * App die Desktop-Ansicht mit Seitenleiste. Diese Tests prüfen also genau den
 * Weg, den man auf dem Handy geht – Menü statt Seitenleiste, Antippen statt
 * Knöpfe, Langdruck zum Verschieben.
 *
 * Die Bedienhelfer stehen in `support/mobile.ts`; `parity.spec.ts` benutzt
 * dieselben, um jede Funktion auf beiden Oberflächen zu prüfen.
 */
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true })

test.beforeEach(async ({ request }) => {
  await resetServer(request)
})

/** Titel aller Aufgaben in der angezeigten Reihenfolge. */
async function taskTitles(page: Page): Promise<string[]> {
  return page.getByTestId('task-row').allInnerTexts()
}

/** Hält eine Zeile gedrückt und zieht sie ein Stück nach unten. */
async function dragRowDown(page: Page, title: string, distancePx: number): Promise<void> {
  const box = await taskRow(page, title).boundingBox()
  if (!box) throw new Error(`Zeile "${title}" nicht gefunden`)

  const x = box.x + box.width / 2
  const y = box.y + box.height / 2

  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.waitForTimeout(600) // Langdruck – ab hier ist die Zeile aufgenommen
  await page.mouse.move(x, y + distancePx, { steps: 10 })
  await page.waitForTimeout(100)
  await page.mouse.up()
  await page.waitForTimeout(300)
}

test('legt über das Menü eine Liste und über den Plus-Knopf eine Aufgabe an', async ({ page }) => {
  await register(page, uniqueEmail('m1'))

  // Ohne Liste weist die App den Weg über das Menü.
  await expect(page.getByText('Öffne oben links das Menü')).toBeVisible()

  await createList(page, 'Haushalt')
  await expect(page.getByText('Noch keine Aufgaben in dieser Liste.')).toBeVisible()

  await createTask(page, 'Milch kaufen', 'Samstagmorgen')
  await expect(taskRow(page, 'Milch kaufen')).toBeVisible()
  await expect(taskZeile(page, 'Milch kaufen')).toContainText('Samstagmorgen')
  await expect(page.getByText('1 offene Aufgabe')).toBeVisible()

  // Die Liste selbst zeigt keine Bearbeiten-/Löschen-Knöpfe.
  await expect(page.getByRole('button', { name: 'Bearbeiten' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Löschen' })).toHaveCount(0)
})

test('hakt eine Aufgabe ab, die dadurch aus der Liste verschwindet', async ({ page }) => {
  await register(page, uniqueEmail('m2'))
  await createList(page, 'Haushalt')
  await createTask(page, 'Wohnung saugen')

  await page.getByLabel('Aufgabe erledigen: Wohnung saugen').click()

  // Die Aufgabe verschwindet sofort aus der Liste …
  await expect(page.getByText('Noch keine Aufgaben in dieser Liste.')).toBeVisible()

  // … und die Leiste bietet den Rückweg an.
  const leiste = page.getByTestId('undo-bar')
  await expect(leiste).toBeVisible()
  await expect(leiste).toContainText('Wohnung saugen')

  await leiste.getByRole('button', { name: 'Rückgängig' }).click()
  await expect(taskRow(page, 'Wohnung saugen')).toBeVisible()
  await expect(page.getByText('1 offene Aufgabe')).toBeVisible()
})

test('stellt eine abgehakte Aufgabe über die Einstellungen wieder her', async ({ page }) => {
  await register(page, uniqueEmail('m9'))
  await createList(page, 'Haushalt')
  await createTask(page, 'Zurückholen')

  await page.getByLabel('Aufgabe erledigen: Zurückholen').click()
  await expect(page.getByText('Noch keine Aufgaben in dieser Liste.')).toBeVisible()

  await openMenu(page)
  await page.getByRole('button', { name: 'Aufgaben wiederherstellen' }).click()

  const panel = page.getByRole('dialog', { name: 'Aufgaben wiederherstellen' })
  await expect(panel).toBeVisible()
  await expect(page.getByTestId('restore-list')).toContainText('Zurückholen')
  await expect(page.getByTestId('restore-list')).toContainText('Haushalt')

  await panel.getByRole('button', { name: 'Wiederherstellen' }).click()
  await expect(page.getByTestId('restore-empty')).toBeVisible()

  await panel.getByRole('button', { name: 'Schließen' }).click()
  await expect(taskRow(page, 'Zurückholen')).toBeVisible()
})

test('öffnet per Antippen die Detailansicht und ändert den Titel', async ({ page }) => {
  await register(page, uniqueEmail('m3'))
  await createList(page, 'Haushalt')
  await createTask(page, 'Alter Titel')

  await taskRow(page, 'Alter Titel').click()
  await expect(page.getByRole('dialog', { name: 'Aufgabe' })).toBeVisible()

  await page.getByLabel('Titel', { exact: true }).fill('Neuer Titel')
  await page.getByLabel('Beschreibung (optional)', { exact: true }).fill('Mit Notiz')
  await page.getByRole('button', { name: 'Speichern', exact: true }).click()

  await expect(page.getByRole('dialog', { name: 'Aufgabe' })).toBeHidden()
  await expect(taskRow(page, 'Neuer Titel')).toBeVisible()
  await expect(taskZeile(page, 'Neuer Titel')).toContainText('Mit Notiz')
})

test('löscht eine Aufgabe in der Detailansicht', async ({ page }) => {
  await register(page, uniqueEmail('m4'))
  await createList(page, 'Haushalt')
  await createTask(page, 'Wird gelöscht')

  await taskRow(page, 'Wird gelöscht').click()
  await page.getByRole('button', { name: 'Aufgabe löschen' }).click()
  await page.getByRole('button', { name: 'Wirklich löschen' }).click()

  await expect(page.getByText('Noch keine Aufgaben in dieser Liste.')).toBeVisible()
})

test('verschiebt eine Aufgabe über die Detailansicht in eine andere Liste', async ({ page }) => {
  await register(page, uniqueEmail('m5'))
  await createList(page, 'Haushalt')
  await createTask(page, 'Wandert weiter')
  await createList(page, 'Arbeit')

  // Das Anlegen einer Liste wechselt dorthin – für den Test zurück.
  await openMenu(page)
  await page.getByRole('button', { name: 'Haushalt', exact: true }).click()
  await expect(page.getByTestId('app-bar-title')).toHaveText('Haushalt')

  // In der Liste gibt es dafür keine Geste und keinen Knopf – nur die Zeile.
  await expect(page.getByRole('button', { name: 'In andere Liste verschieben' })).toHaveCount(0)

  await taskRow(page, 'Wandert weiter').click()
  await expect(page.getByRole('dialog', { name: 'Aufgabe' })).toBeVisible()
  await page.getByRole('button', { name: 'In andere Liste verschieben' }).click()

  const sheet = page.getByRole('dialog', { name: 'Aufgabe verschieben' })
  await expect(sheet).toBeVisible()
  // Die eigene Liste wird nicht angeboten.
  await expect(sheet.getByRole('button', { name: 'Haushalt' })).toHaveCount(0)
  await sheet.getByRole('button', { name: 'Arbeit' }).click()
  await expect(sheet).toBeHidden()

  // Die Detailansicht bleibt offen; schließen zeigt die leere Quellliste.
  await page.getByRole('button', { name: 'Schließen' }).click()
  await expect(page.getByText('Noch keine Aufgaben in dieser Liste.')).toBeVisible()

  // Im Menü auf die andere Liste wechseln – dort liegt sie jetzt.
  await openMenu(page)
  await page.getByRole('button', { name: 'Arbeit', exact: true }).click()
  await expect(page.getByTestId('app-bar-title')).toHaveText('Arbeit')
  await expect(taskRow(page, 'Wandert weiter')).toBeVisible()
})

test('schließt das Menü mit Escape', async ({ page }) => {
  await register(page, uniqueEmail('m6'))
  await createList(page, 'Haushalt')

  await openMenu(page)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: 'Menü' })).toBeHidden()
})

test('sortiert eine Aufgabe per Langdruck und Ziehen um', async ({ page }) => {
  await register(page, uniqueEmail('m7'))
  await createList(page, 'Reihenfolge')
  await createTask(page, 'Erste')
  await createTask(page, 'Zweite')
  await createTask(page, 'Dritte')

  // Neue Aufgaben landen oben: die zuletzt angelegte steht zuoberst.
  expect(await taskTitles(page)).toEqual(['Dritte', 'Zweite', 'Erste'])

  // Die oberste Zeile aufnehmen und unter die letzte ziehen.
  await dragRowDown(page, 'Dritte', 150)

  expect(await taskTitles(page)).toEqual(['Zweite', 'Erste', 'Dritte'])

  // Die Reihenfolge ist gespeichert, nicht nur Anzeige.
  await page.reload()
  await expect(page.getByTestId('app-bar-title')).toHaveText('Reihenfolge')
  expect(await taskTitles(page)).toEqual(['Zweite', 'Erste', 'Dritte'])
})

test('sortiert bei kurzem Wischen nicht um', async ({ page }) => {
  await register(page, uniqueEmail('m8'))
  await createList(page, 'Reihenfolge')
  await createTask(page, 'Erste')
  await createTask(page, 'Zweite')

  // Zuletzt angelegt steht oben.
  expect(await taskTitles(page)).toEqual(['Zweite', 'Erste'])

  // Zu kurz für den Langdruck – das ist ein Scrollversuch.
  const box = await taskRow(page, 'Zweite').boundingBox()
  if (box) {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 120, { steps: 8 })
    await page.mouse.up()
    await page.waitForTimeout(200)
  }

  expect(await taskTitles(page)).toEqual(['Zweite', 'Erste'])
})

test('benennt eine Liste über die App-Leiste um', async ({ page }) => {
  await register(page, uniqueEmail('m10'))
  await createList(page, 'Erster Name')

  await page.getByTestId('app-bar-title').click()
  await expect(page.getByRole('dialog', { name: 'Liste verwalten' })).toBeVisible()
  await page.getByRole('button', { name: 'Umbenennen' }).click()

  await page.getByLabel('Neuer Name').fill('Zweiter Name')
  await page.getByRole('button', { name: 'Speichern', exact: true }).click()

  await expect(page.getByRole('dialog', { name: 'Liste verwalten' })).toBeHidden()
  await expect(page.getByTestId('app-bar-title')).toHaveText('Zweiter Name')
})

test('löscht eine Liste über die App-Leiste', async ({ page }) => {
  await register(page, uniqueEmail('m11'))
  await createList(page, 'Wegwerfliste')

  await page.getByTestId('app-bar-title').click()
  await page.getByRole('button', { name: 'Liste löschen' }).click()
  // Erst nach der Rückfrage wird wirklich gelöscht.
  await page.getByRole('button', { name: 'Wirklich löschen' }).click()

  await expect(page.getByRole('dialog', { name: 'Liste verwalten' })).toBeHidden()
  await expect(page.getByText('Öffne oben links das Menü und lege eine Liste an.')).toBeVisible()
})

test('gibt einer Liste ein Symbol und zeigt es an', async ({ page }) => {
  await register(page, uniqueEmail('m12'))
  await createList(page, 'Haushalt')

  await page.getByTestId('app-bar-title').click()
  await page.getByRole('button', { name: 'Symbol ändern' }).click()

  const auswahl = page.getByTestId('icon-picker')
  await expect(auswahl).toBeVisible()
  await auswahl.getByRole('button', { name: 'Haushalt' }).click()

  // Die Ansicht schließt sich und das Symbol steht in der Leiste. Bewusst eng
  // gefasst: Die Auswahl selbst besteht aus lauter Symbolen.
  await expect(page.getByRole('dialog', { name: 'Liste verwalten' })).toBeHidden()
  await expect(page.getByTestId('app-bar-title').getByTestId('list-icon')).toHaveAttribute(
    'data-icon',
    'std:home',
  )

  // … und ebenso im Menü neben dem Listennamen.
  await openMenu(page)
  await expect(
    page.getByRole('dialog', { name: 'Menü' }).getByTestId('list-icon'),
  ).toHaveAttribute('data-icon', 'std:home')
})

test('entfernt das Symbol einer Liste wieder', async ({ page }) => {
  await register(page, uniqueEmail('m13'))
  await createList(page, 'Haushalt')

  await page.getByTestId('app-bar-title').click()
  await page.getByRole('button', { name: 'Symbol ändern' }).click()
  await page.getByTestId('icon-picker').getByRole('button', { name: 'Sport' }).click()
  await expect(page.getByRole('dialog', { name: 'Liste verwalten' })).toBeHidden()
  await expect(page.getByTestId('app-bar-title').getByTestId('list-icon')).toHaveAttribute(
    'data-icon',
    'std:sport',
  )

  await page.getByTestId('app-bar-title').click()
  await page.getByRole('button', { name: 'Symbol ändern' }).click()
  await page.getByRole('button', { name: 'Symbol entfernen' }).click()
  await expect(page.getByRole('dialog', { name: 'Liste verwalten' })).toBeHidden()

  await expect(page.getByTestId('app-bar-title').getByTestId('list-icon')).toHaveCount(0)
})

/** Ein datetime-local-Wert für einen Tag in der Zukunft. */
function inTagen(tage: number): string {
  const d = new Date()
  d.setDate(d.getDate() + tage)
  const zweistellig = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${zweistellig(d.getMonth() + 1)}-${zweistellig(d.getDate())}T09:00`
}

test('legt beim Abhaken einer wiederkehrenden Aufgabe den nächsten Termin an', async ({ page }) => {
  await register(page, uniqueEmail('m14'))
  await createList(page, 'Routinen')

  await page.getByRole('button', { name: 'Neue Aufgabe' }).click()
  await page.getByLabel('Titel', { exact: true }).fill('Zähne putzen')
  await page.getByLabel('Fällig am (optional)', { exact: true }).fill(inTagen(1))
  await page.getByLabel('Wiederholung', { exact: true }).selectOption('daily')
  await page.getByRole('button', { name: 'Speichern', exact: true }).click()

  await expect(taskRow(page, 'Zähne putzen')).toContainText('Täglich')
  const vorher = await taskRow(page, 'Zähne putzen').innerText()

  await page.getByLabel('Aufgabe erledigen: Zähne putzen').click()

  // Die Aufgabe verschwindet nicht, sondern steht mit dem nächsten Termin da.
  const nachher = taskRow(page, 'Zähne putzen')
  await expect(nachher).toBeVisible()
  await expect(nachher).toContainText('Täglich')
  // Wartende Zusicherung: Das Schreiben in die Datenbank ist asynchron, ein
  // sofortiges Auslesen käme noch vor der Aktualisierung.
  await expect(nachher).not.toHaveText(vorher)

  // Auch die abgehakte Fassung bleibt sieben Tage auffindbar – eine Regel für
  // alle. Der Nachfolger steht daneben offen in der Liste.
  await page.getByRole('button', { name: 'Menü öffnen' }).click()
  await page.getByRole('button', { name: 'Aufgaben wiederherstellen' }).click()
  const panel = page.getByRole('dialog', { name: 'Aufgaben wiederherstellen' })
  await expect(panel.locator('li').filter({ hasText: 'Zähne putzen' })).toBeVisible()
})

test('nimmt den Nachfolger beim Rückgängigmachen zurück', async ({ page }) => {
  await register(page, uniqueEmail('m15'))
  await createList(page, 'Routinen')

  await page.getByRole('button', { name: 'Neue Aufgabe' }).click()
  await page.getByLabel('Titel', { exact: true }).fill('Zähne putzen')
  await page.getByLabel('Fällig am (optional)', { exact: true }).fill(inTagen(1))
  await page.getByLabel('Wiederholung', { exact: true }).selectOption('daily')
  await page.getByRole('button', { name: 'Speichern', exact: true }).click()

  await page.getByLabel('Aufgabe erledigen: Zähne putzen').click()
  await page.getByTestId('undo-bar').getByRole('button', { name: 'Rückgängig' }).click()

  // Nur eine Zeile – die Aufgabe steht nicht doppelt da.
  await expect(page.getByTestId('task-row')).toHaveCount(1)
  await expect(page.getByText('1 offene Aufgabe')).toBeVisible()
})

test('erlaubt eine Wiederholung erst mit Fälligkeitsdatum', async ({ page }) => {
  await register(page, uniqueEmail('m16'))
  await createList(page, 'Routinen')

  await page.getByRole('button', { name: 'Neue Aufgabe' }).click()
  await expect(page.getByLabel('Wiederholung', { exact: true })).toBeDisabled()

  await page.getByLabel('Fällig am (optional)', { exact: true }).fill(inTagen(1))
  await expect(page.getByLabel('Wiederholung', { exact: true })).toBeEnabled()
})

test('setzt auf dem Telefon einen eigenen Vorlauf für eine wiederkehrende Aufgabe', async ({ page }) => {
  await register(page, uniqueEmail('m17'))
  await createList(page, 'Routinen')

  await page.getByRole('button', { name: 'Neue Aufgabe' }).click()
  await page.getByLabel('Titel', { exact: true }).fill('Zähne putzen')
  await page.getByLabel('Fällig am (optional)', { exact: true }).fill(inTagen(1))

  // Eine Fälligkeit setzt keine Erinnerung – sie ist eine eigene Angabe.
  await expect(page.getByText('Keine. Eine Fälligkeit erinnert nicht von selbst.')).toBeVisible()

  await page.getByLabel('Wiederholung', { exact: true }).selectOption('daily')
  await page.getByRole('button', { name: 'Weitere Erinnerung' }).click()

  // Die Form folgt der Wiederholung: relativer Vorlauf, vorbelegt mit
  // „Zur Fälligkeit".
  const erinnerung = page.getByLabel('Erinnerung', { exact: true })
  await expect(erinnerung).toHaveValue('0')
  await erinnerung.selectOption('custom')

  await page.getByLabel('Stunden vorher oder nachher', { exact: true }).fill('1')
  await page.getByLabel('Minuten vorher oder nachher', { exact: true }).fill('30')

  // Die Vorschau rechnet in absolute Zeit um – daran hängt die Verständlichkeit.
  await expect(page.getByText(/1 Std 30 Min vorher/)).toBeVisible()
  await page.getByRole('button', { name: 'Speichern', exact: true }).click()

  await expect(taskRow(page, 'Zähne putzen')).toContainText('Erinnert:')
})

test('legt auf dem Telefon mehrere Erinnerungen an', async ({ page }) => {
  await register(page, uniqueEmail('m20'))
  await createList(page, 'Routinen')

  await page.getByRole('button', { name: 'Neue Aufgabe' }).click()
  await page.getByLabel('Titel', { exact: true }).fill('Medikament')
  await page.getByLabel('Fällig am (optional)', { exact: true }).fill(inTagen(1))
  await page.getByLabel('Wiederholung', { exact: true }).selectOption('daily')

  // Erste Erinnerung: ein Tag vorher.
  await page.getByRole('button', { name: 'Weitere Erinnerung' }).click()
  await page.getByLabel('Erinnerung', { exact: true }).selectOption('1440')

  // Zweite Erinnerung: eine Stunde vorher.
  await page.getByRole('button', { name: 'Weitere Erinnerung' }).click()
  await expect(page.getByLabel('Erinnerung', { exact: true })).toHaveCount(2)
  await page.getByLabel('Erinnerung', { exact: true }).nth(1).selectOption('60')

  await expect(page.getByText('2 Termine')).toBeVisible()
  await page.getByRole('button', { name: 'Speichern', exact: true }).click()

  // Beide stehen als eigene Zeile unter der Aufgabe.
  await expect(taskRow(page, 'Medikament').getByText('Erinnert:')).toHaveCount(2)
})

test('entfernt auf dem Telefon eine von zwei Erinnerungen', async ({ page }) => {
  await register(page, uniqueEmail('m21'))
  await createList(page, 'Routinen')

  await page.getByRole('button', { name: 'Neue Aufgabe' }).click()
  await page.getByLabel('Titel', { exact: true }).fill('Gießen')
  await page.getByLabel('Fällig am (optional)', { exact: true }).fill(inTagen(1))
  await page.getByLabel('Wiederholung', { exact: true }).selectOption('weekly')

  await page.getByRole('button', { name: 'Weitere Erinnerung' }).click()
  await page.getByLabel('Erinnerung', { exact: true }).selectOption('1440')
  await page.getByRole('button', { name: 'Weitere Erinnerung' }).click()
  await page.getByLabel('Erinnerung', { exact: true }).nth(1).selectOption('60')

  await page.getByRole('button', { name: 'Erinnerung 1 entfernen' }).click()
  await expect(page.getByLabel('Erinnerung', { exact: true })).toHaveCount(1)

  await page.getByRole('button', { name: 'Speichern', exact: true }).click()
  await expect(taskRow(page, 'Gießen').getByText('Erinnert:')).toHaveCount(1)
})

test('nimmt einen Vorlauf auf dem Telefon in die Schnellauswahl auf', async ({ page }) => {
  await register(page, uniqueEmail('m18'))
  await createList(page, 'Routinen')

  await page.getByRole('button', { name: 'Neue Aufgabe' }).click()
  await page.getByLabel('Titel', { exact: true }).fill('Gießen')
  await page.getByLabel('Fällig am (optional)', { exact: true }).fill(inTagen(1))
  await page.getByLabel('Wiederholung', { exact: true }).selectOption('weekly')
  await page.getByRole('button', { name: 'Weitere Erinnerung' }).click()
  await page.getByLabel('Erinnerung', { exact: true }).selectOption('custom')
  await page.getByLabel('Stunden vorher oder nachher', { exact: true }).fill('4')

  const stern = page.getByRole('button', { name: 'In die Schnellauswahl aufnehmen' })
  await stern.click()
  await expect(page.getByRole('button', { name: 'Aus der Schnellauswahl entfernen' })).toBeVisible()

  await page.getByRole('button', { name: 'Speichern', exact: true }).click()
  await expect(taskRow(page, 'Gießen')).toBeVisible()

  // Beim nächsten Mal steht der Wert direkt in der Auswahl.
  await taskRow(page, 'Gießen').click()
  await expect(page.getByLabel('Erinnerung', { exact: true })).toContainText('4 Std')
})

test('erlaubt auf dem Telefon eine Erinnerung ohne Fälligkeitsdatum', async ({ page }) => {
  await register(page, uniqueEmail('m19'))
  await createList(page, 'Alltag')

  await page.getByRole('button', { name: 'Neue Aufgabe' }).click()
  await page.getByLabel('Titel', { exact: true }).fill('Jonna anrufen')

  // Ohne Fälligkeit gibt es nichts, worauf sich ein Vorlauf beziehen könnte –
  // die Erinnerung ist dann ein absoluter Zeitpunkt.
  await page.getByRole('button', { name: 'Weitere Erinnerung' }).click()
  await expect(page.getByLabel('Erinnerung am', { exact: true })).toBeVisible()

  await page.getByLabel('Erinnerung am', { exact: true }).fill(inTagen(2))
  await page.getByRole('button', { name: 'Speichern', exact: true }).click()

  const zeile = taskRow(page, 'Jonna anrufen')
  await expect(zeile).toContainText('Erinnert:')
  await expect(zeile).not.toContainText('Fällig:')
})

test('schaltet eine Erinnerung auf dem Telefon nur für sich stumm', async ({ page, request }) => {
  const emailB = uniqueEmail('m22-b')
  await createAccount(request, emailB)

  await register(page, uniqueEmail('m22'))
  await createList(page, 'Haushalt')

  await page.getByRole('button', { name: 'Neue Aufgabe' }).click()
  await page.getByLabel('Titel', { exact: true }).fill('Müll rausbringen')
  await page.getByLabel('Fällig am (optional)', { exact: true }).fill(inTagen(1))
  await page.getByRole('button', { name: 'Weitere Erinnerung' }).click()
  await page.getByRole('button', { name: 'Weitere Erinnerung' }).click()

  await expect(page.getByRole('button', { name: /stummschalten/ })).toHaveCount(0)
  await page.getByRole('button', { name: 'Speichern', exact: true }).click()

  // Teilen über die Listenverwaltung – dort ist es ein eigener Schritt.
  await page.getByRole('button', { name: /Liste .* verwalten/ }).click()
  await page.getByRole('button', { name: 'Teilen', exact: true }).click()
  await page.getByLabel('E-Mail-Adresse des Mitglieds', { exact: true }).fill(emailB)
  await page.getByRole('button', { name: 'Freigeben' }).click()
  await expect(page.getByRole('status')).toContainText('Freigabe für')
  await page.getByRole('button', { name: 'Schließen' }).click()

  await taskRow(page, 'Müll rausbringen').click()
  await expect(page.getByRole('button', { name: /stummschalten/ })).toHaveCount(2)

  await page.getByRole('button', { name: 'Erinnerung 1 für mich stummschalten' }).click()
  await expect(
    page.getByRole('button', { name: 'Erinnerung 1 wieder für mich einschalten' }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Speichern', exact: true }).click()

  await expect(taskRow(page, 'Müll rausbringen').getByText('für mich stumm')).toHaveCount(1)
})

/**
 * E2E 6: Bereiche.
 *
 * Sie ordnen die Aufgaben innerhalb einer Liste, stehen unter „Ohne Bereich"
 * und lassen sich zuklappen. Das Zuordnen per Ziehen setzt voraus, dass im
 * Zielbereich schon eine Aufgabe steht – sonst gäbe es keine Nachbarzeile, an
 * der sich der Bereich erkennen ließe; die erste kommt über das Formular hinein.
 */
test('E2E 6: Bereiche ordnen Aufgaben, nehmen sie beim Ziehen auf und klappen zu', async ({
  page,
  request,
}) => {
  await resetServer(request)
  await register(page, uniqueEmail('m-bereiche'))
  await createList(page, 'Einkauf')

  await page.getByTestId('app-bar-title').click()
  await page.getByRole('button', { name: 'Bereiche' }).click()
  for (const name of ['Obst', 'Getränke']) {
    await page.getByLabel('Neuer Bereich').fill(name)
    await page.getByRole('button', { name: 'Bereich anlegen' }).click()
  }
  await page.getByRole('button', { name: 'Zurück' }).click()
  await page.getByRole('button', { name: 'Schließen' }).click()

  await createTask(page, 'Äpfel')
  await createTask(page, 'Saft')
  await createTask(page, 'Milch')

  // Die erste Aufgabe kommt über das Formular in ihren Bereich.
  await taskRow(page, 'Äpfel').click()
  await page.getByLabel('Bereich').selectOption({ label: 'Obst' })
  await page.getByRole('button', { name: 'Speichern', exact: true }).click()

  const kopf = (name: string) => page.getByTestId('section-header').filter({ hasText: name })
  await expect(kopf('Obst')).toContainText('1')

  // Aufgaben ohne Bereich stehen oben, **ohne** eigene Überschrift; darunter
  // die Bereiche in ihrer Reihenfolge. Der Kopf wird groß dargestellt –
  // verglichen wird deshalb kleingeschrieben.
  const koepfe = (await page.getByTestId('section-header').allInnerTexts()).map((text) =>
    text.toLowerCase(),
  )
  expect(koepfe).toHaveLength(2)
  expect(koepfe[0]).toContain('obst')
  expect(koepfe[1]).toContain('getränke')

  // Die Bereiche stehen **unter** den Aufgaben ohne Bereich: „Milch" und
  // „Saft" zuerst (zuletzt angelegt), dann „Äpfel" im Bereich „Obst".
  expect(await taskTitles(page)).toEqual(['Milch', 'Saft', 'Äpfel'])

  // „Saft" unter „Äpfel" ziehen – damit landet sie im Bereich „Obst".
  await dragRowDown(page, 'Saft', 120)

  await expect(kopf('Obst')).toContainText('2')
  // „Milch" bleibt ohne Bereich und steht deshalb weiter oben.
  expect(await taskTitles(page)).toEqual(['Milch', 'Äpfel', 'Saft'])

  // Zuklappen: Die Aufgaben verschwinden, die Zahl bleibt.
  await kopf('Obst').click()
  await expect(kopf('Obst')).toContainText('2')
  await expect(taskRow(page, 'Äpfel')).toHaveCount(0)
  await expect(taskRow(page, 'Saft')).toHaveCount(0)
  await expect(taskRow(page, 'Milch')).toBeVisible()
})
