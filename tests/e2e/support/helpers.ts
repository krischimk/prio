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
  tasks: Array<{ id: string; list_id: string; title: string; completed: boolean; deleted_at: string | null }>
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
  await page.getByLabel('Name der neuen Liste', { exact: true }).fill(name)
  await page.getByRole('button', { name: 'Liste anlegen', exact: true }).click()
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

export async function createTask(page: Page, title: string): Promise<void> {
  await page.getByLabel('Neue Aufgabe', { exact: true }).fill(title)
  await page.getByRole('button', { name: 'Hinzufügen', exact: true }).click()
  await expect(taskItem(page, title)).toBeVisible()
}

/** Wartet, bis der Sync-Status einen bestimmten Text enthält. */
export async function expectSyncStatus(page: Page, text: string): Promise<void> {
  await expect(page.getByTestId('sync-status')).toContainText(text)
}
