import { describe, expect, it } from 'vitest'
import { checklistProgress, mergeChecklist, parseChecklist, reorderChecklist, repeatChecklist, validateChecklist, visibleChecklistItems, type ChecklistItem } from '../../src/domain/checklist'
import { matchesTags, mergeTags, parseTags } from '../../src/domain/tags'

const item = (id: string, overrides: Partial<ChecklistItem> = {}): ChecklistItem => ({ id, text: id, completed: false, deleted_at: null, ...overrides })

describe('Checklisten', () => {
  it('blendet Erledigtes nur zur Anzeige aus und erhält Fortschritt und wiederherstellbare Punkte', () => {
    const items = [item('A', { completed: true }), item('B')]
    expect(visibleChecklistItems(items, true)).toEqual([items[1]])
    expect(checklistProgress(items)).toEqual({ completed: 1, total: 2 })
    expect(visibleChecklistItems(items, false)).toEqual(items)
    expect(items[0]).toMatchObject({ completed: true, deleted_at: null })
  })
  it('liest alten oder fehlerhaften Bestand und zählt nur vorhandene Punkte', () => {
    expect(parseChecklist(undefined)).toEqual([])
    expect(parseChecklist([null, { id: 'kaputt' }, item('A'), item('A')])).toEqual([item('A')])
    expect(checklistProgress([item('A', { completed: true }), item('B'), item('C', { deleted_at: '2026-10-16T10:00:00.000Z' })])).toEqual({ completed: 1, total: 2 })
    expect(() => validateChecklist([item('A', { text: ' ' })])).toThrow('darf nicht leer sein')
  })
  it('sortiert sichtbare Punkte und erhält ausgeblendete, gelöschte und ihre Gewichte', () => {
    const items = [item('A', { weight: 0.2 }), item('B', { completed: true, weight: 0.5 }), item('C', { weight: 0.3 }), item('D', { deleted_at: '2026-10-16T10:00:00.000Z' })]
    expect(reorderChecklist(items, 1, 0, true)).toEqual([items[2], items[1], items[0], items[3]])
    expect(reorderChecklist(items, 0, 2)).toEqual([items[1], items[2], items[0], items[3]])
    expect(items.map(row => row.id)).toEqual(['A', 'B', 'C', 'D'])
    expect(reorderChecklist(items, 1, 1, true)).toBe(items)
    expect(reorderChecklist(items, 2, 0, true)).toBe(items)
    expect(reorderChecklist(items, -1, 0, true)).toBe(items)
    const hidden = [item('A', { completed: true })]
    expect(reorderChecklist(hidden, 0, 1, true)).toBe(hidden)
  })
  it('begrenzt die Anzahl nicht und beginnt die nächste Wiederholung offen', () => {
    const list = Array.from({ length: 350 }, (_, i) => item(String(i), { completed: true }))
    expect(validateChecklist(list)).toHaveLength(350)
    expect(repeatChecklist(list).every(item => !item.completed)).toBe(true)
    expect(list.every(item => item.completed)).toBe(true)
  })
  it('führt verschiedene Punkte sowie Text und Häkchen unabhängig zusammen', () => {
    const base = [item('A'), item('B')]
    const local = [item('A', { text: 'Umbenannt' }), item('B', { completed: true })]
    const remote = [item('A', { completed: true }), item('B'), item('C')]
    expect(mergeChecklist(base, local, remote)).toEqual({ conflict: false, items: [item('A', { text: 'Umbenannt', completed: true }), item('B', { completed: true }), item('C')] })
  })
  it('erhält parallele Ergänzungen und verbindet Umsortieren mit einer Ergänzung', () => {
    const base = [item('A'), item('B')]
    expect(mergeChecklist(base, [base[1], base[0]], [...base, item('C')])).toEqual({ conflict: false, items: [base[1], base[0], item('C')] })
    expect(mergeChecklist([], [item('A')], [item('B')]).items).toHaveLength(2)
  })
  it('erkennt widersprüchliches Bearbeiten, Sortieren und Löschen', () => {
    const base = [item('A'), item('B'), item('C')]
    expect(mergeChecklist(base, [item('A', { text: 'Lokal' }), ...base.slice(1)], [item('A', { text: 'Cloud' }), ...base.slice(1)]).conflict).toBe(true)
    expect(mergeChecklist(base, [item('A', { deleted_at: '2026-10-16T10:00:00.000Z' }), ...base.slice(1)], [item('A', { completed: true }), ...base.slice(1)]).conflict).toBe(true)
    expect(mergeChecklist(base, [base[1], base[0], base[2]], [base[0], base[2], base[1]]).conflict).toBe(true)
  })
})

describe('Tags', () => {
  it('behält Namen, entfernt leere und doppelte Angaben und verknüpft Filter mit UND', () => {
    expect(parseTags([' Uni ', 'uni', '', 7, 'Zwei  Wörter'])).toEqual(['Uni', 'Zwei Wörter'])
    expect(matchesTags(['Uni', 'Dringend'], ['uni', 'dringend'])).toBe(true)
    expect(matchesTags(['Uni'], ['Uni', 'Dringend'])).toBe(false)
    expect(matchesTags([], [])).toBe(true)
  })
  it('erhält unabhängige Ergänzungen und Entfernen ohne alte Tags wiederzubeleben', () => {
    expect(mergeTags(['Alt'], ['Uni'], ['Alt', 'Privat'])).toEqual(['Privat', 'Uni'])
  })
})
