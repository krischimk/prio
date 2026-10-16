import { describe, expect, it } from 'vitest'
import { appendChecklistItem, checklistRemaining, checklistWeights, deleteChecklistItem, mergeChecklist, setChecklistWeight, validateChecklist, withChecklistWeights, withoutChecklistWeights, type ChecklistItem } from '../../src/domain/checklist'
import { ratingValues, startRating } from '../../src/domain/rating'

const item = (id: string): ChecklistItem => ({ id, text: id, completed: false, deleted_at: null })
const sum = (items: ChecklistItem[]) => [...checklistWeights(items).values()].reduce((a, b) => a + b, 0)

describe('Gewichteter Checklistenfortschritt', () => {
  it('startet ohne individuelle Gewichte und zählt nach dem Abschalten wieder gleichmäßig', () => {
    const plain = appendChecklistItem([item('A')], item('B'))
    expect(plain.every(row => row.weight === undefined)).toBe(true)
    const weighted = setChecklistWeight(plain, 'A', 0.8).map(row => ({ ...row, completed: row.id === 'A' }))
    expect(checklistRemaining(weighted)).toBeCloseTo(0.2)
    const equal = withoutChecklistWeights(weighted)
    expect(checklistRemaining(equal)).toBe(0.5)
    expect(equal.every(row => !Object.hasOwn(row, 'weight'))).toBe(true)
    expect(checklistRemaining(appendChecklistItem(equal, item('C')))).toBeCloseTo(2 / 3)
    expect(weighted[0].weight).toBe(0.8)
  })
  it('beginnt mit gleichen Anteilen und erhält beim Umverteilen die Größenverhältnisse', () => {
    const base = [item('A'), item('B'), item('C')]
    expect([...checklistWeights(base).values()]).toEqual([1 / 3, 1 / 3, 1 / 3])
    const initial = base.map((row, i) => ({ ...row, weight: [0.5, 0.3, 0.2][i] }))
    const next = setChecklistWeight(initial, 'A', 0.6)
    expect(next.map(row => row.weight)).toEqual([0.6, 0.24, 0.16000000000000003])
    expect(sum(next)).toBeCloseTo(1)
    expect(initial[0].weight).toBe(0.5)
  })
  it('verteilt auch aus einem Alleingewicht zurück und hält einen einzelnen Punkt bei eins', () => {
    const base = [item('A'), item('B'), item('C')]
    const onlyA = setChecklistWeight(base, 'A', 1)
    expect(onlyA.map(row => row.weight)).toEqual([1, 0, 0])
    expect(setChecklistWeight(onlyA, 'A', 0.4).map(row => row.weight)).toEqual([0.4, 0.3, 0.3])
    expect(setChecklistWeight([item('A')], 'A', 0)[0].weight).toBe(1)
  })
  it('gibt einem neuen Punkt den neuen Durchschnitt und normiert nach dem Löschen', () => {
    const initial = setChecklistWeight([item('A'), item('B')], 'A', 0.75)
    const added = appendChecklistItem(initial, item('C'))
    expect(added[2].weight).toBeCloseTo(1 / 3)
    expect(added[0].weight! / added[1].weight!).toBeCloseTo(3)
    expect(sum(added)).toBeCloseTo(1)
    const removed = deleteChecklistItem(added, 'C', '2026-10-16T10:00:00.000Z')
    expect(removed[0].weight).toBeCloseTo(0.75)
    expect(removed[1].weight).toBeCloseTo(0.25)
    expect(checklistRemaining(deleteChecklistItem([item('A')], 'A', '2026-10-16T10:00:00.000Z'))).toBe(1)
  })
  it('hält die Summe bei vielen Änderungen stabil und normalisiert fachliche Eingaben', () => {
    let items = Array.from({ length: 31 }, (_, i) => item(String(i)))
    for (let n = 0; n < 150; n++) {
      items = setChecklistWeight(items, String(n % 31), (n % 11) / 10)
      expect(sum(items)).toBeCloseTo(1, 10)
      expect(items.every(row => row.weight! >= 0 && row.weight! <= 1)).toBe(true)
    }
    expect(validateChecklist([{ ...item('A'), weight: 0.8 }, { ...item('B'), weight: 0.8 }]).map(row => row.weight)).toEqual([0.5, 0.5])
  })
  it('berechnet reversiblen Restaufwand und beeinflusst die Automatik nur bei eingeschalteter Kopplung', () => {
    const initial = setChecklistWeight([item('A'), item('B')], 'A', 0.75)
    const checked = initial.map(row => ({ ...row, completed: row.id === 'A' }))
    const linked = { ...startRating(5), effort: 6, effortFromChecklist: true }
    const now = Date.parse('2026-12-15T18:00:00.000Z'), due = '2026-12-18T18:00:00.000Z'
    expect(ratingValues(linked, due, now, checked).effort).toBe(1.5)
    expect(ratingValues(linked, due, now, initial).effort).toBe(6)
    expect(ratingValues(linked, due, now, checked).urgency).toBeLessThan(ratingValues(linked, due, now, initial).urgency)
    expect(ratingValues({ ...linked, effortFromChecklist: false }, due, now, checked).effort).toBe(6)
    expect(ratingValues(linked, due, now, checked.map(row => ({ ...row, completed: true }))).effort).toBe(0)
  })
  it('verbindet Gewichten mit unabhängigem Abhaken, erkennt aber widersprüchliche Gewichtungen', () => {
    const base = withChecklistWeights([item('A'), item('B')])
    const local = setChecklistWeight(base, 'A', 0.8)
    const checked = base.map(row => ({ ...row, completed: row.id === 'A' }))
    const merged = mergeChecklist(base, local, checked)
    expect(merged.conflict).toBe(false)
    expect(merged.items[0]).toMatchObject({ completed: true, weight: 0.8 })
    expect(mergeChecklist(base, local, setChecklistWeight(base, 'A', 0.2)).conflict).toBe(true)
    const addedA = appendChecklistItem(base, item('C')), addedB = appendChecklistItem(base, item('D'))
    expect(sum(mergeChecklist(base, addedA, addedB).items)).toBeCloseTo(1)
  })
})
