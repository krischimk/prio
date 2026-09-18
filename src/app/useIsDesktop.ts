import { useEffect, useState } from 'react'

/**
 * Erkennt, ob die breite (Desktop-)Ansicht gilt.
 *
 * Die Umschaltung passiert bewusst in JavaScript statt über `hidden md:flex`:
 * Sonst stünden beide Oberflächen gleichzeitig im DOM – mit doppelten
 * Ereignisbehandlern und doppelt angemeldeten Ebenen im Back-Stack.
 *
 * Der Startwert wird direkt aus `matchMedia` gelesen (nicht in einem Effekt),
 * damit beim ersten Rendern kein falsches Layout aufblitzt.
 */
const DESKTOP_QUERY = '(min-width: 768px)'

function readIsDesktop(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    // Ohne matchMedia (z. B. in einfachen Testumgebungen) gilt die
    // Desktop-Ansicht – das entspricht dem Verhalten im Browser.
    return true
  }
  return window.matchMedia(DESKTOP_QUERY).matches
}

export function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(readIsDesktop)

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const media = window.matchMedia(DESKTOP_QUERY)
    const update = () => setIsDesktop(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  return isDesktop
}
