import { Capacitor } from '@capacitor/core'

/**
 * Erkennt, ob die App in einer Capacitor-Hülle läuft (Android/iOS) oder im
 * Browser.
 *
 * Bewusst über die offizielle API und nicht über ein eigenes Nachschauen an
 * `window.Capacitor`: Capacitor setzt dieses globale Objekt beim Import selbst
 * und behält dabei die von der nativen Brücke injizierte Plattform bei. Ein
 * eigener Zugriff hinge dagegen davon ab, wann und in welcher Schreibweise das
 * Objekt vorhanden ist.
 *
 * Wird unter anderem gebraucht für:
 *  - die Zurück-Taste (nur in der App sinnvoll),
 *  - die Registrierung des Service Workers (in der App unerwünscht),
 *  - die Wahl der Oberfläche (ein Telefon im Querformat ist breiter als 768 px).
 */
export function isNativeApp(): boolean {
  try {
    return Capacitor.isNativePlatform()
  } catch {
    // Ohne lauffähige Capacitor-Umgebung gilt die Web-Ansicht.
    return false
  }
}
