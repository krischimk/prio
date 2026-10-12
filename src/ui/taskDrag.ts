import type { LocalList, LocalTask } from '../domain/types'
import { groupTasks } from '../domain/sections'

export type DragGroups = Record<string, string[]>
export const taskGroupId = (listId: string, sectionId: string | null) => `group:${JSON.stringify([listId, sectionId])}`
export function taskGroupLocation(id: string): { listId: string; sectionId: string | null } {
  const [listId, sectionId] = JSON.parse(id.slice('group:'.length)) as [string, string | null]
  return { listId, sectionId }
}
export function dragGroups(lists: LocalList[], tasks: LocalTask[]): DragGroups {
  return Object.fromEntries(lists.flatMap(list => groupTasks(tasks.filter(task => task.list_id === list.id), list.sections)
    .map(group => [taskGroupId(list.id, group.section?.id ?? null), group.tasks.map(task => task.id)])))
}
export function groupOfTask(groups: DragGroups, taskId: string): string | undefined {
  return Object.keys(groups).find(id => groups[id].includes(taskId))
}
