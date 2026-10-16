import { describe, expect, it } from 'vitest'
import { orderOverviewTasks } from '../../src/domain/overviewOrdering'
import { startRating } from '../../src/domain/rating'
import { localList, localTask, T0, T1 } from '../support/factories'

describe('Prioritätssortierung der Gesamtansicht', () => {
  const lists = [localList({ ratings_enabled: true }), localList({ id: 'off', ratings_enabled: false })]
  const rating = (value: number) => ({ ...startRating(value), urgency: value, urgencyMode: 'manual' as const })
  const ids = (tasks: ReturnType<typeof localTask>[], now = Date.parse(T0)) => orderOverviewTasks(tasks, lists, 'priority', now).map(task => task.id)
  it('sortiert auch Bewertung null und echte Null verschieden und ignoriert ausgeschaltete Listenbewertungen', () => {
    const tasks = [localTask({ id: 'unrated', created_at: T1 }), localTask({ id: 'zero', rating: rating(0) }),
      localTask({ id: 'off', list_id: 'off', rating: rating(10) }), localTask({ id: 'high', rating: rating(10) })]
    expect(ids(tasks)).toEqual(['high', 'zero', 'unrated', 'off'])
    expect(tasks[0].id).toBe('unrated')
  })
  it('bleibt bei Gleichstand stabil und berücksichtigt die aktuelle automatische Dringlichkeit', () => {
    const tasks = [localTask({ id: 'B', rating: rating(5), created_at: T1 }), localTask({ id: 'A', rating: rating(5), created_at: T1 }),
      localTask({ id: 'C', rating: startRating(5), due_at: '2026-01-05T10:00:00Z' })]
    expect(ids(tasks)).toEqual(['A', 'B', 'C'])
    expect(ids(tasks, Date.parse('2026-01-05T10:00:00Z'))).toEqual(['C', 'A', 'B'])
    expect(orderOverviewTasks(tasks, lists, 'newest', Date.parse(T0)).map(task => task.id)).toEqual(['A', 'B', 'C'])
  })
  it('berechnet die Reihenfolge nach Checklistenfortschritt neu, ohne gespeicherte Positionen zu ändern', () => {
    const checklist = ['A', 'B'].map((id, index) => ({ id, text: id, completed: false, deleted_at: null, weight: index ? 0.25 : 0.75 }))
    const coupled = localTask({ id: 'coupled', rating: { ...startRating(5), effort: 10 }, due_at: '2026-01-05T10:00:00Z', checklist, position: 4 })
    const middle = localTask({ id: 'middle', rating: rating(5), position: 3 })
    expect(ids([middle, coupled])).toEqual(['coupled', 'middle'])
    const progressed = { ...coupled, checklist: checklist.map(item => ({ ...item, completed: item.id === 'A' })) }
    expect(ids([middle, progressed])).toEqual(['middle', 'coupled'])
    expect([middle.position, coupled.position]).toEqual([3, 4])
  })
})
