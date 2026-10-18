import { expect, test } from '@playwright/test'
import * as desktop from './support/helpers'
import * as phone from './support/mobile'

for (const mobile of [false, true]) test.describe(mobile ? 'Lokaler Start Telefon' : 'Lokaler Start breit', () => {
  test.use({ viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 900 }, hasTouch: mobile })
  test.beforeEach(async ({ request }) => desktop.resetServer(request))
  test('abgelaufene Sitzung öffnet lokale Aufgaben, während die Token-Erneuerung noch wartet', async ({ page, request }) => {
    await (mobile ? phone.register : desktop.register)(page, desktop.uniqueEmail('slow-start'))
    await (mobile ? phone.createList : desktop.createList)(page, 'Lokal')
    await (mobile ? phone.createTask : desktop.createTask)(page, 'Schon gespeichert')
    await expect.poll(async () => (await desktop.serverState(request)).tasks.some(task => task.title === 'Schon gespeichert')).toBe(true)
    await page.evaluate(() => {
      const session = JSON.parse(localStorage.getItem('prio.auth')!)
      session.expires_at = Math.floor(Date.now() / 1000) - 120
      localStorage.setItem('prio.auth', JSON.stringify(session))
    })
    let release!: () => void
    const delayed = new Promise<void>(resolve => { release = resolve })
    let refreshing = false
    await page.route('**/auth/v1/token?grant_type=refresh_token', async route => {
      refreshing = true
      await delayed
      await route.continue()
    })
    try {
      await page.reload({ waitUntil: 'domcontentloaded' })
      await expect.poll(() => refreshing).toBe(true)
      if (mobile) {
        await phone.openMenu(page)
        await page.getByRole('dialog', { name: 'Menü', exact: true }).getByRole('button', { name: 'Lokal', exact: true }).click()
      } else await desktop.selectList(page, 'Lokal')
      await expect(page.getByTestId('task-row').getByText('Schon gespeichert', { exact: true })).toBeVisible({ timeout: 5_000 })
      await (mobile ? phone.createTask : desktop.createTask)(page, 'Während der Netzsuche')
      await expect(page.getByTestId('task-row').getByText('Während der Netzsuche', { exact: true })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Anmelden', exact: true })).toBeHidden()
    } finally { release() }
    await expect.poll(async () => (await desktop.serverState(request)).tasks.some(task => task.title === 'Während der Netzsuche')).toBe(true)
  })
})
