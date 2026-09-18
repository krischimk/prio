/**
 * Registrierung des Service Workers (PWA).
 *
 * Wichtig: Der Service Worker speichert ausschließlich die Anwendung selbst
 * (HTML/JS/CSS/Icons) für das Offline-Laden. Aufgaben und Listen liegen in
 * IndexedDB und werden hier bewusst nicht angefasst.
 *
 * In Capacitor wird die App über ein eigenes Schema geladen; dort ist kein
 * Service Worker nötig und teilweise nicht erlaubt, deshalb wird nur unter
 * http(s) registriert.
 */
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD) return
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return
  if (!('serviceWorker' in navigator)) return

  const { protocol } = window.location
  if (protocol !== 'http:' && protocol !== 'https:') return

  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').catch(() => {
      // Die App funktioniert auch ohne Service Worker – nur eben nicht installierbar.
    })
  })
}
