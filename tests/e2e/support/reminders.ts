import { expect, type Locator } from '@playwright/test'

/** Eine Glocke, deren zugänglicher Hinweis alle eingestellten Erinnerungen enthält. */
export async function expectReminders(row: Locator, count: number) {
  const indicator = row.getByRole('img', { name: /^Erinnerungen:/ })
  await expect(indicator).toHaveCount(count ? 1 : 0)
  if (count) await expect.poll(async () => ((await indicator.getAttribute('aria-label'))?.match(/Erinnert:/g) ?? []).length).toBe(count)
}
