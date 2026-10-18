import { afterEach, expect, it, vi } from 'vitest'
import { LocalDatabase } from '../../src/db/localDb'
import { createRepositories } from '../../src/db/repositories'
import { createFixedClock } from '../../src/domain/clock'
import { DISCARDED_NOTE_LIFETIME_MS, parseDiscardedNotes } from '../../src/domain/discardedNotes'
import { withChangeTracking } from '../../src/app/trackedRepositories'

const db = new LocalDatabase(`discarded-notes-${crypto.randomUUID()}`)
const clock = createFixedClock()
afterEach(async () => { await db.delete() })
it('keeps every distinct discarded note across reopening, with exact text and account isolation', async () => {
  await db.open()
  const repositories = createRepositories(db, clock)
  const note = { taskId: 'task', listId: 'list', title: 'Titel', description: '  **Entwurf**\n\nAbsatz  ' }
  await Promise.all([repositories.rememberDiscardedNote(note), repositories.rememberDiscardedNote({ ...note, description: 'Weitere Änderung' })])
  await repositories.rememberDiscardedNote({ ...note, description: 'Weitere Änderung' })
  db.close(); await db.open()
  expect((await repositories.listDiscardedNotes()).map(row => row.description)).toEqual(['Weitere Änderung', note.description])
  const other = new LocalDatabase(`other-${crypto.randomUUID()}`)
  await other.open()
  expect(await createRepositories(other, clock).listDiscardedNotes()).toEqual([])
  await other.delete()
})
it('expires after exactly 24 hours, physically prunes and never triggers cloud work', async () => {
  await db.open()
  const cloud = vi.fn(), local = vi.fn()
  const repositories = withChangeTracking(createRepositories(db, clock), cloud, local)
  await repositories.rememberDiscardedNote({ taskId: null, listId: 'list', title: '', description: '' })
  clock.advance(DISCARDED_NOTE_LIFETIME_MS - 1)
  expect(await repositories.listDiscardedNotes()).toHaveLength(1)
  expect(await repositories.pruneDiscardedNotes()).toBe(false)
  expect(local).toHaveBeenCalledTimes(1)
  clock.advance(1)
  expect(await repositories.listDiscardedNotes()).toEqual([])
  expect(await repositories.pruneDiscardedNotes()).toBe(true)
  expect(await db.meta.count()).toBe(0)
  expect(cloud).not.toHaveBeenCalled()
})
it('tolerates broken local metadata', () => {
  expect(parseDiscardedNotes('{', clock.nowMs())).toEqual([])
  expect(parseDiscardedNotes('[null,{},3]', clock.nowMs())).toEqual([])
})
