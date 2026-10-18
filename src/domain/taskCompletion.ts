import { isRecurrence, nextOccurrence, successorId, type Recurrence } from './recurrence'
import { captureReopenContext, completionDeadline, reopenPlacement, successorSnapshot } from './taskLifecycle'
import { repeatChecklist } from './checklist'
import { taskSeriesId } from './taskTitles'
import { sameData } from './equality'
import { insertionPosition } from './taskPlacement'
import type { LocalList, LocalTask } from './types'

export interface CompletionPlan { task: LocalTask; changes: LocalTask[] }

/** Gemeinsamer atomar zu speichernder Plan für Dexie und den MCP-Server. */
export async function planTaskCompletion(task: LocalTask, list: LocalList, tasks: LocalTask[], completed: boolean, now: string,
  calendarStep?: (date: Date, recurrence: Recurrence) => Date): Promise<CompletionPlan> {
  if (task.completed === completed) return { task, changes: [] }
  const stamp = { updated_at: now, dirty: 1 as const }
  if (!completed) {
    const changes: LocalTask[] = []
    const successor = tasks.find(row => row.id === task.successor_id)
    const original = task.reopen_context?.successor
    if (successor && original && !successor.completed && successor.deleted_at === null && sameData(successorSnapshot(successor), original)) {
      changes.push({ ...successor, deleted_at: now, ...stamp })
    }
    const available = tasks.filter(row => !changes.some(changed => changed.id === row.id && changed.deleted_at !== null))
    const placement = reopenPlacement(task, list, available)
    const reopened: LocalTask = { ...task, completed: false, completed_at: null, completed_expires_at: null,
      reopen_context: null, successor_id: null, section_id: placement.sectionId, ...stamp }
    const position = insertionPosition(placement.peers, placement.index)
    if (position !== null) reopened.position = position
    else {
      reopened.position = placement.index + 1
      changes.push(...placement.peers.map((row, index) => ({ ...row, position: index < placement.index ? index + 1 : index + 2, ...stamp })))
    }
    changes.push(reopened)
    return { task: reopened, changes }
  }
  const finished: LocalTask = { ...task, completed: true, completed_at: now,
    completed_expires_at: completionDeadline(now, list.keep_completed), reopen_context: captureReopenContext(task, list, tasks), ...stamp }
  if (!isRecurrence(task.recurrence) || !task.due_at) return { task: finished, changes: [finished] }
  const due = nextOccurrence(task.due_at, task.recurrence, now, calendarStep)
  const id = await successorId(task.id, due)
  const existing = tasks.find(row => row.id === id)
  const series = taskSeriesId(task, tasks)
  finished.recurrence_series_id = series
  finished.successor_id = id
  if (!existing || (existing.deleted_at !== null && !existing.expired_at)) {
    const successor: LocalTask = { ...task, id, recurrence_series_id: series, checklist: repeatChecklist(task.checklist), due_at: due,
      available_from: Date.parse(task.due_at) > Date.parse(now) ? task.due_at : null,
      completed: false, completed_at: null, completed_expires_at: null, expired_at: null, reopen_context: null, successor_id: null,
      created_at: existing?.created_at ?? now, deleted_at: null, ...stamp }
    finished.reopen_context!.successor = successorSnapshot(successor)
    return { task: finished, changes: [successor, finished] }
  }
  return { task: finished, changes: [finished] }
}
