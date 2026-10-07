import { expect, test, type Page } from '@playwright/test'
import { createAccount, createList, register, resetServer, uniqueEmail } from './support/helpers'

/**
 * Listenverwaltung in der **breiten** Ansicht.
 *
 * Gegenstück zu den Fällen in `mobile.spec.ts`: Jede Aktion muss auf beiden
 * Oberflächen erreichbar sein. Genau das war schon einmal verletzt – die
 * Symbolauswahl gab es nur auf dem Telefon. Diese Tests halten die Regel fest
 * (siehe `AGENTS.md`, Abschnitt „Oberfläche“).
 */
test.beforeEach(async ({ request }) => {
  await resetServer(request)
})

/** Ein Fälligkeitswert für morgen – wie ihn `datetime-local` erwartet. */
function morgenUm(stunde: number): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  const zweistellig = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${zweistellig(d.getMonth() + 1)}-${zweistellig(d.getDate())}T${zweistellig(stunde)}:00`
}

/** Das Symbol am Listentitel – nicht die Symbole in der Auswahl. */
function titelIcon(page: Page) {
  return page.getByTestId('list-title').locator('..').getByTestId('list-icon')
}

/** Das Symbol der Liste in der Seitenleiste. */
function seitenleistenIcon(page: Page) {
  return page.getByRole('complementary', { name: 'Listen' }).getByTestId('list-icon')
}

test('benennt eine Liste in der breiten Ansicht um', async ({ page }) => {
  await register(page, uniqueEmail('l1'))
  await createList(page, 'Erster Name')

  await page.getByRole('button', { name: 'Umbenennen', exact: true }).click()
  await page.getByLabel('Neuer Listenname').fill('Zweiter Name')
  await page.getByRole('button', { name: 'Speichern', exact: true }).click()

  await expect(page.getByTestId('list-title')).toHaveText('Zweiter Name')
})

test('gibt einer Liste in der breiten Ansicht ein Symbol', async ({ page }) => {
  await register(page, uniqueEmail('l2'))
  await createList(page, 'Haushalt')

  await page.getByRole('button', { name: 'Symbol', exact: true }).click()

  const auswahl = page.getByTestId('icon-picker')
  await expect(auswahl).toBeVisible()
  await auswahl.getByRole('button', { name: 'Sport' }).click()

  // Am Listentitel und in der Seitenleiste. Bewusst eng gefasst: Die Auswahl
  // selbst besteht aus lauter Symbolen.
  await expect(titelIcon(page)).toHaveAttribute('data-icon', 'std:sport')
  await expect(seitenleistenIcon(page)).toHaveAttribute('data-icon', 'std:sport')
})

test('entfernt das Symbol einer Liste in der breiten Ansicht', async ({ page }) => {
  await register(page, uniqueEmail('l3'))
  await createList(page, 'Haushalt')

  await page.getByRole('button', { name: 'Symbol', exact: true }).click()
  await page.getByTestId('icon-picker').getByRole('button', { name: 'Musik' }).click()
  await expect(titelIcon(page)).toHaveAttribute('data-icon', 'std:music')

  await page.getByRole('button', { name: 'Symbol entfernen' }).click()
  await expect(titelIcon(page)).toHaveCount(0)
  await expect(seitenleistenIcon(page)).toHaveCount(0)
})

test('löscht eine Liste in der breiten Ansicht', async ({ page }) => {
  await register(page, uniqueEmail('l4'))
  await createList(page, 'Wegwerfliste')

  await page.getByRole('button', { name: 'Liste löschen', exact: true }).click()
  await page.getByRole('button', { name: 'Wirklich löschen', exact: true }).click()

  await expect(page.getByText('Lege links eine Liste an, um Aufgaben zu erfassen.')).toBeVisible()
})

test('teilt eine Liste in der breiten Ansicht', async ({ page }) => {
  await register(page, uniqueEmail('l5'))
  await createList(page, 'Geteilte Liste')

  await page.getByRole('button', { name: 'Teilen', exact: true }).click()

  await expect(page.getByRole('form', { name: 'Liste teilen' })).toBeVisible()
  await expect(page.getByText('Noch keine Mitglieder.')).toBeVisible()
})

test('macht eine Aufgabe in der breiten Ansicht wiederkehrend', async ({ page }) => {
  await register(page, uniqueEmail('l6'))
  await createList(page, 'Routinen')

  await page.getByLabel('Neue Aufgabe', { exact: true }).fill('Zähne putzen')
  await page.getByRole('button', { name: 'Hinzufügen', exact: true }).click()

  const morgen = new Date()
  morgen.setDate(morgen.getDate() + 1)
  const zweistellig = (n: number) => String(n).padStart(2, '0')
  const eingabe = `${morgen.getFullYear()}-${zweistellig(morgen.getMonth() + 1)}-${zweistellig(morgen.getDate())}T09:00`

  const zeile = page.getByTestId('task-list').locator('li').filter({ hasText: 'Zähne putzen' })
  await zeile.getByRole('button', { name: 'Bearbeiten' }).click()

  const formular = page.getByRole('form', { name: /Aufgabe bearbeiten/ })
  await formular.getByLabel('Fällig am (optional)', { exact: true }).fill(eingabe)
  await formular.getByLabel('Wiederholung', { exact: true }).selectOption('daily')
  await formular.getByRole('button', { name: 'Speichern' }).click()

  await expect(zeile).toContainText('Täglich')

  // Abhaken: Die Aufgabe bleibt mit dem nächsten Termin stehen.
  const vorher = await zeile.innerText()
  await zeile.getByRole('checkbox').click()
  await expect(zeile).toBeVisible()
  await expect(zeile).toContainText('Täglich')
  // Wartende Zusicherung: Das Schreiben in die Datenbank ist asynchron.
  await expect(zeile).not.toHaveText(vorher)

  // Auch die fortgeschriebene Aufgabe bleibt sieben Tage auffindbar – eine
  // Regel für alle. Der Nachfolger steht daneben offen in der Liste.
  await page.getByRole('button', { name: 'Wiederherstellen', exact: true }).click()
  const panel = page.getByRole('dialog', { name: 'Aufgaben wiederherstellen' })
  await expect(panel.locator('li').filter({ hasText: 'Zähne putzen' })).toBeVisible()
})

test('holt eine abgehakte Aufgabe in der breiten Ansicht zurück', async ({ page }) => {
  await register(page, uniqueEmail('l7'))
  await createList(page, 'Haushalt')

  await page.getByLabel('Neue Aufgabe', { exact: true }).fill('Müll rausbringen')
  await page.getByRole('button', { name: 'Hinzufügen', exact: true }).click()

  const zeile = page.getByTestId('task-list').locator('li').filter({ hasText: 'Müll rausbringen' })
  await zeile.getByRole('checkbox').click()
  await expect(zeile).toHaveCount(0)

  // Abgehakt heißt: aus der Liste verschwunden, aber sieben Tage auffindbar.
  await page.getByRole('button', { name: 'Wiederherstellen', exact: true }).click()
  const panel = page.getByRole('dialog', { name: 'Aufgaben wiederherstellen' })
  const eintrag = panel.locator('li').filter({ hasText: 'Müll rausbringen' })
  await expect(eintrag).toBeVisible()
  await expect(eintrag).toContainText('Haushalt')

  await eintrag.getByRole('button', { name: 'Wiederherstellen' }).click()

  // Zurück in der Liste – und nicht mehr im Fenster.
  await expect(page.getByTestId('task-list').locator('li').filter({ hasText: 'Müll rausbringen' })).toBeVisible()
  await expect(panel.locator('li').filter({ hasText: 'Müll rausbringen' })).toHaveCount(0)
})

test('setzt in der breiten Ansicht einen eigenen Vorlauf für eine wiederkehrende Aufgabe', async ({ page }) => {
  await register(page, uniqueEmail('l8'))
  await createList(page, 'Routinen')

  await page.getByLabel('Neue Aufgabe', { exact: true }).fill('Zähne putzen')
  await page.getByRole('button', { name: 'Hinzufügen', exact: true }).click()

  const zeile = page.getByTestId('task-list').locator('li').filter({ hasText: 'Zähne putzen' })
  await zeile.getByRole('button', { name: 'Bearbeiten' }).click()

  const formular = page.getByRole('form', { name: /Aufgabe bearbeiten/ })
  await formular.getByLabel('Fällig am (optional)', { exact: true }).fill(morgenUm(9))
  await expect(formular.getByText('Keine. Eine Fälligkeit erinnert nicht von selbst.')).toBeVisible()

  await formular.getByLabel('Wiederholung', { exact: true }).selectOption('daily')
  await formular.getByRole('button', { name: 'Weitere Erinnerung' }).click()

  // Die Form folgt der Wiederholung: relativer Vorlauf statt Zeitpunkt.
  const erinnerung = formular.getByLabel('Erinnerung', { exact: true })
  await expect(erinnerung).toHaveValue('0')
  await erinnerung.selectOption('custom')
  await formular.getByLabel('Stunden vorher oder nachher', { exact: true }).fill('4')

  await expect(formular.getByText(/4 Std vorher/)).toBeVisible()
  await formular.getByRole('button', { name: 'Speichern' }).click()

  await expect(zeile).toContainText('Erinnert:')
})

test('legt in der breiten Ansicht mehrere Erinnerungen an', async ({ page }) => {
  await register(page, uniqueEmail('l11'))
  await createList(page, 'Routinen')

  await page.getByLabel('Neue Aufgabe', { exact: true }).fill('Medikament')
  await page.getByRole('button', { name: 'Hinzufügen', exact: true }).click()

  const zeile = page.getByTestId('task-list').locator('li').filter({ hasText: 'Medikament' })
  await zeile.getByRole('button', { name: 'Bearbeiten' }).click()

  const formular = page.getByRole('form', { name: /Aufgabe bearbeiten/ })
  await formular.getByLabel('Fällig am (optional)', { exact: true }).fill(morgenUm(9))
  await formular.getByLabel('Wiederholung', { exact: true }).selectOption('daily')

  await formular.getByRole('button', { name: 'Weitere Erinnerung' }).click()
  await formular.getByLabel('Erinnerung', { exact: true }).selectOption('1440')
  await formular.getByRole('button', { name: 'Weitere Erinnerung' }).click()
  await formular.getByLabel('Erinnerung', { exact: true }).nth(1).selectOption('60')

  await expect(formular.getByText('2 Termine')).toBeVisible()
  await formular.getByRole('button', { name: 'Speichern' }).click()

  await expect(zeile.getByText('Erinnert:')).toHaveCount(2)
})

test('erlaubt in der breiten Ansicht eine Erinnerung ohne Fälligkeitsdatum', async ({ page }) => {
  await register(page, uniqueEmail('l10'))
  await createList(page, 'Alltag')

  await page.getByLabel('Neue Aufgabe', { exact: true }).fill('Jonna anrufen')
  await page.getByRole('button', { name: 'Hinzufügen', exact: true }).click()

  const zeile = page.getByTestId('task-list').locator('li').filter({ hasText: 'Jonna anrufen' })
  await zeile.getByRole('button', { name: 'Bearbeiten' }).click()

  const formular = page.getByRole('form', { name: /Aufgabe bearbeiten/ })
  await formular.getByRole('button', { name: 'Weitere Erinnerung' }).click()
  await expect(formular.getByLabel('Erinnerung am', { exact: true })).toBeVisible()

  await formular.getByLabel('Erinnerung am', { exact: true }).fill(morgenUm(17))
  await formular.getByRole('button', { name: 'Speichern' }).click()

  await expect(zeile).toContainText('Erinnert:')
  await expect(zeile).not.toContainText('Fällig:')
})

test('schaltet eine Erinnerung in der breiten Ansicht nur für sich stumm', async ({ page, request }) => {
  const emailB = uniqueEmail('l12-b')
  await createAccount(request, emailB)

  await register(page, uniqueEmail('l12'))
  await createList(page, 'Haushalt')

  await page.getByLabel('Neue Aufgabe', { exact: true }).fill('Müll rausbringen')
  await page.getByRole('button', { name: 'Hinzufügen', exact: true }).click()

  const zeile = page.getByTestId('task-list').locator('li').filter({ hasText: 'Müll rausbringen' })
  await zeile.getByRole('button', { name: 'Bearbeiten' }).click()

  const formular = page.getByRole('form', { name: /Aufgabe bearbeiten/ })
  await formular.getByLabel('Fällig am (optional)', { exact: true }).fill(morgenUm(9))
  await formular.getByRole('button', { name: 'Weitere Erinnerung' }).click()
  await formular.getByRole('button', { name: 'Weitere Erinnerung' }).click()

  // Eine eigene Liste kennt kein Stummschalten – es gäbe niemanden, für den es
  // gilt.
  await expect(formular.getByRole('button', { name: /stummschalten/ })).toHaveCount(0)
  await formular.getByRole('button', { name: 'Speichern' }).click()

  // Erst teilen, dann erscheint der Schalter.
  await page.getByRole('button', { name: 'Teilen', exact: true }).click()
  await page.getByLabel('E-Mail-Adresse des Mitglieds', { exact: true }).fill(emailB)
  await page.getByRole('button', { name: 'Freigeben' }).click()
  await expect(page.getByRole('status')).toContainText('Freigabe für')

  await zeile.getByRole('button', { name: 'Bearbeiten' }).click()
  const erneut = page.getByRole('form', { name: /Aufgabe bearbeiten/ })
  await expect(erneut.getByRole('button', { name: /stummschalten/ })).toHaveCount(2)

  await erneut.getByRole('button', { name: 'Erinnerung 1 für mich stummschalten' }).click()
  await expect(
    erneut.getByRole('button', { name: 'Erinnerung 1 wieder für mich einschalten' }),
  ).toBeVisible()
  await erneut.getByRole('button', { name: 'Speichern' }).click()

  // In der Liste steht es dran – sonst wüsste man nicht, warum man nicht
  // geweckt wird.
  await expect(zeile.getByText('für mich stumm')).toHaveCount(1)
  await expect(zeile.getByText('Erinnert:')).toHaveCount(2)
})

/**
 * Der Ansichtszustand überlebt den Wechsel der Fensterbreite.
 *
 * Anlass: Die gewählte Liste lag in **beiden** Ansichten – jede hielt ihre
 * eigene Kopie. Beim Überschreiten der Grenze tauscht React den Baum aus, die
 * Kopie war neu initialisiert, und die Anzeige fiel auf die erste Liste zurück.
 * Deshalb liegt der Zustand jetzt über der Verzweigung (`ViewProvider`).
 *
 * Geprüft wird mit der **zweiten** Liste: Ein Rückfall auf die erste fiele
 * damit auf.
 */
test('behält die gewählte Liste beim Wechsel der Fensterbreite', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await register(page, uniqueEmail('l-ansicht'))
  await createList(page, 'Erste')
  await createList(page, 'Zweite')

  // Bewusst die **zweite** Liste wählen: Ein Rückfall nach dem Umbau landete
  // auf der ersten, und der Test fiele auf.
  await page
    .getByRole('complementary', { name: 'Listen' })
    .getByRole('button', { name: 'Zweite', exact: true })
    .click()
  await expect(page.getByTestId('list-title')).toHaveText('Zweite')

  // Schmal: die mobile Ansicht übernimmt.
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.getByTestId('app-bar-title')).toHaveText('Zweite')

  // Und zurück.
  await page.setViewportSize({ width: 1280, height: 800 })
  await expect(page.getByTestId('list-title')).toHaveText('Zweite')
})
