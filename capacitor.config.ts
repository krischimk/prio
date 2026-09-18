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
}

export default config
