import { expect, type APIRequestContext, type Locator, type Page } from '@playwright/test'

/**
 * Gemeinsame Hilfsfunktionen der E2E-Tests.
 *
 * Die Tests laufen gegen den Mock-Supabase-Server (tests/mock-supabase/server.mjs)
 * und den echten Vite-Dev-Server. Es werden keine echten Zugangsdaten benötigt.
 */

export const MOCK_URL = `http://127.0.0.1:${process.env.MOCK_SUPABASE_PORT ?? 54321}`

export const PASSWORD = 'geheim123'

export function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}@example.com`
}

/** Setzt den Serverzustand vor jedem Test zurück. */
export async function resetServer(request: APIRequestContext): Promise<void> {
  const response = await request.post(`${MOCK_URL}/__test__/reset`)
  expect(response.ok()).toBe(true)
}

export interface ServerState {
  users: number
  lists: Array<{ id: string; name: string; owner_id: string; is_shared: boolean }>
  members: Array<{ list_id: string; user_id: string; deleted_at: string | null }>
  tasks: Array<{ id: string; list_id: string; title: string; description: string | null; completed: boolean; completed_at: string | null; completed_expires_at: string | null; expired_at: string | null; deleted_at: string | null }>
  preferences: Array<{ list_id: string; user_id: string; include_in_overview: boolean }>
  userPreferences: Array<{ id: string; default_list_id: string | null; overview_mode: string }>
}

export async function serverState(request: APIRequestContext): Promise<ServerState> {
  const response = await request.get(`${MOCK_URL}/__test__/state`)
  expect(response.ok()).toBe(true)
  return (await response.json()) as ServerState
}

export async function register(page: Page, email: string): Promise<void> {
  await page.goto('/')
  await page.getByRole('button', { name: 'Registrieren', exact: true }).click()
  await page.getByLabel('E-Mail', { exact: true }).fill(email)
  await page.getByLabel('Passwort', { exact: true }).fill(PASSWORD)
  await page.getByRole('button', { name: 'Konto erstellen', exact: true }).click()
  await expect(page.getByTestId('current-user')).toHaveText(email)
}

/**
 * Legt ein Konto direkt am Mock-Server an.
 *
 * Reicht, wenn es nur existieren muss – etwa als Empfänger einer Freigabe. Der
 * umständliche Weg über einen zweiten Browserkontext ist dafür nicht nötig.
 */
export async function createAccount(request: APIRequestContext, email: string): Promise<void> {
  const response = await request.post(`${MOCK_URL}/auth/v1/signup`, {
    data: { email, password: PASSWORD },
  })
  expect(response.ok()).toBe(true)
}

export async function login(page: Page, email: string): Promise<void> {
  await page.goto('/')
  await page.getByLabel('E-Mail', { exact: true }).fill(email)
  await page.getByLabel('Passwort', { exact: true }).fill(PASSWORD)
  await page.getByRole('button', { name: 'Anmelden', exact: true }).click()
  await expect(page.getByTestId('current-user')).toHaveText(email)
}

export async function logout(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Abmelden' }).click()
  await expect(page.getByRole('button', { name: 'Anmelden', exact: true })).toBeVisible()
}

export async function createList(page: Page, name: string): Promise<void> {
  await closeListSettings(page)
  await page.getByLabel('Name der neuen Liste', { exact: true }).fill(name)
  await page.getByRole('button', { name: 'Liste anlegen', exact: true }).click()
  await expect(page.getByTestId('list-title')).toHaveText(name)
}

export async function selectList(page: Page, name: string): Promise<void> {
  await closeListSettings(page)
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  await page.getByRole('complementary', { name: 'Listen' }).getByRole('button', { name: new RegExp(`^${escaped}(?:\\s+geteilt)?$`) }).click()
  await expect(page.getByTestId('list-title')).toHaveText(name)
}

/** Die Listeneinträge (li) der aktuell ausgewählten Liste. */
export function taskItems(page: Page): Locator {
  return page.getByTestId('task-list').locator('li')
}

/** Der Listeneintrag einer bestimmten Aufgabe. */
export function taskItem(page: Page, title: string): Locator {
  return taskItems(page).filter({ hasText: title })
}

/** Gemeinsame Listenverwaltung: Knopf auf dem Desktop, Listentitel auf dem Telefon. */
export async function openListSettings(page: Page): Promise<Locator> {
  const dialog = page.getByRole('dialog', { name: 'Liste verwalten', exact: true })
  if (!(await dialog.isVisible())) {
    if (await page.getByTestId('app-bar-title').isVisible()) await page.getByTestId('app-bar-title').click()
    else await page.getByRole('button', { name: 'Liste verwalten', exact: true }).click()
  }
  await expect(dialog).toBeVisible()
  return dialog
}

export async function listAction(page: Page, action: string): Promise<Locator> {
  const dialog = await openListSettings(page)
  const button = dialog.getByRole('button', { name: action, exact: true })
  if (!(await button.isVisible())) await dialog.getByRole('button', { name: 'Zur Übersicht', exact: true }).click()
  await button.click()
  return dialog
}

export async function closeListSettings(page: Page): Promise<void> {
  const dialog = page.getByRole('dialog', { name: 'Liste verwalten', exact: true })
  if (await dialog.isVisible()) await dialog.getByRole('button', { name: 'Schließen', exact: true }).click()
}

export async function openTaskEditor(page: Page, title: string): Promise<Locator> {
  await closeListSettings(page)
  const desktop = taskItem(page, title).getByRole('button', { name: 'Bearbeiten', exact: true })
  const phone = page.getByTestId('task-row').filter({ hasText: title })
  await desktop.or(phone).click()
  return page.getByRole('dialog', { name: 'Aufgabe', exact: true })
}

export async function createTask(page: Page, title: string): Promise<void> {
  await page.getByLabel('Neue Aufgabe', { exact: true }).fill(title)
  await page.getByRole('button', { name: 'Hinzufügen', exact: true }).click()
  await expect(taskItem(page, title)).toBeVisible()
}

/** Wartet, bis der Sync-Status einen bestimmten Text enthält. */
export async function expectSyncStatus(page: Page, text: string): Promise<void> {
  await expect(page.getByTestId('sync-status')).toContainText(text)
}
