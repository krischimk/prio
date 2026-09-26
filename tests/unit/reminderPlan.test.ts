import { describe, expect, it } from 'vitest'
import { planReminders, reminderTimeFor } from '../../src/reminders/reminderPlan'
import { localList, localTask } from '../support/factories'

/**
 * Planung der Erinnerungen (unit).
 *
 * Seit Erinnerung und Fälligkeit getrennt sind, entscheidet die **Form** der
 * Aufgabe, wann erinnert wird:
 *
 *   einmalig     → `remind_at`, ein absoluter Zeitpunkt
 *   wiederkehrend → `reminder_offset_minutes` gegenüber der Fälligkeit,
 *                   vorzeichenbehaftet – negativ heißt *nach* der Fälligkeit
 *
 * Eine Aufgabe ohne Erinnerung erinnert nicht, auch wenn sie eine Fälligkeit
 * hat.
 */
const NOW = Date.parse('2026-01-01T12:00:00.000Z')
const PAST = '2026-01-01T11:00:00.000Z'
const SOON = '2026-01-01T13:00:00.000Z'
const LATER = '2026-01-02T09:00:00.000Z'

const lists = [localList({ id: 'list-1', name: 'Arbeit' })]

/** Eine einmalige Aufgabe mit absolutem Erinnerungszeitpunkt. */
function einmalig(overrides: Parameters<typeof localTask>[0] = {}) {
  return localTask({ list_id: 'list-1', remind_at: SOON, ...overrides })
}

/** Eine wiederkehrende Aufgabe mit Vorlauf. */
function wiederkehrend(
  offsetMinutes: number | null,
  overrides: Parameters<typeof localTask>[0] = {},
) {
  return localTask({
    list_id: 'list-1',
    due_at: SOON,
    recurrence: 'daily',
    reminder_offset_minutes: offsetMinutes,
    ...overrides,
  })
}

describe('Erinnerungen planen', () => {
  it('plant eine einmalige Aufgabe zu ihrem absoluten Zeitpunkt', () => {
    const tasks = [einmalig({ id: 't1', title: 'Bericht' })]
    expect(planReminders(tasks, lists, NOW)).toEqual([
      { taskId: 't1', title: 'Bericht', body: 'Arbeit', at: SOON },
    ])
  })

  it('erinnert nicht, wenn keine Erinnerung gesetzt ist', () => {
    // Der Kern der Trennung: Eine Fälligkeit allein plant nichts mehr.
    const tasks = [localTask({ id: 't1', due_at: SOON, remind_at: null })]
    expect(planReminders(tasks, lists, NOW)).toHaveLength(0)
  })

  it('erinnert auch ohne Fälligkeit, wenn ein Zeitpunkt gesetzt ist', () => {
    const tasks = [einmalig({ id: 't1', due_at: null })]
    expect(planReminders(tasks, lists, NOW).map((entry) => entry.taskId)).toEqual(['t1'])
  })

  it('erinnert bei einem Erinnerungszeitpunkt in der Vergangenheit nicht', () => {
    // Sonst würde nach einer Offline-Phase eine Welle alter Erinnerungen
    // ausgelöst – Lärm statt Nutzen.
    const tasks = [einmalig({ id: 't1', remind_at: PAST })]
    expect(planReminders(tasks, lists, NOW)).toHaveLength(0)
  })

  it('ignoriert erledigte Aufgaben', () => {
    // Wichtig für den Nachlauf: Ist die Aufgabe abgehakt, verstummt auch die
    // Erinnerung, die nach der Fälligkeit liegen sollte.
    const tasks = [wiederkehrend(240, { id: 't1', completed: true })]
    expect(planReminders(tasks, lists, NOW)).toHaveLength(0)
  })

  it('ignoriert gelöschte Aufgaben', () => {
    const tasks = [einmalig({ id: 't1', deleted_at: SOON })]
    expect(planReminders(tasks, lists, NOW)).toHaveLength(0)
  })

  it('zieht bei wiederkehrenden Aufgaben den Vorlauf ab', () => {
    const tasks = [wiederkehrend(30, { id: 't1' })]
    expect(planReminders(tasks, lists, NOW)[0]?.at).toBe('2026-01-01T12:30:00.000Z')
  })

  it('erinnert bei Vorlauf 0 zur Fälligkeit', () => {
    const tasks = [wiederkehrend(0, { id: 't1' })]
    expect(planReminders(tasks, lists, NOW)[0]?.at).toBe(SOON)
  })

  it('erlaubt einen Nachlauf: negativer Vorlauf liegt hinter der Fälligkeit', () => {
    const tasks = [wiederkehrend(-240, { id: 't1' })]
    expect(planReminders(tasks, lists, NOW)[0]?.at).toBe('2026-01-01T17:00:00.000Z')
  })

  it('plant nichts, wenn die wiederkehrende Aufgabe keinen Vorlauf hat', () => {
    const tasks = [wiederkehrend(null, { id: 't1' })]
    expect(planReminders(tasks, lists, NOW)).toHaveLength(0)
  })

  it('ignoriert einen Vorlauf, wenn die Fälligkeit fehlt', () => {
    // Kann nach `alignReminder` nicht vorkommen; die Planung verlässt sich
    // nicht darauf.
    const tasks = [wiederkehrend(30, { id: 't1', due_at: null })]
    expect(planReminders(tasks, lists, NOW)).toHaveLength(0)
  })

  it('nennt die Liste als Kontext, sonst einen Ersatztext', () => {
    const tasks = [
      einmalig({ id: 't1', list_id: 'list-1' }),
      einmalig({ id: 't2', list_id: 'unbekannt' }),
    ]
    const plan = planReminders(tasks, lists, NOW)

    expect(plan.find((entry) => entry.taskId === 't1')?.body).toBe('Arbeit')
    expect(plan.find((entry) => entry.taskId === 't2')?.body).toBe('prio')
  })

  it('sortiert nach Zeitpunkt', () => {
    const tasks = [
      einmalig({ id: 't1', title: 'Später', remind_at: LATER }),
      einmalig({ id: 't2', title: 'Früher', remind_at: SOON }),
    ]
    expect(planReminders(tasks, lists, NOW).map((entry) => entry.title)).toEqual(['Früher', 'Später'])
  })

  it('normalisiert Zeitstempel verschiedener Schreibweisen', () => {
    const tasks = [einmalig({ id: 't1', remind_at: '2026-01-01T13:00:00.000000+00:00' })]
    expect(planReminders(tasks, lists, NOW)[0]?.at).toBe(SOON)
  })

  it('plant nichts ohne Aufgaben', () => {
    expect(planReminders([], lists, NOW)).toEqual([])
  })
})

describe('Erinnerungszeitpunkt einer Aufgabe', () => {
  it('gibt bei absoluten Erinnerungen den Zeitpunkt zurück', () => {
    expect(reminderTimeFor(einmalig({ remind_at: SOON }))).toBe(SOON)
  })

  it('rechnet bei wiederkehrenden Aufgaben aus der Fälligkeit', () => {
    expect(reminderTimeFor(wiederkehrend(90))).toBe('2026-01-01T11:30:00.000Z')
    expect(reminderTimeFor(wiederkehrend(-90))).toBe('2026-01-01T14:30:00.000Z')
  })

  it('gibt null zurück, wenn keine Erinnerung gesetzt ist', () => {
    expect(reminderTimeFor(localTask({ due_at: SOON }))).toBeNull()
    expect(reminderTimeFor(wiederkehrend(null))).toBeNull()
  })

  it('verträgt Zeilen aus der Zeit vor der Erinnerung', () => {
    // Solche Aufgaben haben die Felder gar nicht – `undefined` statt `null`.
    const alt = localTask()
    delete (alt as { remind_at?: unknown }).remind_at
    delete (alt as { reminder_offset_minutes?: unknown }).reminder_offset_minutes

    expect(reminderTimeFor(alt)).toBeNull()
    expect(planReminders([alt], lists, NOW)).toHaveLength(0)
  })
})
