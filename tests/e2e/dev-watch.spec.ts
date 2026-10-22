import { expect, test } from '@playwright/test'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

test('native Quellen und HTML-Bauberichte laden die geöffnete App nicht neu', async ({ page }) => {
  const directory = join(process.cwd(), 'android/app/build/tmp')
  const report = join(directory, `widget-watch-${crypto.randomUUID()}.html`)
  const native = join(process.cwd(), 'android', `widget-watch-${crypto.randomUUID()}.kt`)
  await mkdir(directory, { recursive: true })
  try {
    await writeFile(report, '<html>Erster Prüfbericht</html>')
    await writeFile(native, '// Erste native Quelle')
    await page.goto('/')
    await page.evaluate(() => { Object.assign(window, { nativeBuildReloadProbe: 'bleibt erhalten' }) })
    await writeFile(report, '<html>Neuer Prüfbericht</html>')
    await writeFile(native, '// Geänderte native Quelle')
    // Das Neuladen kam asynchron über den Vite-WebSocket, nicht aus der App.
    await page.waitForTimeout(1000)
    expect(await page.evaluate(() => Reflect.get(window, 'nativeBuildReloadProbe'))).toBe('bleibt erhalten')
  } finally { await Promise.all([rm(report, { force: true }), rm(native, { force: true })]) }
})
