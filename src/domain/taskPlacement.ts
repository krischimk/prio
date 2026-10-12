import type { LocalTask } from './types'

export interface TaskLocation { listId: string; sectionId: string | null; position: number }
export interface TaskPlacement {
  listId: string
  sectionId: string | null
  beforeTaskId: string | null
  expected?: TaskLocation
}

export function taskLocation(task: LocalTask): TaskLocation {
  return { listId: task.list_id, sectionId: task.section_id, position: task.position }
}

/** Einfügen zwischen Nachbarn ändert normalerweise nur die bewegte Aufgabe. */
export function insertionPosition(peers: LocalTask[], index: number): number | null {
  const previous = peers[index - 1]?.position
  const next = peers[index]?.position
  const value = previous !== undefined && next !== undefined ? previous + (next - previous) / 2
    : previous !== undefined ? previous + 1 : next !== undefined ? next - 1 : 0
  return Number.isFinite(value) && (previous === undefined || value > previous) && (next === undefined || value < next) ? value : null
}
