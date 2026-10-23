import { createContext } from 'react'
import type { CalendarPreferences } from '../domain/calendar'
import type { LocalTask } from '../domain/types'

export const CalendarContext = createContext<{ tasks: LocalTask[]; preferences: CalendarPreferences; nowMs: number } | null>(null)
