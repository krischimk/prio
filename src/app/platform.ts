/**
 * Erkennt, ob die App in einer Capacitor-Hülle läuft (Android/iOS) oder im
 * Browser.
 *
 * Bewusst ohne Import aus `@capacitor/core`: Der Aufruf läuft auch im Browser
 * und soll dort nicht zusätzliche Logik aus dem Plugin laden. Capacitor setzt
 * `window.Capacitor` selbst.
 */

interface CapacitorGlobal {
  isNativePlatform?: () => boolean
}

export function isNativeApp(): boolean {
  if (typeof window === 'undefined') return false
  const capacitor = (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor
  return typeof capacitor?.isNativePlatform === 'function' && capacitor.isNativePlatform() === true
}
