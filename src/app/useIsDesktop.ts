import { useEffect, useState } from 'react'
import { isNativeApp } from './platform'

/**
 * Wählt zwischen mobiler und breiter Oberfläche.
 *
 * Die Umschaltung passiert bewusst in JavaScript statt über `hidden md:flex`:
 * Sonst stünden beide Ansichten gleichzeitig im DOM – mit doppelten
 * Ereignisbehandlern und doppelt angemeldeten Ebenen im Back-Stack.
 *
 * Zwei Schwellen, weil ein Telefon im Querformat leicht über der
 * Web-Grenze liegt:
 *  - **Browser:** ab 768 px die breite Ansicht.
 *  - **App:** erst ab 1024 px. Ein Telefon im Querformat kommt auf rund
 *    850 px und behält damit die mobile Ansicht; ein Tablet im Querformat
 *    (ab etwa 1280 px) bekommt die breite.
 */
const WEB_DESKTOP_QUERY = '(min-width: 768px)'
const NATIVE_DESKTOP_QUERY = '(min-width: 1024px)'

function desktopQuery(): string {
  return isNativeApp() ? NATIVE_DESKTOP_QUERY : WEB_DESKTOP_QUERY
}

function readIsDesktop(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    // Ohne matchMedia (z. B. in einfachen Testumgebungen) gilt die breite
    // Ansicht – das entspricht dem Verhalten im Browser.
    return true
  }
  return window.matchMedia(desktopQuery()).matches
}

export function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(readIsDesktop)

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const media = window.matchMedia(desktopQuery())
    const update = () => setIsDesktop(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  return isDesktop
}
