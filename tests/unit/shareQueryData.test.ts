import { expect, it } from 'vitest'
import { shareQueryData } from '../../src/app/shareQueryData'

it('behält unveränderte Abfragen einschließlich verschachtelter Daten bei', () => {
  const previous = { status: 'ready', tasks: [{ id: 'a', description: 'Notiz', checklist: [{ id: 'p', completed: false }] }] }
  expect(shareQueryData(previous, structuredClone(previous))).toBe(previous)
})

it('übernimmt Änderungen, erhält aber unveränderte und umsortierte Zeilen', () => {
  const a = Object.freeze({ id: 'a', title: 'A' }), b = Object.freeze({ id: 'b', title: 'B' })
  const previous: readonly { id: string; title: string }[] = Object.freeze([a, b])
  const result = shareQueryData(previous, [{ id: 'b', title: 'B' }, { id: 'a', title: 'Bearbeitet' }])
  expect(result[0]).toBe(b)
  expect(result[1]).toEqual({ id: 'a', title: 'Bearbeitet' })
  expect(previous).toEqual([a, b])
  expect(shareQueryData(previous, [structuredClone(b)])).toEqual([b])
})

it('erhält neue Felder alter Zeilen und entfernt tatsächlich gelöschte Angaben', () => {
  const old: { id: string; note?: string } = { id: 'a' }
  const updated = shareQueryData(old, { id: 'a', note: 'neu' })
  expect(updated).toEqual({ id: 'a', note: 'neu' })
  expect(shareQueryData(updated, old)).toEqual({ id: 'a' })
  expect(shareQueryData({ field: undefined }, {})).toEqual({})
})
