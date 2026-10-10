import { describe, expect, it } from 'vitest'
import { captureReopenContext, completionDeadline, completionExpired, reopenPlacement } from '../../src/domain/taskLifecycle'
import { localList, localTask, T0 } from '../support/factories'

describe('Abschlussfrist und Rückkehr', () => {
  it('endet exakt nach sieben Tagen, ohne weitere Wiederherstellung', () => {
    const end = completionDeadline(T0, false)!
    const task = localTask({ completed: true, completed_expires_at: end })
    expect(completionExpired(task, Date.parse(end) - 1)).toBe(false)
    expect(completionExpired(task, Date.parse(end))).toBe(true)
    expect(completionDeadline(T0, true)).toBeNull()
  })
  it('nimmt den Vorgänger, sonst Nachfolger, sonst das Bereichsende', () => {
    const list = localList({ sections: [{ id: 'g', name: 'Gruppe' }] })
    const a = localTask({ id: 'a', section_id: 'g', position: 1 })
    const b = localTask({ id: 'b', section_id: 'g', position: 2 })
    const c = localTask({ id: 'c', section_id: 'g', position: 3 })
    b.reopen_context = captureReopenContext(b, list, [a, b, c])
    expect(reopenPlacement(b, list, [c, { ...a, position: 4 }]).index).toBe(2)
    expect(reopenPlacement(b, list, [c]).index).toBe(0)
    expect(reopenPlacement(b, list, []).index).toBe(0)
    expect(reopenPlacement(b, list, [{ ...a, list_id: 'other' }, { ...c, section_id: null }]).peers).toEqual([])
    expect(reopenPlacement(b, { ...list, sections: [] }, [a, c]).sectionId).toBeNull()
  })
})
