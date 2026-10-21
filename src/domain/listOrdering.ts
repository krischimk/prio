import type { LocalList, LocalTask } from './types'
import { groupTasks } from './sections'
import { orderOverviewTasks } from './overviewOrdering'
import { ratingValues } from './rating'

/** Bereiche folgen ihrer höchsten Priorität; leere Bereiche bleiben zuletzt erreichbar. */
export function orderListTaskGroups(tasks: LocalTask[], list: LocalList, nowMs: number, detailedRatings = true) {
  const groups = groupTasks(orderOverviewTasks(tasks, [list], 'priority', nowMs, detailedRatings), list.sections)
  const score = (group: typeof groups[number]) => {
    const first = group.tasks[0]
    return !first ? -2 : first.rating && list.ratings_enabled ? ratingValues(first.rating, first.due_at, nowMs, first.checklist, detailedRatings).priority : -1
  }
  return groups.sort((a, b) => score(b) - score(a))
}
