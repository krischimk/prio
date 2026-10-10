import { compareTasks, RESTORE_WINDOW_DAYS } from './ordering'
import type { LocalList, LocalTask, TaskReopenContext } from './types'

export const COMPLETION_RETENTION_MS = RESTORE_WINDOW_DAYS * 24 * 60 * 60 * 1000

/** Null bedeutet dauerhafte Aufbewahrung oder noch keine bestätigte Altfrist. */
export function completionDeadline(completedAt: string, keep: boolean): string | null {
  return keep ? null : new Date(Date.parse(completedAt) + COMPLETION_RETENTION_MS).toISOString()
}

export function completionExpired(task: LocalTask, nowMs: number): boolean {
  return task.expired_at !== null || (task.completed && task.completed_expires_at !== null && Date.parse(task.completed_expires_at) <= nowMs)
}

function sectionInList(sectionId: string | null, list: LocalList): string | null {
  return list.sections.some(section => section.id === sectionId) ? sectionId : null
}

export function captureReopenContext(task: LocalTask, list: LocalList, tasks: LocalTask[]): TaskReopenContext {
  const section_id = sectionInList(task.section_id, list)
  const peers = tasks.filter(row => row.list_id === list.id && !row.completed && row.deleted_at === null && sectionInList(row.section_id, list) === section_id).sort(compareTasks)
  const index = peers.findIndex(row => row.id === task.id)
  return { list_id: list.id, section_id, previous_id: peers[index - 1]?.id ?? null, next_id: peers[index + 1]?.id ?? null, successor: null }
}

/** Kennungen gelten nur in derselben Liste und im noch vorhandenen Bereich. */
export function reopenPlacement(task: LocalTask, list: LocalList, tasks: LocalTask[]): { sectionId: string | null; index: number; peers: LocalTask[] } {
  const context = task.reopen_context
  const original = context?.list_id === list.id
  const sectionId = sectionInList(original ? context.section_id : task.section_id, list)
  const peers = tasks.filter(row => row.id !== task.id && row.list_id === list.id && !row.completed && row.deleted_at === null && sectionInList(row.section_id, list) === sectionId).sort(compareTasks)
  if (!original) {
    const index = peers.findIndex(row => compareTasks(row, task) > 0)
    return { sectionId, peers, index: index < 0 ? peers.length : index }
  }
  const previous = peers.findIndex(row => row.id === context.previous_id)
  const next = peers.findIndex(row => row.id === context.next_id)
  return { sectionId, peers, index: previous >= 0 ? previous + 1 : next >= 0 ? next : peers.length }
}

export function successorSnapshot(task: LocalTask): NonNullable<TaskReopenContext['successor']> {
  const { dirty: _dirty, reopen_context: _context, ...snapshot } = task
  return snapshot
}
