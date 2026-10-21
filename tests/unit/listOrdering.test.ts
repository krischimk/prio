import { describe, it, expect } from 'vitest'
import { orderListTaskGroups } from '../../src/domain/listOrdering'
import { startRating } from '../../src/domain/rating'
import { localList, localTask, T0 } from '../support/factories'

it('ordnet Bereiche nach ihrer höchsten Priorität und Aufgaben innerhalb der Bereiche absteigend', () => {
  const list = localList({ ratings_enabled: true, sections: [{ id: 'b', name: 'B' }, { id: 'a', name: 'A' }, { id: 'empty', name: 'Leer' }] })
  const task = (id: string, section_id: string | null, value: number | null) => localTask({ id, section_id, position: 7,
    rating: value === null ? null : { ...startRating(value), urgency: value, urgencyMode: 'manual' } })
  const rows = [task('B', 'b', 5), task('A-low', 'a', 2), task('A-high', 'a', 8), task('unrated', null, null)]
  const result = orderListTaskGroups(rows, list, Date.parse(T0))
  expect(result.map(group => group.section?.id ?? null)).toEqual(['a', 'b', null, 'empty'])
  expect(result.flatMap(group => group.tasks.map(task => task.id))).toEqual(['A-high', 'A-low', 'B', 'unrated'])
  expect(rows.every(task => task.position === 7)).toBe(true)
})

describe('Randfälle der Bereichspriorität', () => {
  it('berechnet die Bereichsreihenfolge in der einfachen Ansicht aus automatischer Dringlichkeit', () => {
    const list = localList({ ratings_enabled: true, sections: [{ id: 'due', name: 'Fällig' }, { id: 'later', name: 'Später' }] })
    const rows = [localTask({ section_id: 'due', due_at: T0, rating: { ...startRating(10), urgency: 0, urgencyMode: 'manual' } }),
      localTask({ id: 'later', section_id: 'later', rating: { ...startRating(8), urgency: 8, urgencyMode: 'manual' } })]
    expect(orderListTaskGroups(rows, list, Date.parse(T0), false).filter(group => group.tasks.length).map(group => group.section?.id)).toEqual(['due', 'later'])
    expect(orderListTaskGroups(rows, list, Date.parse(T0), true).filter(group => group.tasks.length).map(group => group.section?.id)).toEqual(['later', 'due'])
  })
  it('behandelt echte Null vor unbewerteten und leeren Bereichen; Gleichstände behalten die Bereichsreihenfolge', () => {
    const list = localList({ ratings_enabled: true, sections: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }] })
    const zero = { ...startRating(0), urgency: 0, urgencyMode: 'manual' as const }
    const rows = [localTask({ id: 'a', section_id: 'a', rating: zero }), localTask({ id: 'b', section_id: 'b', rating: zero }), localTask({ id: 'u', rating: null })]
    expect(orderListTaskGroups(rows, list, Date.parse(T0)).map(group => group.section?.id ?? null)).toEqual(['a', 'b', null])
  })
})
