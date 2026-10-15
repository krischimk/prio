import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { DragDropProvider, type DragDropEventHandlers } from '@dnd-kit/react'
import { KeyboardSensor, PointerSensor, PointerActivationConstraints } from '@dnd-kit/dom'
import { RestrictToWindow } from '@dnd-kit/dom/modifiers'
import { TaskDragContext, type DragKind } from './taskDragContext'
import { useIsDesktop } from '../app/useIsDesktop'
import { useView } from './useView'
import { sidebarDropListId } from './taskDrag'
import { createTaskDragEdges } from './mobile/dragEdges'
import { isKeyboardEvent } from '@dnd-kit/dom/utilities'

// Maus/Stift bewegen gezielt; Touch hält lang, kurzes Wischen scrollt.
const pointer = PointerSensor.configure({
  activationConstraints: event => event.pointerType === 'touch'
    ? [new PointerActivationConstraints.Delay({ value: 400, tolerance: 6 })]
    : [new PointerActivationConstraints.Distance({ value: 6 })],
  // Der Griff umfasst die Aufgabe, aber kein darin enthaltenes Bedienelement.
  preventActivation: (event, source) => {
    const control = (event.target as HTMLElement).closest('button, input, select, textarea, label, a, [data-no-drag]')
    return control !== null && control !== source.handle
  },
})
const keyboard = KeyboardSensor.configure({ keyboardCodes: { ...KeyboardSensor.defaults.keyboardCodes, start: ['Space'] } })

/** Ein Ziehkontext verbindet Listenfläche und Desktop-Seitenleiste. */
export function TaskDragProvider({ children }: { children: ReactNode }) {
  const desktop = useIsDesktop()
  const { drawerMode, setDrawerMode } = useView()
  const drawer = useRef(drawerMode)
  useLayoutEffect(() => { drawer.current = drawerMode }, [drawerMode])
  // Die Fabrik speichert den Leser; erst ein späteres Ziehereignis ruft ihn auf.
  // oxlint-disable-next-line react/refs
  const [edges] = useState(() => createTaskDragEdges({ mode: () => drawer.current, width: () => window.innerWidth, change: setDrawerMode }))
  useEffect(() => () => edges.stop(), [edges])
  const callbacks = useRef<Partial<Record<DragKind, Partial<DragDropEventHandlers>>>>({})
  const registry = useMemo(() => ({ register: (kind: DragKind, handlers: Partial<DragDropEventHandlers>) => {
    callbacks.current[kind] = handlers
    return () => { if (callbacks.current[kind] === handlers) delete callbacks.current[kind] }
  } }), [])
  // Die Provider-Callbacks koordinieren React-Renders mit den Messungen und
  // Animationen der Bibliothek. Ein bloßer Monitor tut das in 0.5.0 nicht.
  return <TaskDragContext.Provider value={registry}><DragDropProvider
    onBeforeDragStart={(event, manager) => callbacks.current[event.operation.source?.type === 'list' ? 'list' : 'task']?.onBeforeDragStart?.(event, manager)}
    onDragStart={(event, manager) => {
      edges.start(!desktop && event.operation.source?.type === 'task' && !!event.operation.activatorEvent && !isKeyboardEvent(event.operation.activatorEvent))
      callbacks.current[event.operation.source?.type === 'list' ? 'list' : 'task']?.onDragStart?.(event, manager)
    }}
    onDragOver={(event, manager) => callbacks.current[event.operation.source?.type === 'list' ? 'list' : 'task']?.onDragOver?.(event, manager)}
    onDragMove={(event, manager) => {
      if (event.to) edges.move(event.to.x)
      callbacks.current[event.operation.source?.type === 'list' ? 'list' : 'task']?.onDragMove?.(event, manager)
    }}
    onDragEnd={(event, manager) => {
      edges.stop()
      const cancel = drawer.current === 'drag' && !sidebarDropListId(event.operation.target?.id)
      callbacks.current[event.operation.source?.type === 'list' ? 'list' : 'task']?.onDragEnd?.({ ...event, canceled: event.canceled || cancel }, manager)
      if (drawer.current === 'drag') setDrawerMode('closed')
    }}
    modifiers={[RestrictToWindow]}
    sensors={defaults => [...defaults.filter(sensor => sensor !== PointerSensor && sensor !== KeyboardSensor), pointer, keyboard]}>{children}</DragDropProvider></TaskDragContext.Provider>
}
