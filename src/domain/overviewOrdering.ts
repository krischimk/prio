import type { LocalList, LocalTask, OverviewMode } from './types'
import { ratingValues } from './rating'
import type { CalendarPreferences } from './calendar'

export type PriorityRank = 1 | 2 | 3

/** Drei bewertete offene Aufgaben der gefilterten Ansicht, unabhängig von ihrer Reihenfolge. */
export function priorityRanks(tasks: LocalTask[], lists: LocalList[], nowMs: number, detailedRatings = true, calendar?: CalendarPreferences): ReadonlyMap<string, PriorityRank> {
  const enabled = new Set(lists.filter(list => list.ratings_enabled).map(list => list.id))
  const rated = tasks.filter(task => !task.completed && !task.deleted_at && !task.expired_at && task.rating && enabled.has(task.list_id))
  return new Map(orderOverviewTasks(rated, lists, 'priority', nowMs, detailedRatings, calendar).slice(0, 3).map((task, index) => [task.id, index + 1 as PriorityRank]))
}

/** Berechnete Sortierung verändert keine Positionen in den Ursprungslisten. */
export function orderOverviewTasks(tasks: LocalTask[], lists: LocalList[], mode: Exclude<OverviewMode, 'by_list'>, nowMs: number, detailedRatings = true, calendar?: CalendarPreferences): LocalTask[] {
  const ratedLists = new Set(lists.filter(list => list.ratings_enabled).map(list => list.id))
  const scores = new Map(mode === 'priority' ? tasks.map(task => [task.id, task.rating && ratedLists.has(task.list_id)
    ? ratingValues(task.rating, task.due_at, nowMs, task.checklist, detailedRatings, calendar).priority : null]) : [])
  return [...tasks].sort((a, b) => {
    if (mode === 'priority') {
      const left = scores.get(a.id) ?? null, right = scores.get(b.id) ?? null
      if (left === null && right !== null) return 1
      if (right === null && left !== null) return -1
      if (left !== null && right !== null && left !== right) return right - left
    }
    return b.created_at.localeCompare(a.created_at) || a.id.localeCompare(b.id)
  })
}
