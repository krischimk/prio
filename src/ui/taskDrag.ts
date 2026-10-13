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

export const sidebarDropId = (listId: string) => `sidebar:${listId}`
export function sidebarDropListId(id: string | number | undefined): string | null {
  return typeof id === 'string' && id.startsWith('sidebar:') ? id.slice('sidebar:'.length) : null
}

/** Zeigerhälfte bestimmt den Platz auch dann, wenn dasselbe Ziel aktiv bleibt. */
export function projectTaskPointer(groups: DragGroups, sourceId: string, targetId: string, after: boolean): DragGroups {
  const sourceGroup = groupOfTask(groups, sourceId)
  const targetGroup = groupOfTask(groups, targetId) ?? (Object.hasOwn(groups, targetId) ? targetId : undefined)
  if (!sourceGroup || !targetGroup || sourceId === targetId) return groups
  const peers = groups[targetGroup].filter(id => id !== sourceId)
  const targetIndex = peers.indexOf(targetId)
  const index = targetIndex < 0 ? (after ? peers.length : 0) : targetIndex + (after ? 1 : 0)
  const next = [...peers.slice(0, index), sourceId, ...peers.slice(index)]
  if (sourceGroup === targetGroup && next.every((id, i) => id === groups[targetGroup][i])) return groups
  return { ...groups, [sourceGroup]: groups[sourceGroup].filter(id => id !== sourceId), [targetGroup]: next }
}
