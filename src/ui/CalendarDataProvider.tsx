import { useMemo, type ReactNode } from 'react'
import { useTasksQuery } from '../app/hooks'
import { parseCalendarPreferences } from '../domain/calendar'
import type { LocalList, LocalUserPreference } from '../domain/types'
import { CalendarContext } from './calendarContext'
import { useWorkspace } from '../app/useWorkspace'

/** Gemeinsame, über Hooks gelesene Daten für Monatsansicht und alle Date-Picker. */
export function CalendarDataProvider({ lists, preference, children }: { lists: LocalList[]; preference: LocalUserPreference | null; children: ReactNode }) {
  const query = useTasksQuery(lists.map(list => list.id), true)
  const { nowMs } = useWorkspace()
  const preferences = useMemo(() => parseCalendarPreferences(preference?.calendar_preferences), [preference?.calendar_preferences])
  const value = useMemo(() => ({ tasks: query.tasks, preferences, nowMs }), [query.tasks, preferences, nowMs])
  return <CalendarContext value={value}>{children}</CalendarContext>
}
