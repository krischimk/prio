import { defineConfig } from '@playwright/test'

/**
 * Rauchprüfung der **veröffentlichten** Web-Fassung.
 *
 * Eigene Konfiguration, weil hier nichts gestartet wird: Geprüft wird die
 * Adresse, die die Nutzer tatsächlich öffnen. Der normale E2E-Lauf
 * (`tests/e2e`) fasst das nicht an – er läuft gegen den lokalen Mock.
 *
 *   npm run smoke:live
 */
export default defineConfig({
  testDir: './tests/live',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'https://prio-krischi.pages.dev',
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    trace: 'retain-on-failure',
  },
})
