import { useEffect, useMemo, type ReactNode } from 'react'
import { createBackStack } from './backStack'
import { BackLayerContext } from './backLayerContext'
import { minimizeApp, registerNativeBackButton } from './nativeBackButton'

/**
 * Stellt den Back-Stack bereit und verbindet ihn mit beiden Wegen zurück.
 *
 * Reihenfolge:
 *   1. Ist eine Ebene offen (Formular, Panel, Bestätigung), wird sie geschlossen.
 *   2. Sonst wird die App in den Hintergrund geschickt – nicht hart beendet.
 *      Das entspricht dem Verhalten, das man von Android-Apps kennt.
 *
 * Auf dem Rechner gibt es keine Zurück-Taste; dort ist **Escape** der Weg
 * zurück. Beide Wege teilen sich denselben Stapel und schließen damit dieselbe
 * Ebene. Vorher kannte nur das Menü der mobilen Ansicht Escape – der
 * Wiederherstellen-Dialog behauptete in seinem Kommentar dagegen, Escape
 * schließe ihn bereits. Die Tastatur wird deshalb hier behandelt und nicht in
 * jeder Komponente: Sonst hat jeder Dialog seine eigene Regel und einer
 * vergisst sie.
 */
export function BackLayerProvider({ children }: { children: ReactNode }) {
  const stack = useMemo(() => createBackStack(), [])

  useEffect(() => {
    return registerNativeBackButton(() => {
      if (stack.handle()) return
      minimizeApp()
    })
  }, [stack])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      // Bewusst ohne `minimizeApp`: Escape beendet die App nicht, es schließt
      // nur die oberste offene Ebene.
      stack.handle()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [stack])

  return <BackLayerContext.Provider value={stack}>{children}</BackLayerContext.Provider>
}
