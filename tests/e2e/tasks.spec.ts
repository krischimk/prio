import { openTaskEditor } from './support/helpers'
import { expect, test } from '@playwright/test'
import {
  createList,
  createTask,
  login,
  logout,
  register,
  resetServer,
  taskItem,
  uniqueEmail,
  selectList,
} from './support/helpers'

/**
 * E2E 1 und E2E 2: Anmelden, Aufgabe erstellen, bearbeiten, erledigen.
 *
 * Läuft gegen den Mock-Supabase-Server – echte HTTP-Aufrufe, aber keine Cloud.
 */
test.beforeEach(async ({ request }) => {
  await resetServer(request)
})

test('E2E 1: Benutzer registriert sich, erstellt eine Aufgabe und sieht sie in der Liste', async ({
  page,
}) => {
  const email = uniqueEmail('e2e1')

  await register(page, email)
  await expect(page.getByText('Noch keine Liste vorhanden.')).toBeVisible()

  await createList(page, 'Arbeit')
  await createTask(page, 'Bericht schreiben')

  // Die Aufgabe erscheint sofort – ohne auf den Server zu warten.
  await expect(taskItem(page, 'Bericht schreiben')).toBeVisible()
  await expect(page.getByText('1 offene Aufgabe')).toBeVisible()
})

test('E2E 1b: nach erneutem Anmelden sind die Daten wieder da (Sitzung + lokale Datenbank)', async ({
  page,
}) => {
  const email = uniqueEmail('e2e1b')

  await register(page, email)
  await createList(page, 'Arbeit')
  await createTask(page, 'Bleibt erhalten')

  await logout(page)
  await login(page, email)

  await expect(page.getByRole('heading', { name: 'Gesamtansicht', exact: true })).toBeVisible()
  await selectList(page, 'Arbeit')

  await expect(page.getByTestId('list-title')).toHaveText('Arbeit')
  await expect(taskItem(page, 'Bleibt erhalten')).toBeVisible()
})

test('E2E 2: Benutzer bearbeitet und erledigt eine Aufgabe', async ({ page }) => {
  const email = uniqueEmail('e2e2')

  await register(page, email)
  await createList(page, 'Arbeit')
  await createTask(page, 'Erster Titel')

  // Bearbeiten
  await openTaskEditor(page, 'Erster Titel')
  const form = page.getByRole('form', { name: 'Aufgabe bearbeiten: Erster Titel' })
  await form.getByLabel('Titel', { exact: true }).fill('Neuer Titel')
  await form.getByLabel('Beschreibung (optional)', { exact: true }).fill('Mit Notiz')
  await form.getByRole('button', { name: 'Speichern' }).click()

  await expect(taskItem(page, 'Neuer Titel')).toBeVisible()
  await expect(taskItem(page, 'Neuer Titel').getByText('Mit Notiz')).toBeVisible()

  // Erledigen. Bewusst `click` statt `check`: Die Anzeige folgt der lokalen
  // Datenbank und wird erst nach dem Schreiben neu gerendert – und die Aufgabe
  // verschwindet dabei ganz aus der Liste.
  await taskItem(page, 'Neuer Titel').getByRole('checkbox').click()
  await expect(page.getByText('Noch keine Aufgaben in dieser Liste.')).toBeVisible()

  // Die Leiste bietet den Rückweg an.
  const leiste = page.getByTestId('undo-bar')
  await expect(leiste).toContainText('Neuer Titel')
  await leiste.getByRole('button', { name: 'Rückgängig' }).click()
  await expect(taskItem(page, 'Neuer Titel')).toBeVisible()

  // Löschen
  await openTaskEditor(page, 'Neuer Titel')
  await page.getByRole('dialog', { name: 'Aufgabe', exact: true }).getByRole('button', { name: 'Aufgabe löschen' }).click()
  await expect(page.getByText('Noch keine Aufgaben in dieser Liste.')).toBeVisible()
})
