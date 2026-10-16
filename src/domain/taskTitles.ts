import type { LocalTask } from './types'
import { completionExpired } from './taskLifecycle'

/** Dieselbe Faltung verwendet private.task_title_key in PostgreSQL. */
export const taskTitleKey = (title: string) => title.trim().replace(/\s+/gu, ' ').toLowerCase()

/** Alte lokale Serien kennen nur successor_id; vor dem ersten Sync damit fortfahren. */
export function taskSeriesId(task: LocalTask, peers: LocalTask[]): string {
  if (task.recurrence_series_id) return task.recurrence_series_id
  const connected = new Set([task.id])
  let changed = true
  while (changed) {
    changed = false
    for (const row of peers) {
      if (connected.has(row.id) || (row.successor_id && connected.has(row.successor_id))) {
        for (const id of [row.id, row.successor_id]) if (id && !connected.has(id)) { connected.add(id); changed = true }
      }
    }
  }
  return peers.find(row => connected.has(row.id) && row.recurrence_series_id)?.recurrence_series_id ?? [...connected].sort()[0]
}

export function conflictingTaskTitle(task: LocalTask, peers: LocalTask[], nowMs: number): LocalTask | undefined {
  const key = taskTitleKey(task.title)
  return peers.find(row => row.id !== task.id && row.deleted_at === null && !completionExpired(row, nowMs)
    && taskTitleKey(row.title) === key
    && !(task.recurrence_series_id && taskSeriesId(row, peers) === task.recurrence_series_id))
}
