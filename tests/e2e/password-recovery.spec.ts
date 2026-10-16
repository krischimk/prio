import { expect, test } from '@playwright/test'
import { createAccount, MOCK_URL, PASSWORD, resetServer, uniqueEmail } from './support/helpers'

test.beforeEach(async ({ request }) => resetServer(request))

for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
  test(`Passwort per E-Mail zurücksetzen (${viewport.width})`, async ({ page, request }) => {
    await page.setViewportSize(viewport)
    const email = uniqueEmail('recovery')
    await createAccount(request, email)
    await page.goto('/')
    await page.getByRole('button', { name: 'Passwort vergessen?' }).click()
    await page.getByLabel('E-Mail', { exact: true }).fill(email)
    await page.getByRole('button', { name: 'Link anfordern' }).click()
    await expect(page.getByRole('status')).toContainText('Falls für diese Adresse ein Konto besteht')
    await expect(page.getByRole('button', { name: 'Link anfordern' })).toBeDisabled()
    const messages = await (await request.get(`${MOCK_URL}/__test__/recovery-mailbox`)).json()
    expect(messages).toHaveLength(1)
    // Ein anderer Browser öffnet den Link: keine bestehende Sitzung nötig.
    await page.goto(messages[0].url)
    await expect(page.getByRole('form', { name: 'Neues Passwort festlegen' })).toBeVisible()
    expect(new URL(page.url()).hash).toBe('')
    await page.screenshot({ path: `test-results/password-form-${viewport.width}.png` })
    if (viewport.width < 1024) {
      await page.setViewportSize({ width: 740, height: 360 })
      await page.screenshot({ path: 'test-results/password-form-landscape.png', fullPage: true })
      await page.setViewportSize(viewport)
    }
    await page.getByLabel('Neues Passwort', { exact: true }).fill('neu-geheim123')
    await page.getByLabel('Passwort wiederholen').fill('neu-geheim123')
    await page.getByRole('button', { name: 'Passwort speichern' }).click()
    await expect(page.getByRole('status')).toHaveText('Dein Passwort wurde geändert.')
    const oldLogin = await request.post(`${MOCK_URL}/auth/v1/token?grant_type=password`, { data: { email, password: PASSWORD } })
    expect(oldLogin.ok()).toBe(false)
    const newLogin = await request.post(`${MOCK_URL}/auth/v1/token?grant_type=password`, { data: { email, password: 'neu-geheim123' } })
    expect(newLogin.ok()).toBe(true)
    await page.screenshot({ path: `test-results/password-recovery-${viewport.width}.png` })
    // Der Verifizierungslink ist nur einmal einlösbar.
    expect((await request.get(messages[0].url)).status()).toBe(403)
  })
}

test('Unbekannte E-Mail hat denselben Hinweis; abgelaufener Link bleibt gesperrt', async ({ page, request }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Passwort vergessen?' }).click()
  await page.getByLabel('E-Mail', { exact: true }).fill('unknown@example.com')
  await page.getByRole('button', { name: 'Link anfordern' }).click()
  await expect(page.getByRole('status')).toContainText('Falls für diese Adresse ein Konto besteht')
  expect(await (await request.get(`${MOCK_URL}/__test__/recovery-mailbox`)).json()).toEqual([])
  await page.goto('/konto/passwort#error=access_denied&error_code=otp_expired')
  await expect(page.getByRole('alert')).toContainText('ungültig oder abgelaufen')
  await expect(page.getByRole('button', { name: 'Passwort speichern' })).toHaveCount(0)
})
