import { expect, test } from '@playwright/test'
import * as desktop from './support/helpers'
import * as phone from './support/mobile'

for (const mobile of [false, true]) test.describe(mobile ? 'OAuth Telefon' : 'OAuth breit', () => {
  test.use({ viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 900 }, hasTouch: mobile })
  test.beforeEach(async ({ request }) => desktop.resetServer(request))
  test('Freigabe erklärt den Umfang und erlaubt Teilen nur gesondert', async ({ page }, info) => {
    await (mobile ? phone.register : desktop.register)(page, desktop.uniqueEmail('oauth'))
    const authorizationId = 'request-1'
    const authorized: unknown[] = []
    await page.route('**/auth/v1/oauth/authorizations/request-1', route => route.fulfill({ json: { authorization_id: authorizationId, redirect_uri: 'https://chatgpt.com/callback', scope: 'openid profile offline_access', client: { id: 'test', name: 'Mein Agent' }, user: { id: 'test' } } }))
    await page.route('**/rest/v1/rpc/mcp_manage', route => { authorized.push(route.request().postDataJSON()); return route.fulfill({ json: { client_id: 'test' } }) })
    await page.route('**/auth/v1/oauth/authorizations/request-1/consent', async route => { expect(route.request().postDataJSON()).toEqual({ action: 'approve' }); await route.fulfill({ json: { redirect_url: `${new URL(page.url()).origin}/?connected=1` } }) })
    await page.goto(`/oauth/consent?authorization_id=${authorizationId}`)
    const screen = page.getByRole('region', { name: 'KI-Verbindung freigeben', exact: true })
    await expect(screen.getByText('Mein Agent', { exact: true })).toBeVisible()
    await expect(screen.getByLabel('Zusätzlich Listen teilen und Mitglieder entfernen', { exact: true })).not.toBeChecked()
    await expect(screen.getByLabel('Aufgaben und Listen bearbeiten, löschen und wiederherstellen', { exact: true })).toBeChecked()
    if (mobile) {
      await page.screenshot({ path: info.outputPath('oauth-telefon.png'), fullPage: true })
      await page.setViewportSize({ width: 844, height: 390 })
      await page.screenshot({ path: info.outputPath('oauth-quer.png'), fullPage: true })
    }
    await screen.getByRole('button', { name: 'Verbindung erlauben', exact: true }).click()
    await expect(page).toHaveURL(/connected=1/)
    expect(authorized).toEqual([{ p_action: 'authorize', p_data: { authorization_id: authorizationId, can_write: true, can_share: false, time_zone: expect.any(String) } }])
  })
})
