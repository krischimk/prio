import { useEffect, useState, type ReactNode } from 'react'
import { createNavigation } from './navigation'
import { NavigationContext } from './navigationContext'
import { BackLayerContext } from './backLayerContext'
import { minimizeApp, registerNativeBackButton } from './nativeBackButton'

/**
 * Verbindet Dialogstapel und besuchte Listen mit Browser- und Android-Zurück.
 *
 * Reihenfolge:
 *   1. Ist eine Ebene offen (Formular, Panel, Bestätigung), wird sie geschlossen.
 *   2. Sonst wird die zuvor besuchte Liste geöffnet.
 *   3. Am Anfang des Verlaufs geht Android in den Hintergrund.
 *
 * Escape schließt ausschließlich die oberste offene Ebene. Die zentrale
 * Behandlung hält dieses Verhalten für alle Dialogformen gleich.
 */
export function BackLayerProvider({ children }: { children: ReactNode }) {
  const [navigation] = useState(() => createNavigation({
    push: entry => window.history.pushState({ prioNavigation: entry }, ''),
    replace: entry => window.history.replaceState({ ...window.history.state, prioNavigation: entry }, ''),
    go: delta => window.history.go(delta),
    listen: listener => {
      const onPop = (event: PopStateEvent) => listener(event.state?.prioNavigation)
      window.addEventListener('popstate', onPop)
      return () => window.removeEventListener('popstate', onPop)
    },
  }, crypto.randomUUID()))
  const stack = navigation.stack
  useEffect(() => navigation.start(), [navigation])

  useEffect(() => {
    return registerNativeBackButton(() => {
      if (navigation.back()) return
      minimizeApp()
    })
  }, [navigation])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // Ein verschachtelter Kalender/Popover kann Escape bereits verarbeitet
      // haben. Derselbe Tastendruck darf danach nicht noch den Editor schließen.
      if (event.key !== 'Escape' || event.defaultPrevented) return
      // Bewusst ohne `minimizeApp`: Escape beendet die App nicht, es schließt
      // nur die oberste offene Ebene.
      stack.handle()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [stack])

  return <NavigationContext.Provider value={navigation}><BackLayerContext.Provider value={stack}>{children}</BackLayerContext.Provider></NavigationContext.Provider>
}
