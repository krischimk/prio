/**
 * Registrierung des Service Workers (PWA).
 *
 * Wichtig: Der Service Worker speichert ausschließlich die Anwendung selbst
 * (HTML/JS/CSS/Icons) für das Offline-Laden. Aufgaben und Listen liegen in
 * IndexedDB und werden hier bewusst nicht angefasst.
 *
 * In der Capacitor-App wird der Service Worker bewusst NICHT registriert.
 * Capacitor liefert die Dateien aus dem App-Paket unter `https://localhost`
 * aus – die Protokollprüfung allein würde also nicht greifen. Ein Service
 * Worker würde dort die alten Dateien aus dem Cache weiterreichen und ein
 * App-Update überdecken.
 */

interface CapacitorGlobal {
  isNativePlatform?: () => boolean
}

/** Erkennt, ob die Seite in einer Capacitor-App läuft (ohne harte Abhängigkeit). */
function isNativeApp(): boolean {
  if (typeof window === 'undefined') return false
  const capacitor = (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor
  return typeof capacitor?.isNativePlatform === 'function' && capacitor.isNativePlatform() === true
}

export function registerServiceWorker(): void {
  if (!import.meta.env.PROD) return
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return
  if (!('serviceWorker' in navigator)) return
  if (isNativeApp()) return

  const { protocol } = window.location
  if (protocol !== 'http:' && protocol !== 'https:') return

  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').catch(() => {
      // Die App funktioniert auch ohne Service Worker – nur eben nicht installierbar.
    })
  })
}
