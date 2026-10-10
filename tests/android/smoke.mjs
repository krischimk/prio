/** Prüft das tatsächliche APK/WebView, ohne Cloudzugang oder private Daten. */
import { _android, expect } from '@playwright/test'
import { execFileSync, spawn } from 'node:child_process'
import { closeSync, mkdirSync, openSync, readFileSync, writeFileSync } from 'node:fs'
import assert from 'node:assert/strict'

const output = 'test-results/android'
mkdirSync(output, { recursive: true })
const adb = (...args) => execFileSync('adb', args, { encoding: 'utf8', timeout: 30_000 }).trim()
const pause = () => new Promise(resolve => setTimeout(resolve, 1000))
const mockLog = openSync(`${output}/mock.log`, 'w')
const mock = spawn(process.execPath, ['tests/mock-supabase/server.mjs', '54321'], { stdio: ['ignore', mockLog, mockLog] })
closeSync(mockLog)
let device
let page
const errors = []
const snapshot = async name => {
  if (page) await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  writeFileSync(`${output}/${name}.png`, execFileSync('adb', ['exec-out', 'screencap', '-p'], { timeout: 30_000 }))
}

try {
  let healthy = false
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try { healthy = (await fetch('http://127.0.0.1:54321/__test__/health')).ok } catch { /* Mock startet noch. */ }
    if (healthy) break
    await pause()
  }
  assert.ok(healthy, 'Der isolierte Mock-Server ist nicht gestartet.')
  adb('reverse', 'tcp:54321', 'tcp:54321')
  adb('install', '-r', 'android/app/build/outputs/apk/debug/app-debug.apk')
  adb('shell', 'am', 'start', '-n', 'de.krischi.prio/.MainActivity')
  // Die dokumentierte Android-Anbindung unterstützt WebViews ohne die
  // Browser-Kontextverwaltung eines vollständigen Desktop-Chrome.
  device = (await _android.devices())[0]
  assert.ok(device, 'Kein Android-Emulator erreichbar.')
  adb('shell', 'svc', 'power', 'stayon', 'true')
  page = await (await device.webView({ pkg: 'de.krischi.prio' }, { timeout: 60_000 })).page()
  page.setDefaultTimeout(30_000)
  page.on('pageerror', error => errors.push(error.message))
  await expect(page.getByRole('heading', { name: 'Prio', exact: true })).toBeVisible({ timeout: 60_000 })
  assert.equal(await page.evaluate(() => window.Capacitor.getPlatform()), 'android')
  const nativeVersion = adb('shell', 'dumpsys', 'package', 'de.krischi.prio').match(/versionName=(\S+)/)?.[1]
  const info = { id: 'de.krischi.prio', version: nativeVersion, model: device.model() }
  const version = JSON.parse(readFileSync('package.json', 'utf8')).version
  assert.equal(info.version, version, 'Geprüft wird die aktuelle APK-Version.')
  await snapshot('anmeldung')

  await page.getByRole('button', { name: 'Registrieren', exact: true }).click()
  await page.getByLabel('E-Mail', { exact: true }).fill('android-smoke@prio.example')
  await page.getByLabel('Passwort', { exact: true }).fill('testen123')
  await page.getByRole('button', { name: 'Konto erstellen', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Gesamtansicht', exact: true })).toBeVisible()
  await page.getByRole('button', { name: /Menü/ }).click()
  await page.getByLabel('Name der neuen Liste', { exact: true }).fill('Alltag')
  await page.getByRole('button', { name: 'Liste anlegen', exact: true }).click()
  await expect(page.getByTestId('app-bar-title')).toHaveText('Alltag')

  await page.getByTestId('app-bar-title').click()
  const settings = page.getByRole('dialog', { name: 'Liste verwalten', exact: true })
  await expect(settings.getByLabel('Abgehakt am Listenende')).not.toBeChecked()
  await settings.getByLabel('In Gesamtansicht aufnehmen').check()
  await settings.getByLabel('Abgehakt am Listenende').check()
  await settings.getByRole('button', { name: 'Schließen', exact: true }).click()

  await page.getByRole('button', { name: 'Neue Aufgabe', exact: true }).click()
  const editor = page.getByRole('dialog', { name: 'Neue Aufgabe', exact: true })
  await editor.getByLabel('Titel', { exact: true }).fill('Die neue Prio-Fassung ausprobieren')
  await editor.getByLabel('Beschreibung (optional)').fill('Listen, Gesamtansicht und den gemeinsamen Editor testen.')
  await snapshot('editor')
  await editor.getByRole('button', { name: 'Speichern', exact: true }).click()
  await expect(editor).toBeHidden()
  await expect(page.getByTestId('task-row')).toContainText('Die neue Prio-Fassung ausprobieren')
  await snapshot('liste')

  await page.getByRole('checkbox', { name: /^Aufgabe erledigen:/ }).click()
  const completed = page.getByRole('region', { name: 'Abgehakt', exact: true })
  await completed.getByRole('button', { name: /^Abgehakt/i }).click()
  await completed.getByRole('button', { name: 'Wieder öffnen', exact: true }).click()
  await expect(page.getByTestId('task-row')).toBeVisible()
  await page.getByRole('button', { name: /Menü/ }).click()
  await expect(page.getByText('Alles synchronisiert.', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Gesamtansicht', exact: true }).click()
  await expect(page.getByTestId('overview-task')).toContainText('Die neue Prio-Fassung ausprobieren')
  await snapshot('gesamtansicht')
  adb('shell', 'settings', 'put', 'system', 'accelerometer_rotation', '0')
  adb('shell', 'settings', 'put', 'system', 'user_rotation', '1')
  await expect.poll(() => page.evaluate(() => innerWidth > innerHeight), { timeout: 15_000 }).toBe(true)
  await snapshot('querformat')
  assert.deepEqual(errors, [], 'Keine JavaScript-Fehler im nativen WebView.')
  writeFileSync(`${output}/ergebnis.json`, JSON.stringify({ version, native: info, checks: ['APK-Start', 'Registrierung', 'Listenregeln', 'Aufgabe speichern', 'Abhaken und Wiederöffnen', 'Synchronisation', 'Gesamtansicht', 'Querformat'], errors }, null, 2))
  console.log('Native Android-Kernabläufe bestanden.')
} finally {
  try { await snapshot('letzter-zustand'); writeFileSync(`${output}/logcat.txt`, adb('logcat', '-d', '-t', '1000')) } catch { /* Ursprünglichen Prüfungsfehler erhalten. */ }
  if (device) await device.close()
  mock.kill()
}
