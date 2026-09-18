import { App as CapacitorApp } from '@capacitor/app'
import { isNativeApp } from './platform'

/**
 * Verbindet die Android-Zurück-Taste mit der App.
 *
 * Im Browser passiert nichts – dort gibt es keine Hardware-Taste, und der
 * Browser-Zurück-Knopf gehört dem Browser.
 */
export function registerNativeBackButton(onBack: () => void): () => void {
  if (!isNativeApp()) return () => {}

  let removeListener: (() => void) | null = null
  let disposed = false

  void CapacitorApp.addListener('backButton', () => {
    onBack()
  })
    .then((handle) => {
      // Wurde in der Zwischenzeit abgemeldet, sofort wieder entfernen.
      if (disposed) {
        void handle.remove()
        return
      }
      removeListener = () => {
        void handle.remove()
      }
    })
    .catch(() => {
      // Ohne Plugin verhält sich die App wie bisher – kein Grund abzustürzen.
    })

  return () => {
    disposed = true
    removeListener?.()
    removeListener = null
  }
}

/** Schickt die App in den Hintergrund (Standardverhalten auf der Hauptebene). */
export function minimizeApp(): void {
  if (!isNativeApp()) return
  void CapacitorApp.minimizeApp().catch(() => undefined)
}
