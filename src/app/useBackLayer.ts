import { useContext, useLayoutEffect, useRef } from 'react'
import { BackLayerContext } from './backLayerContext'

/**
 * Meldet eine schließbare Ebene bei der Zurück-Taste an.
 *
 * Typischer Einsatz: Ein Bearbeitungsformular oder ein Panel ist offen –
 * dann soll die Zurück-Taste genau das schließen, statt die App zu beenden.
 *
 * ```tsx
 * useBackLayer(editing, () => setEditing(false), 'aufgabe-bearbeiten')
 * ```
 *
 * Die zuletzt geöffnete Ebene wird zuerst geschlossen.
 *
 * `name` ist freiwillig, macht den Zustand aber lesbar: `backStack.top()` sagt
 * dann „liste-verwalten“ statt nur „irgendetwas ist offen“. Für einen späteren
 * Router ist das der Anknüpfungspunkt.
 */
export function useBackLayer(active: boolean, onBack: () => void, name?: string, onHistoryBack = onBack): void {
  const stack = useContext(BackLayerContext)

  // Der Handler wird in einem Effekt aktualisiert und nicht während des
  // Renderns geschrieben.
  const handlerRef = useRef(onBack)
  const historyRef = useRef(onHistoryBack)
  useLayoutEffect(() => {
    handlerRef.current = onBack
    historyRef.current = onHistoryBack
  }, [onBack, onHistoryBack])

  useLayoutEffect(() => {
    if (!stack || !active) return
    return stack.push(() => {
      handlerRef.current()
    }, name, () => historyRef.current())
  }, [stack, active, name])
}
