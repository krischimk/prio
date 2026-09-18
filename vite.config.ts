import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
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
