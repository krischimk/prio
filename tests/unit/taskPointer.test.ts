import { describe, expect, it } from 'vitest'
import { projectTaskPointer } from '../../src/ui/taskDrag'

describe('sichtbarer Platz einer Zeiger-Ziehgeste', () => {
  it('wechselt am selben Ziel von nachher nach vorher und übernimmt nur die geänderten Gruppen', () => {
    const groups = { source: ['a', 'b'], target: ['c', 'd'], untouched: ['x'] }
    const below = projectTaskPointer(groups, 'a', 'c', true)
    expect(below.target).toEqual(['c', 'a', 'd'])
    const above = projectTaskPointer(below, 'a', 'c', false)
    expect(above.target).toEqual(['a', 'c', 'd'])
    expect(above.source).toEqual(['b'])
    expect(above.untouched).toBe(groups.untouched)
    expect(projectTaskPointer(above, 'a', 'c', false)).toBe(above)
    expect(groups.source).toEqual(['a', 'b'])
  })
  it('verschiebt innerhalb einer Gruppe, in leere Ziele und an Gruppenränder', () => {
    const groups = { tasks: ['a', 'b', 'c'], empty: [] }
    expect(projectTaskPointer(groups, 'a', 'c', false).tasks).toEqual(['b', 'a', 'c'])
    expect(projectTaskPointer(groups, 'a', 'c', true).tasks).toEqual(['b', 'c', 'a'])
    expect(projectTaskPointer(groups, 'a', 'empty', false).empty).toEqual(['a'])
    expect(projectTaskPointer(groups, 'c', 'tasks', false).tasks).toEqual(['c', 'a', 'b'])
    expect(projectTaskPointer(groups, 'a', 'tasks', true).tasks).toEqual(['b', 'c', 'a'])
    expect(projectTaskPointer(groups, 'a', 'a', true)).toBe(groups)
    expect(projectTaskPointer(groups, 'a', 'sidebar:unknown', true)).toBe(groups)
    expect(projectTaskPointer(groups, 'missing', 'b', true)).toBe(groups)
  })
})
