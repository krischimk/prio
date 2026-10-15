import { createContext } from 'react'
import type { Navigation } from './navigation'

export const NavigationContext = createContext<Navigation | null>(null)
