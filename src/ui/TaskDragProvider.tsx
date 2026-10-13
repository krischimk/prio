import { useMemo, useRef, type ReactNode } from 'react'
import { DragDropProvider, type DragDropEventHandlers } from '@dnd-kit/react'
import { KeyboardSensor, PointerSensor, PointerActivationConstraints } from '@dnd-kit/dom'
import { RestrictToWindow } from '@dnd-kit/dom/modifiers'
import { TaskDragContext } from './taskDragContext'

// Maus/Stift bewegen gezielt; Touch hält lang, kurzes Wischen scrollt.
const pointer = PointerSensor.configure({
  activationConstraints: event => event.pointerType === 'touch'
    ? [new PointerActivationConstraints.Delay({ value: 400, tolerance: 6 })]
    : [new PointerActivationConstraints.Distance({ value: 6 })],
  // Der Griff umfasst die Aufgabe, aber kein darin enthaltenes Bedienelement.
  preventActivation: (event, source) => {
    const control = (event.target as HTMLElement).closest('button, input, select, textarea, a, [data-no-drag]')
    return control !== null && control !== source.handle
  },
})
const keyboard = KeyboardSensor.configure({ keyboardCodes: { ...KeyboardSensor.defaults.keyboardCodes, start: ['Space'] } })

/** Ein Ziehkontext verbindet Listenfläche und Desktop-Seitenleiste. */
export function TaskDragProvider({ children }: { children: ReactNode }) {
  const callbacks = useRef<Partial<DragDropEventHandlers>>({})
  const registry = useMemo(() => ({ register: (handlers: Partial<DragDropEventHandlers>) => {
    callbacks.current = handlers
    return () => { if (callbacks.current === handlers) callbacks.current = {} }
  } }), [])
  // Die Provider-Callbacks koordinieren React-Renders mit den Messungen und
  // Animationen der Bibliothek. Ein bloßer Monitor tut das in 0.5.0 nicht.
  return <TaskDragContext.Provider value={registry}><DragDropProvider
    onBeforeDragStart={(event, manager) => callbacks.current.onBeforeDragStart?.(event, manager)}
    onDragStart={(event, manager) => callbacks.current.onDragStart?.(event, manager)}
    onDragOver={(event, manager) => callbacks.current.onDragOver?.(event, manager)}
    onDragMove={(event, manager) => callbacks.current.onDragMove?.(event, manager)}
    onDragEnd={(event, manager) => callbacks.current.onDragEnd?.(event, manager)}
    modifiers={[RestrictToWindow]}
    sensors={defaults => [...defaults.filter(sensor => sensor !== PointerSensor && sensor !== KeyboardSensor), pointer, keyboard]}>{children}</DragDropProvider></TaskDragContext.Provider>
}
