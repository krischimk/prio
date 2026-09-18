import { describe, expect, it } from 'vitest'
import { reconcileReminders } from '../../src/reminders/reminderReconciler'
import type { ReminderCandidate } from '../../src/reminders/reminderPlan'
import { T0, T1, T2 } from '../support/factories'

/**
 * Abgleich zwischen Soll- und Ist-Zustand (unit).
 *
 * Der wichtigste Punkt: Der Abgleich ist idempotent und lässt unveränderte
 * Termine in Ruhe – sonst würde bei jedem Sync alles neu geplant.
 */

function candidate(taskId: string, at: string, title = taskId): ReminderCandidate {
  return { taskId, at, title, body: 'Liste' }
}

/** Vergibt fortlaufende Nummern wie der Dienst. */
function counter(start = 0): () => number {
  let value = start
  return () => {
    value += 1
    return value
  }
}

describe('Erinnerungen abgleichen', () => {
  it('plant eine neue Aufgabe', () => {
    const actions = reconcileReminders([candidate('t1', T1)], [], counter())

    expect(actions.cancel).toEqual([])
    expect(actions.schedule).toHaveLength(1)
    expect(actions.schedule[0]).toMatchObject({ taskId: 't1', notificationId: 1, at: T1 })
    expect(actions.tracked).toEqual([{ taskId: 't1', notificationId: 1, at: T1 }])
  })

  it('lässt unveränderte Termine unangetastet', () => {
    const tracked = [{ taskId: 't1', notificationId: 7, at: T1 }]
    const actions = reconcileReminders([candidate('t1', T1)], tracked, counter(100))

    expect(actions.schedule).toEqual([])
    expect(actions.cancel).toEqual([])
    expect(actions.tracked).toEqual(tracked)
  })

  it('verschiebt einen Termin und behält die Nummer bei', () => {
    const tracked = [{ taskId: 't1', notificationId: 7, at: T1 }]
    const actions = reconcileReminders([candidate('t1', T2)], tracked, counter(100))

    expect(actions.cancel).toEqual([7])
    expect(actions.schedule).toHaveLength(1)
    expect(actions.schedule[0]).toMatchObject({ taskId: 't1', notificationId: 7, at: T2 })
    expect(actions.tracked).toEqual([{ taskId: 't1', notificationId: 7, at: T2 }])
  })

  it('bricht Termine ab, die nicht mehr gebraucht werden', () => {
    const tracked = [
      { taskId: 't1', notificationId: 7, at: T1 },
      { taskId: 't2', notificationId: 8, at: T1 },
    ]
    const actions = reconcileReminders([candidate('t1', T1)], tracked, counter(100))

    expect(actions.cancel).toEqual([8])
    expect(actions.schedule).toEqual([])
    expect(actions.tracked).toEqual([{ taskId: 't1', notificationId: 7, at: T1 }])
  })

  it('bricht alles ab, wenn nichts mehr geplant werden soll', () => {
    const tracked = [
      { taskId: 't1', notificationId: 7, at: T1 },
      { taskId: 't2', notificationId: 8, at: T2 },
    ]
    const actions = reconcileReminders([], tracked, counter(100))

    expect(actions.cancel).toEqual([7, 8])
    expect(actions.tracked).toEqual([])
  })

  it('vergibt für jede neue Aufgabe eine eigene Nummer', () => {
    const actions = reconcileReminders([candidate('t1', T1), candidate('t2', T2)], [], counter(5))

    expect(actions.schedule.map((entry) => entry.notificationId)).toEqual([6, 7])
  })

  it('behandelt hinzugefügte, verschobene und entfernte Aufgaben in einem Lauf', () => {
    const tracked = [
      { taskId: 'bleibt', notificationId: 1, at: T1 },
      { taskId: 'verschoben', notificationId: 2, at: T1 },
      { taskId: 'entfernt', notificationId: 3, at: T1 },
    ]
    const actions = reconcileReminders(
      [candidate('bleibt', T1), candidate('verschoben', T2), candidate('neu', T0)],
      tracked,
      counter(10),
    )

    expect(actions.cancel).toEqual([2, 3])
    expect(actions.schedule.map((entry) => entry.taskId).sort()).toEqual(['neu', 'verschoben'])
    expect(actions.tracked).toHaveLength(3)
  })

  it('ist idempotent: ein zweiter Lauf ohne Änderungen tut nichts', () => {
    const desired = [candidate('t1', T1), candidate('t2', T2)]
    const first = reconcileReminders(desired, [], counter())
    const second = reconcileReminders(desired, first.tracked, counter(100))

    expect(second.schedule).toEqual([])
    expect(second.cancel).toEqual([])
    expect(second.tracked).toEqual(first.tracked)
  })
})
