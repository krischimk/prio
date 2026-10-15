import { createContext } from 'react'
import type { DragDropEventHandlers } from '@dnd-kit/react'

export type DragKind = 'task' | 'list'
export const TaskDragContext = createContext<{ register: (kind: DragKind, handlers: Partial<DragDropEventHandlers>) => () => void } | null>(null)
