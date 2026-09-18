import type { CapacitorConfig } from '@capacitor/cli'

/**
 * Capacitor-Konfiguration für die Android-App.
 *
 * Die Web-App wird als `dist/` in die App verpackt und im WebView unter
 * `https://localhost` geladen. Wichtig:
 *
 *  - `androidScheme: 'https'` (Standard, hier explizit): Supabase erlaubt
 *    genau diese Herkunft per CORS, und ein sicherer Kontext ist
 *    Voraussetzung für `crypto.randomUUID` und `navigator.onLine`.
 *  - `webDir: 'dist'` – vor `npx cap sync` muss `npm run build` gelaufen sein.
 *  - Kein `server.url`: Die App lädt ihre Dateien aus dem App-Paket, ist damit
 *    vollständig offline startfähig und braucht keinen Server.
 *
 * SystemBars/Insets:
 *   Android 15+ erzwingt Edge-to-Edge. `insetsHandling: 'css'` sorgt dafür,
 *   dass die Web-Oberfläche die Systemleisten korrekt berücksichtigt und
 *   zusätzlich die CSS-Variablen `--safe-area-inset-*` gesetzt bekommt.
 *   Letzteres ist nötig, weil `env(safe-area-inset-*)` in Android-WebViews
 *   vor Version 140 falsche Werte liefert (Chromium-Bug 40699457).
 *
 *   `style: 'DARK'` bedeutet: helle Symbole auf dunklem Grund – passend zur
 *   durchgehend dunklen Oberfläche.
 */
const config: CapacitorConfig = {
  appId: 'de.krischi.prio',
  appName: 'prio',
  webDir: 'dist',
  android: {
    allowMixedContent: false,
  },
  server: {
    androidScheme: 'https',
  },
  plugins: {
    SystemBars: {
      insetsHandling: 'css',
      // Verhindert ein Springen des Layouts beim Start, weil der Wert schon
      // vor dem Auslesen des Meta-Tags feststeht.
      initialViewportFitValueHint: 'cover',
      style: 'DARK',
      hidden: false,
    },
  },
}

export default config
