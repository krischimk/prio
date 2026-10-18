/** Persönliche, lokale Sicherungen verworfener Notizänderungen. */
export interface DiscardedNote {
  id: string
  taskId: string | null
  listId: string
  title: string
  description: string
  discardedAt: string
}
export const DISCARDED_NOTE_LIFETIME_MS = 24 * 60 * 60 * 1000
export function parseDiscardedNotes(raw: string | null, now: number): DiscardedNote[] {
  try {
    const data: unknown = JSON.parse(raw ?? '[]')
    if (!Array.isArray(data)) return []
    return data.filter((row): row is DiscardedNote => row !== null && typeof row === 'object'
      && typeof row.id === 'string' && (row.taskId === null || typeof row.taskId === 'string')
      && typeof row.listId === 'string' && typeof row.title === 'string' && typeof row.description === 'string'
      && typeof row.discardedAt === 'string' && Number.isFinite(Date.parse(row.discardedAt))
      && now - Date.parse(row.discardedAt) < DISCARDED_NOTE_LIFETIME_MS)
  } catch { return [] }
}
