import { useContext, useEffect, useRef } from 'react'
import { BackLayerContext } from './backLayerContext'

/**
 * Meldet eine schließbare Ebene bei der Zurück-Taste an.
 *
 * Typischer Einsatz: Ein Bearbeitungsformular oder ein Panel ist offen –
 * dann soll die Zurück-Taste genau das schließen, statt die App zu beenden.
 *
 * ```tsx
 * useBackLayer(editing, () => setEditing(false))
 * ```
 *
 * Die zuletzt geöffnete Ebene wird zuerst geschlossen.
 */
export function useBackLayer(active: boolean, onBack: () => void): void {
  const stack = useContext(BackLayerContext)

  // Der Handler wird in einem Effekt aktualisiert und nicht während des
  // Renderns geschrieben.
  const handlerRef = useRef(onBack)
  useEffect(() => {
    handlerRef.current = onBack
  }, [onBack])

  useEffect(() => {
    if (!stack || !active) return
    return stack.push(() => {
      handlerRef.current()
    })
  }, [stack, active])
}
