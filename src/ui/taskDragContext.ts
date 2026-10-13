import { createContext } from 'react'
import type { DragDropEventHandlers } from '@dnd-kit/react'

export const TaskDragContext = createContext<{ register: (handlers: Partial<DragDropEventHandlers>) => () => void } | null>(null)
