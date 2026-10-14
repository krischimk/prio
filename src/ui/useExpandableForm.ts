import { useEffect, useRef, useState, type FocusEvent } from 'react'

/** Nach dem Klick einklappen: Die geklickte Zeile bleibt bis dahin an ihrem Platz. */
export function useExpandableForm(initiallyFocused = false) {
  const container = useRef<HTMLFormElement>(null)
  const [focused, setFocused] = useState(initiallyFocused)
  const pointerInFlight = useRef(false)
  useEffect(() => {
    const start = () => { pointerInFlight.current = true }
    const finish = (event: MouseEvent) => {
      const startedHere = pointerInFlight.current
      pointerInFlight.current = false
      // Der Klick, der dieses Formular erst öffnet, gehört nicht zum Formular.
      if (startedHere && !container.current?.contains(event.target as Node)) setFocused(false)
    }
    const cancel = () => { pointerInFlight.current = false }
    document.addEventListener('pointerdown', start, true)
    document.addEventListener('click', finish)
    document.addEventListener('pointercancel', cancel)
    document.addEventListener('keydown', cancel, true)
    return () => {
      document.removeEventListener('pointerdown', start, true)
      document.removeEventListener('click', finish)
      document.removeEventListener('pointercancel', cancel)
      document.removeEventListener('keydown', cancel, true)
    }
  }, [])
  return { container, focused, focus: () => setFocused(true), blur: (event: FocusEvent<HTMLFormElement>) => {
    if (!pointerInFlight.current && !event.currentTarget.contains(event.relatedTarget)) setFocused(false)
  } }
}
