import { expect, test } from '@playwright/test'
import {
  createList,
  createTask,
  logout,
  register,
  resetServer,
  serverState,
  taskItem,
  uniqueEmail,
} from './support/helpers'

/**
 * E2E 4: Gemeinsame Liste mit zwei Benutzern.
 *
 * A erstellt eine gemeinsame Liste, gibt sie für B frei, B erstellt eine
 * Aufgabe und A sieht sie nach der Synchronisation. Beide Benutzer haben einen
 * eigenen Browserkontext (eigene Sitzung, eigene lokale Datenbank) und teilen
 * nur den Server.
 */
test.beforeEach(async ({ request }) => {
  await resetServer(request)
})

test('E2E 4: Benutzer A teilt eine Liste mit Benutzer B', async ({ browser, request }) => {
  const emailA = uniqueEmail('e2e4-a')
  const emailB = uniqueEmail('e2e4-b')

  const contextA = await browser.newContext()
  const contextB = await browser.newContext()

  try {
    const pageA = await contextA.newPage()
    const pageB = await contextB.newPage()

    // B registriert sich zuerst – geteilt werden kann nur an registrierte Nutzer.
    await register(pageB, emailB)
    await logout(pageB)

    // 1. A erstellt eine Liste.
    await register(pageA, emailA)
    await createList(pageA, 'Projekt gemeinsam')

    // 2. A gibt die Liste per E-Mail-Adresse frei.
    await pageA.getByRole('button', { name: 'Teilen', exact: true }).click()
    await pageA.getByLabel('E-Mail-Adresse des Mitglieds', { exact: true }).fill(emailB)
    await pageA.getByRole('button', { name: 'Freigeben' }).click()
    await expect(pageA.getByRole('status')).toContainText(`Freigabe für ${emailB} gespeichert.`)

    await expect
      .poll(async () => (await serverState(request)).members.length)
      .toBe(1)

    // 3. B meldet sich an und sieht die Liste nach der Synchronisation.
    await pageB.reload()
    await pageB.getByLabel('E-Mail', { exact: true }).fill(emailB)
    await pageB.getByLabel('Passwort', { exact: true }).fill('geheim123')
    await pageB.getByRole('button', { name: 'Anmelden', exact: true }).click()

    await expect(pageB.getByTestId('list-title')).toHaveText('Projekt gemeinsam')
    await expect(pageB.getByText('geteilt').first()).toBeVisible()

    // 4. B erstellt eine Aufgabe.
    await createTask(pageB, 'Aufgabe von B')

    // Bs Sync läuft entprellt im Hintergrund – erst danach kann A sie sehen.
    await expect
      .poll(async () => (await serverState(request)).tasks.map((task) => task.title))
      .toEqual(['Aufgabe von B'])

    // 5. A sieht die Änderung nach dem nächsten Sync.
    await pageA.getByRole('button', { name: 'Jetzt synchronisieren' }).click()
    await expect(taskItem(pageA, 'Aufgabe von B')).toBeVisible()
  } finally {
    await contextA.close()
    await contextB.close()
  }
})

test('E2E 4b: nach dem Entfernen sieht Benutzer B die gemeinsame Liste nicht mehr', async ({
  browser,
  request,
}) => {
  const emailA = uniqueEmail('e2e4b-a')
  const emailB = uniqueEmail('e2e4b-b')

  const contextA = await browser.newContext()
  const contextB = await browser.newContext()

  try {
    const pageA = await contextA.newPage()
    const pageB = await contextB.newPage()

    await register(pageB, emailB)
    await logout(pageB)

    await register(pageA, emailA)
    await createList(pageA, 'Nur kurz geteilt')
    await pageA.getByRole('button', { name: 'Teilen', exact: true }).click()
    await pageA.getByLabel('E-Mail-Adresse des Mitglieds', { exact: true }).fill(emailB)
    await pageA.getByRole('button', { name: 'Freigeben' }).click()
    await expect(pageA.getByRole('status')).toContainText('Freigabe für')

    await pageB.reload()
    await pageB.getByLabel('E-Mail', { exact: true }).fill(emailB)
    await pageB.getByLabel('Passwort', { exact: true }).fill('geheim123')
    await pageB.getByRole('button', { name: 'Anmelden', exact: true }).click()
    await expect(pageB.getByTestId('list-title')).toHaveText('Nur kurz geteilt')

    // A entfernt B.
    await pageA.getByRole('button', { name: 'Entfernen' }).click()
    await expect
      .poll(async () => (await serverState(request)).members[0]?.deleted_at)
      .not.toBeNull()

    // B synchronisiert und verliert den Zugriff.
    await pageB.getByRole('button', { name: 'Jetzt synchronisieren' }).click()
    await expect(pageB.getByText('Noch keine Liste vorhanden.')).toBeVisible()
  } finally {
    await contextA.close()
    await contextB.close()
  }
})
