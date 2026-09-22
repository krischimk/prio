import { App } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'

/**
 * Die laufende Version der App.
 *
 * In der App wird die **installierte** Version gelesen, nicht die beim Bauen
 * eingetragene. Sonst hielte sich eine ältere Fassung für aktuell, sobald die
 * Versionsnummer im Projekt weitergezählt wurde.
 */
export async function currentVersion(): Promise<string> {
  if (Capacitor.isNativePlatform()) {
    try {
      const info = await App.getInfo()
      if (info?.version) return info.version
    } catch {
      // Fällt auf den eingebetteten Wert zurück.
    }
  }
  return __APP_VERSION__
}
