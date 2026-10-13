import { useContext, useLayoutEffect } from 'react'
import type { DragDropEventHandlers } from '@dnd-kit/react'
import { TaskDragContext } from './taskDragContext'

/** Der aktive Listenbaustein liefert die Handler an den gemeinsamen Provider. */
export function useTaskDragHandlers(handlers: Partial<DragDropEventHandlers>) {
  const registry = useContext(TaskDragContext)
  if (!registry) throw new Error('TaskList braucht einen TaskDragProvider.')
  useLayoutEffect(() => registry.register(handlers), [registry, handlers])
}
