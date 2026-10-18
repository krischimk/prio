import { expect, type Page } from '@playwright/test'
import { register, uniqueEmail } from './helpers'
import * as phone from './mobile'

export async function agentConnectionsParity(page: Page, mobile: boolean) {
  await (mobile ? phone.register : register)(page, uniqueEmail('agents'))
  const clientId = '30000000-0000-4000-8000-000000000001'
  let connection = { client_id: clientId, name: 'Mein Agent', redirect_uri: 'https://chatgpt.com/callback', resource: 'https://prio-krischi.pages.dev/mcp', can_write: true, can_share: false, time_zone: 'Europe/Berlin', approved_at: new Date().toISOString(), revoked_at: null as string | null }
  await page.route('**/rest/v1/rpc/mcp_manage', async route => {
    const body = route.request().postDataJSON() as { p_action: string; p_data: { can_write?: boolean; can_share?: boolean } }
    if (body.p_action === 'permissions') connection = { ...connection, ...body.p_data }
    if (body.p_action === 'revoke') connection.revoked_at = new Date().toISOString()
    await route.fulfill({ json: body.p_action === 'list' ? [connection] : { client_id: clientId } })
  })
  await page.route('**/auth/v1/user/oauth/grants*', route => route.fulfill({ json: {} }))
  if (mobile) await phone.openMenu(page)
  await page.getByRole('button', { name: 'Konto', exact: true }).click()
  const account = page.getByRole('dialog', { name: 'Konto', exact: true })
  await account.getByRole('button', { name: 'KI-Verbindungen', exact: true }).click()
  await expect(account.getByText('Mein Agent', { exact: true })).toBeVisible()
  await expect(account.getByLabel('Teilen erlauben', { exact: true })).not.toBeChecked()
  await account.getByLabel('Teilen erlauben', { exact: true }).check()
  await expect.poll(() => connection.can_share).toBe(true)
  await account.getByLabel('Bearbeiten erlauben', { exact: true }).uncheck()
  await expect.poll(() => connection.can_write).toBe(false)
  await expect(account.getByLabel('Teilen erlauben', { exact: true })).not.toBeChecked()
  await account.getByRole('button', { name: 'Zugriff widerrufen', exact: true }).click()
  await expect(account.getByText('Noch keine aktiven Verbindungen.', { exact: true })).toBeVisible()
  await account.getByRole('button', { name: 'Schließen', exact: true }).click()
}
