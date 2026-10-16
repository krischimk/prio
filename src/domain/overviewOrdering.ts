import type { LocalList, LocalTask, OverviewMode } from './types'
import { ratingValues } from './rating'

/** Berechnete Sortierung verändert keine Positionen in den Ursprungslisten. */
export function orderOverviewTasks(tasks: LocalTask[], lists: LocalList[], mode: Exclude<OverviewMode, 'by_list'>, nowMs: number): LocalTask[] {
  const ratedLists = new Set(lists.filter(list => list.ratings_enabled).map(list => list.id))
  const scores = new Map(tasks.map(task => [task.id, task.rating && ratedLists.has(task.list_id)
    ? ratingValues(task.rating, task.due_at, nowMs, task.checklist).priority : null]))
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
