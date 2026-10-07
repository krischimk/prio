import { describe, expect, it } from 'vitest'
import { planReminders, reminderTimesFor } from '../../src/reminders/reminderPlan'
import { localList, localTask } from '../support/factories'

/**
 * Planung der Erinnerungen (unit).
 *
 * Seit Erinnerung und Fälligkeit getrennt sind, entscheidet die **Form** der
 * Aufgabe, wann erinnert wird:
 *
 *   einmalig     → absolute Zeitpunkte
 *   wiederkehrend → Vorläufe gegenüber der Fälligkeit, vorzeichenbehaftet –
 *                   negativ heißt *nach* der Fälligkeit
 *
 * **Jede Erinnerung wird ein eigener Termin.** Eine Aufgabe ohne Erinnerung
 * erinnert nicht, auch wenn sie eine Fälligkeit hat.
 */
const NOW = Date.parse('2026-01-01T12:00:00.000Z')
const PAST = '2026-01-01T11:00:00.000Z'
const SOON = '2026-01-01T13:00:00.000Z'
const LATER = '2026-01-02T09:00:00.000Z'

const lists = [localList({ id: 'list-1', name: 'Arbeit' })]

/** Eine einmalige Aufgabe mit absoluten Erinnerungen. */
function einmalig(overrides: Parameters<typeof localTask>[0] = {}) {
  return localTask({
    list_id: 'list-1',
    reminders: [{ form: 'absolute', at: SOON }],
    ...overrides,
  })
}

/** Eine wiederkehrende Aufgabe mit Vorläufen. */
function wiederkehrend(offsets: number[], overrides: Parameters<typeof localTask>[0] = {}) {
  return localTask({
    list_id: 'list-1',
    due_at: SOON,
    recurrence: 'daily',
    reminders: offsets.map((minutes) => ({ form: 'offset' as const, minutes })),
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
    // Der Kern der Trennung: Eine Fälligkeit allein plant nichts.
    const tasks = [localTask({ id: 't1', due_at: SOON, reminders: [] })]
    expect(planReminders(tasks, lists, NOW)).toHaveLength(0)
  })

  it('macht aus jeder Erinnerung einen eigenen Termin', () => {
    const tasks = [
      einmalig({
        id: 't1',
        reminders: [
          { form: 'absolute', at: SOON },
          { form: 'absolute', at: LATER },
        ],
      }),
    ]
    const plan = planReminders(tasks, lists, NOW)

    expect(plan.map((entry) => entry.at)).toEqual([SOON, LATER])
    expect(plan.every((entry) => entry.taskId === 't1')).toBe(true)
  })

  it('erinnert auch ohne Fälligkeit, wenn ein Zeitpunkt gesetzt ist', () => {
    const tasks = [einmalig({ id: 't1', due_at: null })]
    expect(planReminders(tasks, lists, NOW).map((entry) => entry.taskId)).toEqual(['t1'])
  })

  it('erinnert bei einem Zeitpunkt in der Vergangenheit nicht', () => {
    // Sonst würde nach einer Offline-Phase eine Welle alter Erinnerungen
    // ausgelöst – Lärm statt Nutzen.
    const tasks = [einmalig({ id: 't1', reminders: [{ form: 'absolute', at: PAST }] })]
    expect(planReminders(tasks, lists, NOW)).toHaveLength(0)
  })

  it('lässt nur die Erinnerungen weg, die schon vorbei sind', () => {
    const tasks = [
      einmalig({
        id: 't1',
        reminders: [
          { form: 'absolute', at: PAST },
          { form: 'absolute', at: SOON },
        ],
      }),
    ]
    expect(planReminders(tasks, lists, NOW).map((entry) => entry.at)).toEqual([SOON])
  })

  it('ignoriert erledigte Aufgaben', () => {
    // Wichtig für den Nachlauf: Ist die Aufgabe abgehakt, verstummen auch die
    // Erinnerungen, die nach der Fälligkeit liegen sollten.
    const tasks = [wiederkehrend([240], { id: 't1', completed: true })]
    expect(planReminders(tasks, lists, NOW)).toHaveLength(0)
  })

  it('ignoriert gelöschte Aufgaben', () => {
    const tasks = [einmalig({ id: 't1', deleted_at: SOON })]
    expect(planReminders(tasks, lists, NOW)).toHaveLength(0)
  })

  it('zieht bei wiederkehrenden Aufgaben die Vorläufe ab', () => {
    const tasks = [wiederkehrend([30, 60], { id: 't1', due_at: LATER })]
    const plan = planReminders(tasks, lists, NOW)

    // Nach Zeit sortiert: 60 Minuten vorher liegt früher als 30 Minuten vorher.
    expect(plan.map((entry) => entry.at)).toEqual([
      '2026-01-02T08:00:00.000Z',
      '2026-01-02T08:30:00.000Z',
    ])
  })

  it('erinnert bei Vorlauf 0 zur Fälligkeit', () => {
    const tasks = [wiederkehrend([0], { id: 't1' })]
    expect(planReminders(tasks, lists, NOW)[0]?.at).toBe(SOON)
  })

  it('erlaubt einen Nachlauf: negativer Vorlauf liegt hinter der Fälligkeit', () => {
    const tasks = [wiederkehrend([-240], { id: 't1' })]
    expect(planReminders(tasks, lists, NOW)[0]?.at).toBe('2026-01-01T17:00:00.000Z')
  })

  it('plant nichts, wenn die wiederkehrende Aufgabe keine Erinnerung hat', () => {
    const tasks = [wiederkehrend([], { id: 't1' })]
    expect(planReminders(tasks, lists, NOW)).toHaveLength(0)
  })

  it('ignoriert einen Vorlauf, wenn die Fälligkeit fehlt', () => {
    // Kann nach `alignReminders` nicht vorkommen; die Planung verlässt sich
    // nicht darauf.
    const tasks = [wiederkehrend([30], { id: 't1', due_at: null })]
    expect(planReminders(tasks, lists, NOW)).toHaveLength(0)
  })

  it('weckt niemanden, der die Erinnerung stummgeschaltet hat', () => {
    const tasks = [
      einmalig({ id: 't1', reminders: [{ form: 'absolute', at: SOON, mutedBy: ['a'] }] }),
    ]

    expect(planReminders(tasks, lists, NOW, 'a')).toHaveLength(0)
    // Für alle anderen bleibt sie bestehen – das ist der ganze Punkt.
    expect(planReminders(tasks, lists, NOW, 'b').map((entry) => entry.taskId)).toEqual(['t1'])
  })

  it('trifft nur die stummgeschaltete Erinnerung, nicht die anderen', () => {
    const tasks = [
      einmalig({
        id: 't1',
        reminders: [
          { form: 'absolute', at: SOON, mutedBy: ['a'] },
          { form: 'absolute', at: LATER },
        ],
      }),
    ]

    expect(planReminders(tasks, lists, NOW, 'a').map((entry) => entry.at)).toEqual([LATER])
    expect(planReminders(tasks, lists, NOW, 'b')).toHaveLength(2)
  })

  it('plant ohne Kennung alles', () => {
    // So verhalten sich Aufrufer ohne Person und Tests, die die Stummschaltung
    // nicht prüfen.
    const tasks = [
      einmalig({ id: 't1', reminders: [{ form: 'absolute', at: SOON, mutedBy: ['a'] }] }),
    ]
    expect(planReminders(tasks, lists, NOW)).toHaveLength(1)
  })

  it('nennt die Liste als Kontext, sonst einen Ersatztext', () => {
    const tasks = [
      einmalig({ id: 't1', list_id: 'list-1' }),
      einmalig({ id: 't2', list_id: 'unbekannt' }),
    ]
    const plan = planReminders(tasks, lists, NOW)

    expect(plan.find((entry) => entry.taskId === 't1')?.body).toBe('Arbeit')
    expect(plan.find((entry) => entry.taskId === 't2')?.body).toBe('Prio')
  })

  it('sortiert nach Zeitpunkt', () => {
    const tasks = [
      einmalig({ id: 't1', title: 'Später', reminders: [{ form: 'absolute', at: LATER }] }),
      einmalig({ id: 't2', title: 'Früher', reminders: [{ form: 'absolute', at: SOON }] }),
    ]
    expect(planReminders(tasks, lists, NOW).map((entry) => entry.title)).toEqual(['Früher', 'Später'])
  })

  it('normalisiert Zeitstempel verschiedener Schreibweisen', () => {
    const tasks = [
      einmalig({
        id: 't1',
        reminders: [{ form: 'absolute', at: '2026-01-01T13:00:00.000000+00:00' }],
      }),
    ]
    expect(planReminders(tasks, lists, NOW)[0]?.at).toBe(SOON)
  })

  it('plant nichts ohne Aufgaben', () => {
    expect(planReminders([], lists, NOW)).toEqual([])
  })
})

describe('Erinnerungszeitpunkte einer Aufgabe', () => {
  it('gibt bei absoluten Erinnerungen die Zeitpunkte zurück', () => {
    expect(reminderTimesFor(einmalig({ reminders: [{ form: 'absolute', at: SOON }] }))).toEqual([
      SOON,
    ])
  })

  it('rechnet bei wiederkehrenden Aufgaben aus der Fälligkeit', () => {
    expect(reminderTimesFor(wiederkehrend([90, -90]))).toEqual([
      '2026-01-01T11:30:00.000Z',
      '2026-01-01T14:30:00.000Z',
    ])
  })

  it('gibt eine leere Liste zurück, wenn keine Erinnerung gesetzt ist', () => {
    expect(reminderTimesFor(localTask({ due_at: SOON }))).toEqual([])
    expect(reminderTimesFor(wiederkehrend([]))).toEqual([])
  })
})
