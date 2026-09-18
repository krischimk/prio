import { expect, test } from '@playwright/test'
import {
  createList,
  createTask,
  expectSyncStatus,
  login,
  register,
  resetServer,
  serverState,
  taskItem,
  uniqueEmail,
} from './support/helpers'

/**
 * E2E 3: Offline-Modus.
 *
 * Netzwerk deaktivieren → Aufgabe erstellen → Aufgabe bleibt sichtbar und die
 * App meldet den Offline-Zustand → Netzwerk aktivieren → Sync lädt hoch.
 */
test.beforeEach(async ({ request }) => {
  await resetServer(request)
})

test('E2E 3: Aufgabe entsteht offline und wird nach dem Verbindungsaufbau synchronisiert', async ({
  page,
  context,
  browser,
  request,
}) => {
  const email = uniqueEmail('e2e3')

  await register(page, email)
  await createList(page, 'Offline-Liste')

  // --- offline ------------------------------------------------------------
  await context.setOffline(true)

  await createTask(page, 'Offline-Aufgabe')
  await expect(taskItem(page, 'Offline-Aufgabe')).toBeVisible()
  await expectSyncStatus(page, 'Offline – Änderungen werden später synchronisiert.')

  // Nichts ist auf dem Server angekommen.
  const offlineState = await serverState(request)
  expect(offlineState.tasks).toHaveLength(0)

  // --- wieder online ------------------------------------------------------
  await context.setOffline(false)
  await page.getByRole('button', { name: 'Jetzt synchronisieren' }).click()

  await expectSyncStatus(page, 'Alles synchronisiert')
  await expect
    .poll(async () => (await serverState(request)).tasks.map((task) => task.title))
    .toEqual(['Offline-Aufgabe'])

  // --- zweites Gerät ------------------------------------------------------
  // Eigener Browserkontext: leere lokale Datenbank, keine Sitzung.
  const otherContext = await browser.newContext()
  try {
    const secondPage = await otherContext.newPage()
    await login(secondPage, email)

    await expect(secondPage.getByTestId('list-title')).toHaveText('Offline-Liste')
    await expect(taskItem(secondPage, 'Offline-Aufgabe')).toBeVisible()
  } finally {
    await otherContext.close()
  }
})
