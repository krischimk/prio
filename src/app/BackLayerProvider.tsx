import { useEffect, useMemo, type ReactNode } from 'react'
import { createBackStack } from './backStack'
import { BackLayerContext } from './backLayerContext'
import { minimizeApp, registerNativeBackButton } from './nativeBackButton'

/**
 * Stellt den Back-Stack bereit und verbindet ihn mit der Android-Zurück-Taste.
 *
 * Reihenfolge beim Drücken der Taste:
 *   1. Ist eine Ebene offen (Formular, Panel, Bestätigung), wird sie geschlossen.
 *   2. Sonst wird die App in den Hintergrund geschickt – nicht hart beendet.
 *      Das entspricht dem Verhalten, das man von Android-Apps kennt.
 */
export function BackLayerProvider({ children }: { children: ReactNode }) {
  const stack = useMemo(() => createBackStack(), [])

  useEffect(() => {
    return registerNativeBackButton(() => {
      if (stack.handle()) return
      minimizeApp()
    })
  }, [stack])

  return <BackLayerContext.Provider value={stack}>{children}</BackLayerContext.Provider>
}
