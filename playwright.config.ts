import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright-Konfiguration.
 *
 * Die E2E-Tests starten zwei Server:
 *   1. den Mock von Supabase (Auth + PostgREST + RPC, siehe tests/mock-supabase),
 *   2. den Vite-Dev-Server mit Zeiger auf diesen Mock.
 *
 * Dadurch laufen die Tests vollständig ohne Cloud und ohne Secrets. Die
 * Testdaten liegen nur im Speicher des Mock-Servers und werden vor jedem Test
 * zurückgesetzt.
 */

const MOCK_PORT = Number(process.env.MOCK_SUPABASE_PORT ?? 54321)
const APP_PORT = Number(process.env.E2E_APP_PORT ?? 5173)
const MOCK_URL = `http://127.0.0.1:${MOCK_PORT}`
const APP_URL = `http://127.0.0.1:${APP_PORT}`

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  // Der Mock-Server hält einen gemeinsamen Zustand – deshalb bewusst seriell.
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: APP_URL,
    viewport: { width: 1280, height: 800 },
    trace: 'retain-on-failure',
    video: 'off',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: `node tests/mock-supabase/server.mjs ${MOCK_PORT}`,
      url: `${MOCK_URL}/__test__/health`,
      reuseExistingServer: !process.env.CI,
      stdout: 'pipe',
    },
    {
      command: `npm run dev -- --host 127.0.0.1 --port ${APP_PORT} --strictPort`,
      url: APP_URL,
      reuseExistingServer: !process.env.CI,
      env: {
        VITE_SUPABASE_URL: MOCK_URL,
        VITE_SUPABASE_ANON_KEY: 'e2e-anon-key',
      },
      stdout: 'pipe',
    },
  ],
})
