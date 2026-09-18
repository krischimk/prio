import { describe, expect, it } from 'vitest'
import { planReminders } from '../../src/reminders/reminderPlan'
import { localList, localTask } from '../support/factories'

/**
 * Planung der Erinnerungen (unit).
 *
 * Nur offene Aufgaben mit einem Fälligkeitsdatum in der Zukunft führen zu einer
 * Erinnerung.
 */
const NOW = Date.parse('2026-01-01T12:00:00.000Z')
const PAST = '2026-01-01T11:00:00.000Z'
const SOON = '2026-01-01T13:00:00.000Z'
const LATER = '2026-01-02T09:00:00.000Z'

const lists = [localList({ id: 'list-1', name: 'Arbeit' })]

describe('Erinnerungen planen', () => {
  it('plant eine offene Aufgabe mit Fälligkeit in der Zukunft', () => {
    const tasks = [localTask({ id: 't1', list_id: 'list-1', title: 'Bericht', due_at: SOON })]
    const plan = planReminders(tasks, lists, NOW)

    expect(plan).toEqual([{ taskId: 't1', title: 'Bericht', body: 'Arbeit', at: SOON }])
  })

  it('ignoriert Aufgaben ohne Fälligkeitsdatum', () => {
    const tasks = [localTask({ id: 't1', due_at: null })]
    expect(planReminders(tasks, lists, NOW)).toHaveLength(0)
  })

  it('ignoriert erledigte Aufgaben', () => {
    const tasks = [localTask({ id: 't1', due_at: SOON, completed: true })]
    expect(planReminders(tasks, lists, NOW)).toHaveLength(0)
  })

  it('ignoriert gelöschte Aufgaben', () => {
    const tasks = [localTask({ id: 't1', due_at: SOON, deleted_at: SOON })]
    expect(planReminders(tasks, lists, NOW)).toHaveLength(0)
  })

  it('ignoriert Fälligkeiten in der Vergangenheit', () => {
    // Sonst würde nach einer Offline-Phase eine Welle alter Erinnerungen
    // ausgelöst – Lärm statt Nutzen.
    const tasks = [localTask({ id: 't1', due_at: PAST })]
    expect(planReminders(tasks, lists, NOW)).toHaveLength(0)
  })

  it('ignoriert den genauen jetzigen Zeitpunkt', () => {
    const tasks = [localTask({ id: 't1', due_at: new Date(NOW).toISOString() })]
    expect(planReminders(tasks, lists, NOW)).toHaveLength(0)
  })

  it('nennt die Liste als Kontext, sonst einen Ersatztext', () => {
    const tasks = [
      localTask({ id: 't1', list_id: 'list-1', due_at: SOON }),
      localTask({ id: 't2', list_id: 'unbekannt', due_at: SOON }),
    ]
    const plan = planReminders(tasks, lists, NOW)

    expect(plan.find((entry) => entry.taskId === 't1')?.body).toBe('Arbeit')
    expect(plan.find((entry) => entry.taskId === 't2')?.body).toBe('prio')
  })

  it('sortiert nach Zeitpunkt', () => {
    const tasks = [
      localTask({ id: 't1', title: 'Später', due_at: LATER }),
      localTask({ id: 't2', title: 'Früher', due_at: SOON }),
    ]
    expect(planReminders(tasks, lists, NOW).map((entry) => entry.title)).toEqual(['Früher', 'Später'])
  })

  it('normalisiert Zeitstempel verschiedener Schreibweisen', () => {
    const tasks = [localTask({ id: 't1', due_at: '2026-01-01T13:00:00.000000+00:00' })]
    expect(planReminders(tasks, lists, NOW)[0]?.at).toBe(SOON)
  })

  it('plant nichts ohne Aufgaben', () => {
    expect(planReminders([], lists, NOW)).toEqual([])
  })
})
