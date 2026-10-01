import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

import pkg from './package.json' with { type: 'json' }

// Vitest erbt ein `NODE_ENV` aus der Umgebung. Steht dort `production` – etwa
// weil der Aufruf aus einem Dienst kommt –, lädt React seine Produktionsfassung
// ohne `act`, und Vite externalisiert die Node-Builtins (`node:fs`) nicht mehr.
// Beides lässt Tests scheitern, ohne dass der Quelltext etwas damit zu tun hat.
// `VITEST` setzt nur Vitest selbst; der Produktionsbuild bleibt unberührt.
if (process.env.VITEST) {
  process.env.NODE_ENV = 'test'
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Die eigene Version wird eingebettet, damit die Oberfläche sie kennt, ohne
  // package.json mitzuschleppen. In der App wird sie zur Laufzeit durch die
  // tatsächlich installierte Version ersetzt (siehe `currentVersion`).
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: [
      'tests/unit/**/*.test.ts',
      'tests/unit/**/*.test.tsx',
      'tests/integration/**/*.test.ts',
      'tests/integration/**/*.test.tsx',
    ],
    // E2E-Tests laufen bewusst getrennt über Playwright (`npm run test:e2e`),
    // weil sie einen echten Browser und den Mock-Supabase-Server benötigen.
    exclude: ['tests/e2e/**', 'node_modules/**'],
  },
})
