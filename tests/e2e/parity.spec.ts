import { expect, test, type APIRequestContext, type Page } from '@playwright/test'
import * as breit from './support/helpers'
import { createAccount, resetServer, uniqueEmail } from './support/helpers'
import * as telefon from './support/mobile'

/**
 * Oberflächenparität: Jede Funktion muss in beiden Ansichten erreichbar sein.
 *
 * Eine Regel ohne Prüfung ist ein Wunsch (siehe `AGENTS.md`, Abschnitt
 * „Oberfläche"). Die Symbolauswahl lag schon einmal nur auf dem Telefon, und
 * kein Test hat es gemerkt – jede Ansicht war für sich grün.
 *
 * Diese Datei dreht deshalb die Richtung um: Geprüft wird nicht die Ansicht,
 * sondern die **Funktion**. `funktionen` ist die Liste der Funktionen; jeder
 * Eintrag hat genau einen Weg für die breite Ansicht und einen für das
 * Telefon, und beide Wege sind Pflichtfelder. Ein neuer Eintrag lässt sich
 * damit nicht einseitig anlegen, und ein Weg, den es in einer Ansicht nicht
 * gibt, scheitert in genau diesem Test – mit dem Namen der Ansicht davor.
 *
 * Neue Funktion: eine Zeile in `funktionen` mit beiden Wegen.
 */
interface Funktion {
  /** Was geprüft wird – erscheint im Testnamen beider Ansichten. */
  name: string
  /** Der Weg in der breiten Ansicht (Seitenleiste, Kopfzeile, Knöpfe). */
  breit: (page: Page, request: APIRequestContext) => Promise<void>
  /** Derselbe Weg auf dem Telefon (Menü, App-Leiste, Antippen). */
  telefon: (page: Page, request: APIRequestContext) => Promise<void>
}

/** Ein `datetime-local`-Wert für einen Tag in der Zukunft. */
function inTagen(tage: number): string {
  const d = new Date()
  d.setDate(d.getDate() + tage)
  const zweistellig = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${zweistellig(d.getMonth() + 1)}-${zweistellig(d.getDate())}T09:00`
}

const funktionen: Funktion[] = [
  {
    name: 'Liste anlegen',
    breit: async (page) => {
      await breit.register(page, uniqueEmail('p-anlegen-b'))
      await breit.createList(page, 'Haushalt')
    },
    telefon: async (page) => {
      await telefon.register(page, uniqueEmail('p-anlegen-t'))
      await telefon.createList(page, 'Haushalt')
    },
  },
  {
    name: 'Liste umbenennen',
    breit: async (page) => {
      await breit.register(page, uniqueEmail('p-umbenennen-b'))
      await breit.createList(page, 'Erster Name')

      await page.getByRole('button', { name: 'Umbenennen', exact: true }).click()
      await page.getByLabel('Neuer Listenname').fill('Zweiter Name')
      await page.getByRole('button', { name: 'Speichern', exact: true }).click()

      await expect(page.getByTestId('list-title')).toHaveText('Zweiter Name')
    },
    telefon: async (page) => {
      await telefon.register(page, uniqueEmail('p-umbenennen-t'))
      await telefon.createList(page, 'Erster Name')

      await page.getByTestId('app-bar-title').click()
      await expect(page.getByRole('dialog', { name: 'Liste verwalten' })).toBeVisible()
      await page.getByRole('button', { name: 'Umbenennen' }).click()
      await page.getByLabel('Neuer Name').fill('Zweiter Name')
      await page.getByRole('button', { name: 'Speichern', exact: true }).click()

      await expect(page.getByTestId('app-bar-title')).toHaveText('Zweiter Name')
    },
  },
  {
    name: 'Liste löschen',
    breit: async (page) => {
      await breit.register(page, uniqueEmail('p-loeschen-b'))
      await breit.createList(page, 'Wegwerfliste')

      // Direkt löschen; die Rückgängig-Leiste ist der Weg zurück.
      await page.getByRole('button', { name: 'Liste löschen', exact: true }).click()
      await expect(page.getByTestId('undo-bar')).toContainText('Liste „Wegwerfliste“')

      await expect(page.getByText('Lege links eine Liste an, um Aufgaben zu erfassen.')).toBeVisible()
    },
    telefon: async (page) => {
      await telefon.register(page, uniqueEmail('p-loeschen-t'))
      await telefon.createList(page, 'Wegwerfliste')

      await page.getByTestId('app-bar-title').click()
      await page.getByRole('button', { name: 'Liste löschen' }).click()
      await page.getByRole('button', { name: 'Löschen', exact: true }).click()
      await expect(page.getByTestId('undo-bar')).toContainText('Liste „Wegwerfliste“')

      await expect(page.getByText('Öffne oben links das Menü und lege eine Liste an.')).toBeVisible()
    },
  },
  {
    name: 'Liste mit Symbol versehen und das Symbol wieder entfernen',
    breit: async (page) => {
      await breit.register(page, uniqueEmail('p-symbol-b'))
      await breit.createList(page, 'Haushalt')

      await page.getByRole('button', { name: 'Symbol', exact: true }).click()
      await page.getByTestId('icon-picker').getByRole('button', { name: 'Haushalt' }).click()

      const symbol = page.getByTestId('list-title').locator('..').getByTestId('list-icon')
      await expect(symbol).toHaveAttribute('data-icon', 'std:home')

      await page.getByRole('button', { name: 'Symbol entfernen' }).click()
      await expect(symbol).toHaveCount(0)
    },
    telefon: async (page) => {
      await telefon.register(page, uniqueEmail('p-symbol-t'))
      await telefon.createList(page, 'Haushalt')

      await page.getByTestId('app-bar-title').click()
      await page.getByRole('button', { name: 'Symbol ändern' }).click()
      await page.getByTestId('icon-picker').getByRole('button', { name: 'Haushalt' }).click()

      const symbol = page.getByTestId('app-bar-title').getByTestId('list-icon')
      await expect(symbol).toHaveAttribute('data-icon', 'std:home')

      await page.getByTestId('app-bar-title').click()
      await page.getByRole('button', { name: 'Symbol ändern' }).click()
      await page.getByRole('button', { name: 'Symbol entfernen' }).click()
      await expect(symbol).toHaveCount(0)
    },
  },
  {
    name: 'Aufgabe anlegen',
    breit: async (page) => {
      await breit.register(page, uniqueEmail('p-aufgabe-b'))
      await breit.createList(page, 'Haushalt')
      await breit.createTask(page, 'Milch kaufen')
    },
    telefon: async (page) => {
      await telefon.register(page, uniqueEmail('p-aufgabe-t'))
      await telefon.createList(page, 'Haushalt')
      await telefon.createTask(page, 'Milch kaufen')
    },
  },
  {
    name: 'Bereich anlegen und eine Aufgabe zuordnen',
    breit: async (page) => {
      await breit.register(page, uniqueEmail('p-bereich-b'))
      await breit.createList(page, 'Einkauf')
      await breit.createTask(page, 'Äpfel')

      await page.getByRole('button', { name: 'Bereiche' }).click()
      await page.getByLabel('Neuer Bereich').fill('Obst')
      await page.getByRole('button', { name: 'Bereich anlegen' }).click()

      // Der Kopf steht sofort da – ein leerer Bereich wäre sonst unsichtbar.
      await expect(bereichsKopf(page, 'Obst')).toBeVisible()

      await breit.taskItem(page, 'Äpfel').getByRole('button', { name: 'Bearbeiten' }).click()
      const formular = page.getByRole('form', { name: /Aufgabe bearbeiten/ })
      await formular.getByLabel('Bereich').selectOption({ label: 'Obst' })
      await formular.getByRole('button', { name: 'Speichern' }).click()

      await expect(bereichsKopf(page, 'Obst')).toBeVisible()
      await expect(breit.taskItem(page, 'Äpfel')).toBeVisible()
    },
    telefon: async (page) => {
      await telefon.register(page, uniqueEmail('p-bereich-t'))
      await telefon.createList(page, 'Einkauf')
      await telefon.createTask(page, 'Äpfel')

      // Bereiche stehen in den Listeneinstellungen – ein Tippen auf den
      // Listennamen öffnet sie.
      await page.getByTestId('app-bar-title').click()
      await page.getByRole('button', { name: 'Bereiche' }).click()
      await page.getByLabel('Neuer Bereich').fill('Obst')
      await page.getByRole('button', { name: 'Bereich anlegen' }).click()
      await page.getByRole('button', { name: 'Zurück' }).click()
      await page.getByRole('button', { name: 'Schließen' }).click()

      await expect(bereichsKopf(page, 'Obst')).toBeVisible()

      await telefon.taskRow(page, 'Äpfel').click()
      await page.getByLabel('Bereich').selectOption({ label: 'Obst' })
      await page.getByRole('button', { name: 'Speichern', exact: true }).click()

      await expect(bereichsKopf(page, 'Obst')).toBeVisible()
      await expect(telefon.taskRow(page, 'Äpfel')).toBeVisible()
    },
  },
  {
    name: 'Aufgabe bearbeiten: Titel und Beschreibung',
    breit: async (page) => {
      await breit.register(page, uniqueEmail('p-bearbeiten-b'))
      await breit.createList(page, 'Haushalt')
      await breit.createTask(page, 'Alter Titel')

      await breit.taskItem(page, 'Alter Titel').getByRole('button', { name: 'Bearbeiten' }).click()
      const formular = page.getByRole('form', { name: /Aufgabe bearbeiten/ })
      await formular.getByLabel('Titel', { exact: true }).fill('Neuer Titel')
      await formular.getByLabel('Beschreibung (optional)', { exact: true }).fill('Mit Notiz')
      await formular.getByRole('button', { name: 'Speichern' }).click()

      const neu = breit.taskItem(page, 'Neuer Titel')
      await expect(neu).toBeVisible()
      await expect(neu).toContainText('Mit Notiz')
    },
    telefon: async (page) => {
      await telefon.register(page, uniqueEmail('p-bearbeiten-t'))
      await telefon.createList(page, 'Haushalt')
      await telefon.createTask(page, 'Alter Titel')

      await telefon.taskRow(page, 'Alter Titel').click()
      await expect(page.getByRole('dialog', { name: 'Aufgabe' })).toBeVisible()
      await page.getByLabel('Titel', { exact: true }).fill('Neuer Titel')
      await page.getByLabel('Beschreibung (optional)', { exact: true }).fill('Mit Notiz')
      await page.getByRole('button', { name: 'Speichern', exact: true }).click()

      const neu = telefon.taskRow(page, 'Neuer Titel')
      await expect(neu).toBeVisible()
      // Die Beschreibung liegt neben dem Knopf „Aufgabe öffnen" – siehe
      // taskZeile in support/mobile.ts.
      await expect(telefon.taskZeile(page, 'Neuer Titel')).toContainText('Mit Notiz')
    },
  },
  {
    name: 'Aufgabe abhaken und rückgängig machen',
    breit: async (page) => {
      await breit.register(page, uniqueEmail('p-abhaken-b'))
      await breit.createList(page, 'Haushalt')
      await breit.createTask(page, 'Wohnung saugen')

      await breit.taskItem(page, 'Wohnung saugen').getByRole('checkbox').click()
      await expect(breit.taskItem(page, 'Wohnung saugen')).toHaveCount(0)

      const leiste = page.getByTestId('undo-bar')
      await expect(leiste).toBeVisible()
      await leiste.getByRole('button', { name: 'Rückgängig' }).click()

      await expect(breit.taskItem(page, 'Wohnung saugen')).toBeVisible()
    },
    telefon: async (page) => {
      await telefon.register(page, uniqueEmail('p-abhaken-t'))
      await telefon.createList(page, 'Haushalt')
      await telefon.createTask(page, 'Wohnung saugen')

      await page.getByLabel('Aufgabe erledigen: Wohnung saugen').click()
      await expect(telefon.taskRow(page, 'Wohnung saugen')).toHaveCount(0)

      const leiste = page.getByTestId('undo-bar')
      await expect(leiste).toBeVisible()
      await leiste.getByRole('button', { name: 'Rückgängig' }).click()

      await expect(telefon.taskRow(page, 'Wohnung saugen')).toBeVisible()
    },
  },
  {
    name: 'Abgehakte Aufgabe wiederherstellen',
    breit: async (page) => {
      await breit.register(page, uniqueEmail('p-wiederherstellen-b'))
      await breit.createList(page, 'Haushalt')
      await breit.createTask(page, 'Zurückholen')

      await breit.taskItem(page, 'Zurückholen').getByRole('checkbox').click()
      await expect(breit.taskItem(page, 'Zurückholen')).toHaveCount(0)

      await page.getByRole('button', { name: 'Wiederherstellen', exact: true }).click()
      const panel = page.getByRole('dialog', { name: 'Aufgaben wiederherstellen' })
      const eintrag = panel.locator('li').filter({ hasText: 'Zurückholen' })
      await expect(eintrag).toContainText('Haushalt')

      await eintrag.getByRole('button', { name: 'Wiederherstellen' }).click()
      await expect(panel.locator('li').filter({ hasText: 'Zurückholen' })).toHaveCount(0)
      await expect(breit.taskItem(page, 'Zurückholen')).toBeVisible()
    },
    telefon: async (page) => {
      await telefon.register(page, uniqueEmail('p-wiederherstellen-t'))
      await telefon.createList(page, 'Haushalt')
      await telefon.createTask(page, 'Zurückholen')

      await page.getByLabel('Aufgabe erledigen: Zurückholen').click()
      await expect(telefon.taskRow(page, 'Zurückholen')).toHaveCount(0)

      await telefon.openMenu(page)
      await page.getByRole('button', { name: 'Aufgaben wiederherstellen' }).click()
      const panel = page.getByRole('dialog', { name: 'Aufgaben wiederherstellen' })
      const eintrag = panel.locator('li').filter({ hasText: 'Zurückholen' })
      await expect(eintrag).toContainText('Haushalt')

      await eintrag.getByRole('button', { name: 'Wiederherstellen' }).click()
      await expect(page.getByTestId('restore-empty')).toBeVisible()
      await panel.getByRole('button', { name: 'Schließen' }).click()
      await expect(telefon.taskRow(page, 'Zurückholen')).toBeVisible()
    },
  },
  {
    name: 'Aufgabe wiederkehrend machen',
    breit: async (page) => {
      await breit.register(page, uniqueEmail('p-wiederholung-b'))
      await breit.createList(page, 'Routinen')
      await breit.createTask(page, 'Zähne putzen')

      await breit.taskItem(page, 'Zähne putzen').getByRole('button', { name: 'Bearbeiten' }).click()
      const formular = page.getByRole('form', { name: /Aufgabe bearbeiten/ })
      await formular.getByLabel('Fällig am (optional)', { exact: true }).fill(inTagen(1))
      await formular.getByLabel('Wiederholung', { exact: true }).selectOption('daily')
      await formular.getByRole('button', { name: 'Speichern' }).click()

      await expect(breit.taskItem(page, 'Zähne putzen')).toContainText('Täglich')
    },
    telefon: async (page) => {
      await telefon.register(page, uniqueEmail('p-wiederholung-t'))
      await telefon.createList(page, 'Routinen')
      await telefon.createTask(page, 'Zähne putzen')

      await telefon.taskRow(page, 'Zähne putzen').click()
      await page.getByLabel('Fällig am (optional)', { exact: true }).fill(inTagen(1))
      await page.getByLabel('Wiederholung', { exact: true }).selectOption('daily')
      await page.getByRole('button', { name: 'Speichern', exact: true }).click()

      await expect(telefon.taskRow(page, 'Zähne putzen')).toContainText('Täglich')
    },
  },
  {
    name: 'Mehrere Erinnerungen anlegen',
    breit: async (page) => {
      await breit.register(page, uniqueEmail('p-erinnerungen-b'))
      await breit.createList(page, 'Routinen')
      await breit.createTask(page, 'Medikament')

      await breit.taskItem(page, 'Medikament').getByRole('button', { name: 'Bearbeiten' }).click()
      const formular = page.getByRole('form', { name: /Aufgabe bearbeiten/ })
      await formular.getByLabel('Fällig am (optional)', { exact: true }).fill(inTagen(1))
      await formular.getByLabel('Wiederholung', { exact: true }).selectOption('daily')
      await formular.getByRole('button', { name: 'Weitere Erinnerung' }).click()
      await formular.getByLabel('Erinnerung', { exact: true }).selectOption('1440')
      await formular.getByRole('button', { name: 'Weitere Erinnerung' }).click()
      await formular.getByLabel('Erinnerung', { exact: true }).nth(1).selectOption('60')
      await formular.getByRole('button', { name: 'Speichern' }).click()

      await expect(breit.taskItem(page, 'Medikament').getByText('Erinnert:')).toHaveCount(2)
    },
    telefon: async (page) => {
      await telefon.register(page, uniqueEmail('p-erinnerungen-t'))
      await telefon.createList(page, 'Routinen')
      await telefon.createTask(page, 'Medikament')

      await telefon.taskRow(page, 'Medikament').click()
      await page.getByLabel('Fällig am (optional)', { exact: true }).fill(inTagen(1))
      await page.getByLabel('Wiederholung', { exact: true }).selectOption('daily')
      await page.getByRole('button', { name: 'Weitere Erinnerung' }).click()
      await page.getByLabel('Erinnerung', { exact: true }).selectOption('1440')
      await page.getByRole('button', { name: 'Weitere Erinnerung' }).click()
      await page.getByLabel('Erinnerung', { exact: true }).nth(1).selectOption('60')
      await page.getByRole('button', { name: 'Speichern', exact: true }).click()

      await expect(telefon.taskRow(page, 'Medikament').getByText('Erinnert:')).toHaveCount(2)
    },
  },
  {
    name: 'Erinnerung in einer geteilten Liste für sich stummschalten',
    breit: async (page, request) => {
      const mitglied = uniqueEmail('p-stumm-b-mitglied')
      await createAccount(request, mitglied)

      await breit.register(page, uniqueEmail('p-stumm-b'))
      await breit.createList(page, 'Haushalt')
      await breit.createTask(page, 'Müll rausbringen')

      const zeile = breit.taskItem(page, 'Müll rausbringen')
      await zeile.getByRole('button', { name: 'Bearbeiten' }).click()
      const formular = page.getByRole('form', { name: /Aufgabe bearbeiten/ })
      await formular.getByLabel('Fällig am (optional)', { exact: true }).fill(inTagen(1))
      await formular.getByRole('button', { name: 'Weitere Erinnerung' }).click()
      await formular.getByRole('button', { name: 'Weitere Erinnerung' }).click()
      await formular.getByRole('button', { name: 'Speichern' }).click()

      // In einer eigenen Liste gäbe es niemanden, für den der Schalter gilt.
      await page.getByRole('button', { name: 'Teilen', exact: true }).click()
      await page.getByLabel('E-Mail-Adresse des Mitglieds', { exact: true }).fill(mitglied)
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

      await expect(zeile.getByText('für mich stumm')).toHaveCount(1)
    },
    telefon: async (page, request) => {
      const mitglied = uniqueEmail('p-stumm-t-mitglied')
      await createAccount(request, mitglied)

      await telefon.register(page, uniqueEmail('p-stumm-t'))
      await telefon.createList(page, 'Haushalt')
      await telefon.createTask(page, 'Müll rausbringen')

      await telefon.taskRow(page, 'Müll rausbringen').click()
      await page.getByLabel('Fällig am (optional)', { exact: true }).fill(inTagen(1))
      await page.getByRole('button', { name: 'Weitere Erinnerung' }).click()
      await page.getByRole('button', { name: 'Weitere Erinnerung' }).click()
      await page.getByRole('button', { name: 'Speichern', exact: true }).click()

      await page.getByTestId('app-bar-title').click()
      await page.getByRole('button', { name: 'Teilen', exact: true }).click()
      await page.getByLabel('E-Mail-Adresse des Mitglieds', { exact: true }).fill(mitglied)
      await page.getByRole('button', { name: 'Freigeben' }).click()
      await expect(page.getByRole('status')).toContainText('Freigabe für')
      await page.getByRole('button', { name: 'Schließen' }).click()

      await telefon.taskRow(page, 'Müll rausbringen').click()
      await expect(page.getByRole('button', { name: /stummschalten/ })).toHaveCount(2)
      await page.getByRole('button', { name: 'Erinnerung 1 für mich stummschalten' }).click()
      await expect(
        page.getByRole('button', { name: 'Erinnerung 1 wieder für mich einschalten' }),
      ).toBeVisible()
      await page.getByRole('button', { name: 'Speichern', exact: true }).click()

      await expect(telefon.taskRow(page, 'Müll rausbringen').getByText('für mich stumm')).toHaveCount(1)
    },
  },
  {
    name: 'Beschreibung in der Übersicht auf- und zuklappen',
    breit: async (page) => {
      await breit.register(page, uniqueEmail('p-beschreibung-b'))
      await breit.createList(page, 'Haushalt')
      await breit.createTask(page, 'Einkauf')

      await breit.taskItem(page, 'Einkauf').getByRole('button', { name: 'Bearbeiten' }).click()
      const formular = page.getByRole('form', { name: /Aufgabe bearbeiten/ })
      await formular
        .getByLabel('Beschreibung (optional)', { exact: true })
        .fill('Erster Absatz.\n\nZweiter Absatz.')
      await formular.getByRole('button', { name: 'Speichern' }).click()

      // Zugeklappt: eine Zeile. Aufgeklappt: der ganze Text.
      await page.getByRole('button', { name: 'Mehr' }).click()
      await expect(page.getByRole('button', { name: 'Weniger' })).toBeVisible()
      await expect(page.getByTestId('task-description')).toContainText('Zweiter Absatz.')

      await page.getByRole('button', { name: 'Weniger' }).click()
      await expect(page.getByRole('button', { name: 'Mehr' })).toBeVisible()
    },
    telefon: async (page) => {
      await telefon.register(page, uniqueEmail('p-beschreibung-t'))
      await telefon.createList(page, 'Haushalt')
      await telefon.createTask(page, 'Einkauf', 'Erster Absatz.\n\nZweiter Absatz.')

      await page.getByRole('button', { name: 'Mehr' }).click()
      await expect(page.getByRole('button', { name: 'Weniger' })).toBeVisible()
      await expect(page.getByTestId('task-description')).toContainText('Zweiter Absatz.')

      // Das Aufklappen darf die Detailansicht nicht mit öffnen.
      await expect(page.getByRole('dialog', { name: 'Aufgabe' })).toHaveCount(0)

      await page.getByRole('button', { name: 'Weniger' }).click()
      await expect(page.getByRole('button', { name: 'Mehr' })).toBeVisible()
    },
  },
  {
    name: 'Vorschlag für eine schon einmal geteilte Adresse',
    breit: async (page, request) => {
      const mitglied = uniqueEmail('p-vorschlag-b-mitglied')
      await createAccount(request, mitglied)

      await breit.register(page, uniqueEmail('p-vorschlag-b'))
      await breit.createList(page, 'Erste Liste')

      // Erst das Teilen erzeugt den Vorschlag.
      await page.getByRole('button', { name: 'Teilen', exact: true }).click()
      await page.getByLabel('E-Mail-Adresse des Mitglieds', { exact: true }).fill(mitglied)
      await page.getByRole('button', { name: 'Freigeben' }).click()
      await expect(page.getByRole('status')).toContainText('Freigabe für')

      // In der nächsten Liste ist die Adresse kein Mitglied und wird angeboten.
      await breit.createList(page, 'Zweite Liste')

      // „Teilen" schaltet das Formular um, und nach dem Listenwechsel bleibt es
      // offen – ein zweiter Klick würde es also schließen.
      const teilenFormular = page.getByRole('form', { name: 'Liste teilen' })
      if (!(await teilenFormular.isVisible())) {
        await page.getByRole('button', { name: 'Teilen', exact: true }).click()
      }
      await expect(teilenFormular).toBeVisible()

      const vorschlag = page.getByRole('button', { name: mitglied })
      await expect(vorschlag).toBeVisible()
      await vorschlag.click()
      await expect(page.getByLabel('E-Mail-Adresse des Mitglieds', { exact: true })).toHaveValue(
        mitglied,
      )
    },
    telefon: async (page, request) => {
      const mitglied = uniqueEmail('p-vorschlag-t-mitglied')
      await createAccount(request, mitglied)

      await telefon.register(page, uniqueEmail('p-vorschlag-t'))
      await telefon.createList(page, 'Erste Liste')

      await page.getByTestId('app-bar-title').click()
      await page.getByRole('button', { name: 'Teilen', exact: true }).click()
      await page.getByLabel('E-Mail-Adresse des Mitglieds', { exact: true }).fill(mitglied)
      await page.getByRole('button', { name: 'Freigeben' }).click()
      await expect(page.getByRole('status')).toContainText('Freigabe für')
      await page.getByRole('button', { name: 'Schließen' }).click()

      await telefon.createList(page, 'Zweite Liste')
      await page.getByTestId('app-bar-title').click()
      await page.getByRole('button', { name: 'Teilen', exact: true }).click()

      const vorschlag = page.getByRole('button', { name: mitglied })
      await expect(vorschlag).toBeVisible()
      await vorschlag.click()
      await expect(page.getByLabel('E-Mail-Adresse des Mitglieds', { exact: true })).toHaveValue(
        mitglied,
      )
    },
  },
  {
    name: 'Anzeige, mit welchem Datenziel die App spricht',
    breit: async (page) => {
      await breit.register(page, uniqueEmail('p-datenziel-b'))

      // Die E2E-Umgebung läuft gegen den lokalen Mock (siehe playwright.config.ts).
      await expect(page.getByTestId('backend-label')).toHaveText(/Mock · 127\.0\.0\.1:/)
    },
    telefon: async (page) => {
      await telefon.register(page, uniqueEmail('p-datenziel-t'))

      // Auf dem Telefon steht die Anzeige im Menü – erreichbar sein muss sie.
      await telefon.openMenu(page)
      await expect(page.getByTestId('backend-label')).toHaveText(/Mock · 127\.0\.0\.1:/)
    },
  },
  {
    name: 'Aufgabe in eine andere Liste verschieben',
    breit: async (page) => {
      await breit.register(page, uniqueEmail('p-verschieben-b'))
      // Zwei Listen: anlegen wechselt jeweils zur neuen, also zuletzt die,
      // in der die Aufgabe entsteht.
      await breit.createList(page, 'Arbeit')
      await breit.createList(page, 'Haushalt')
      await breit.createTask(page, 'Bericht')

      await page.getByRole('button', { name: 'Aufgabe verschieben: Bericht' }).click()
      const blatt = page.getByRole('dialog', { name: 'Aufgabe verschieben' })
      await expect(blatt).toBeVisible()
      // Die eigene Liste steht mit in der Auswahl und ist angehakt.
      await expect(blatt.getByRole('button', { name: /Haushalt/ })).toHaveAttribute(
        'aria-current',
        'true',
      )
      await blatt.getByRole('button', { name: 'Arbeit' }).click()
      await blatt.getByRole('button', { name: 'Verschieben', exact: true }).click()
      await expect(blatt).toBeHidden()

      // Aus der Quellliste ist sie verschwunden …
      await expect(breit.taskItem(page, 'Bericht')).toHaveCount(0)

      // … und in der Zielliste steht sie.
      await page
        .getByRole('complementary', { name: 'Listen' })
        .getByRole('button', { name: 'Arbeit', exact: true })
        .click()
      await expect(page.getByTestId('list-title')).toHaveText('Arbeit')
      await expect(breit.taskItem(page, 'Bericht')).toBeVisible()
    },
    telefon: async (page) => {
      await telefon.register(page, uniqueEmail('p-verschieben-t'))
      await telefon.createList(page, 'Arbeit')
      await telefon.createList(page, 'Haushalt')
      await telefon.createTask(page, 'Bericht')

      await telefon.taskRow(page, 'Bericht').click()
      await expect(page.getByRole('dialog', { name: 'Aufgabe' })).toBeVisible()
      await page.getByRole('button', { name: 'In andere Liste verschieben' }).click()

      const blatt = page.getByRole('dialog', { name: 'Aufgabe verschieben' })
      await expect(blatt).toBeVisible()
      // Die eigene Liste ist sichtbar und angehakt.
      await expect(blatt.getByRole('button', { name: /Haushalt/ })).toHaveAttribute(
        'aria-current',
        'true',
      )
      await blatt.getByRole('button', { name: 'Arbeit' }).click()
      await blatt.getByRole('button', { name: 'Verschieben', exact: true }).click()
      await expect(blatt).toBeHidden()

      // Die Detailansicht bleibt offen; geschlossen ist die Quellliste leer.
      await page.getByRole('button', { name: 'Schließen' }).click()
      await expect(page.getByText('Noch keine Aufgaben in dieser Liste.')).toBeVisible()

      await telefon.openMenu(page)
      await page.getByRole('button', { name: 'Arbeit', exact: true }).click()
      await expect(telefon.taskRow(page, 'Bericht')).toBeVisible()
    },
  },
]

test.beforeEach(async ({ request }) => {
  await resetServer(request)
})

test.describe('breite Ansicht', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  for (const funktion of funktionen) {
    test(`breit: ${funktion.name}`, async ({ page, request }) => {
      await funktion.breit(page, request)
    })
  }
})

test.describe('Telefon', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true })

  for (const funktion of funktionen) {
    test(`Telefon: ${funktion.name}`, async ({ page, request }) => {
      await funktion.telefon(page, request)
    })
  }
})

/**
 * Der Kopf **eines** Bereichs.
 *
 * Es gibt immer mindestens zwei Köpfe – „Ohne Bereich" und die angelegten –
 * deshalb muss die Zusicherung den Namen mitprüfen.
 */
function bereichsKopf(page: Page, name: string) {
  return page.getByTestId('section-header').filter({ hasText: name })
}
