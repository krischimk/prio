import { describe, expect, it } from 'vitest'
import {
  MAX_REMINDERS,
  absoluteFromOffset,
  alignReminders,
  isPlausibleOffset,
  offsetFromAbsolute,
  parseReminders,
  reminderFormFor,
  reminderTimeOf,
  type ReminderFields,
  type ReminderTarget,
} from '../../src/domain/reminder'

/**
 * Die eine Regel: **Die Form der Erinnerungen folgt der Wiederholung.**
 *
 * Einmalige Aufgaben tragen absolute Zeitpunkte, wiederkehrende Vorläufe. Diese
 * Datei prüft die Regel, die Übergänge und das Lesen fremder Daten – den Ort,
 * an dem so ein Umbau erfahrungsgemäß still etwas verliert.
 */

const NOW = Date.parse('2026-01-01T12:00:00.000Z')
const DUE = '2026-01-02T09:00:00.000Z'
const VORHER = '2026-01-02T07:30:00.000Z'

function felder(overrides: Partial<ReminderFields> = {}): ReminderFields {
  return { due_at: DUE, recurrence: null, reminders: [], ...overrides }
}

/**
 * Ein Zielzustand lässt `reminders` weg (`undefined`).
 *
 * Das ist der Normalfall: Ein Formular, das nur Fälligkeit und Wiederholung
 * ändert, sagt zur Erinnerung nichts – und dann wird die Liste umgerechnet.
 */
function ziel(overrides: Partial<ReminderTarget> = {}): ReminderTarget {
  return { due_at: DUE, recurrence: null, ...overrides }
}

describe('Form der Erinnerungen', () => {
  it('ist relativ, sobald die Aufgabe wiederkehrend ist', () => {
    expect(reminderFormFor('daily', DUE)).toBe('relative')
  })

  it('ist absolut bei einmaligen Aufgaben', () => {
    expect(reminderFormFor(null, DUE)).toBe('absolute')
  })

  it('ist keine, wenn es keine Fälligkeit gibt', () => {
    expect(reminderFormFor('daily', null)).toBe('none')
    expect(reminderFormFor(null, null)).toBe('none')
  })
})

describe('Erinnerungen ausrichten', () => {
  it('lässt absolute Zeitpunkte einer einmaligen Aufgabe stehen', () => {
    const ergebnis = alignReminders(
      null,
      ziel({ reminders: [{ form: 'absolute', at: VORHER }] }),
      NOW,
    )
    expect(ergebnis.reminders).toEqual([{ form: 'absolute', at: VORHER }])
  })

  it('trägt mehrere Erinnerungen', () => {
    const ergebnis = alignReminders(
      null,
      ziel({
        reminders: [
          { form: 'absolute', at: VORHER },
          { form: 'absolute', at: DUE },
        ],
      }),
      NOW,
    )
    expect(ergebnis.reminders).toHaveLength(2)
  })

  it('erlaubt Erinnerungen ohne Fälligkeit', () => {
    const ergebnis = alignReminders(
      null,
      ziel({ due_at: null, reminders: [{ form: 'absolute', at: VORHER }] }),
      NOW,
    )
    expect(ergebnis.due_at).toBeNull()
    expect(ergebnis.reminders).toHaveLength(1)
  })

  it('nimmt einer wiederkehrenden Aufgabe die absoluten Zeitpunkte', () => {
    const ergebnis = alignReminders(
      null,
      ziel({ recurrence: 'daily', reminders: [{ form: 'absolute', at: VORHER }] }),
      NOW,
    )
    expect(ergebnis.reminders).toEqual([{ form: 'offset', minutes: 90 }])
  })

  it('verwirft eine Wiederholung ohne Fälligkeit', () => {
    const ergebnis = alignReminders(null, ziel({ due_at: null, recurrence: 'daily' }), NOW)
    expect(ergebnis.recurrence).toBeNull()
  })

  it('nimmt eine ausdrücklich geleerte Liste wörtlich', () => {
    const vorher = felder({
      recurrence: 'daily',
      reminders: [{ form: 'offset', minutes: 30 }],
    })
    const ergebnis = alignReminders(vorher, ziel({ recurrence: 'daily', reminders: [] }), NOW)
    expect(ergebnis.reminders).toEqual([])
  })

  it('entfernt doppelte Erinnerungen', () => {
    const ergebnis = alignReminders(
      null,
      ziel({
        reminders: [
          { form: 'absolute', at: VORHER },
          { form: 'absolute', at: VORHER },
        ],
      }),
      NOW,
    )
    expect(ergebnis.reminders).toHaveLength(1)
  })

  it('begrenzt die Anzahl', () => {
    const viele = Array.from({ length: MAX_REMINDERS + 5 }, (_, i) => ({
      form: 'offset' as const,
      minutes: 10 + i,
    }))
    const ergebnis = alignReminders(null, ziel({ recurrence: 'daily', reminders: viele }), NOW)
    expect(ergebnis.reminders).toHaveLength(MAX_REMINDERS)
  })

  it('behält eine absolute Erinnerung, wenn nur die Fälligkeit wandert', () => {
    const vorher = felder({ reminders: [{ form: 'absolute', at: VORHER }] })
    const ergebnis = alignReminders(vorher, ziel({ due_at: '2026-01-03T09:00:00.000Z' }), NOW)

    expect(ergebnis.reminders).toEqual([{ form: 'absolute', at: VORHER }])
    expect(ergebnis.due_at).toBe('2026-01-03T09:00:00.000Z')
  })

  /**
   * Der Übergang, bei dem am ehesten etwas verloren geht: Der Nutzer schaltet
   * die Wiederholung ein und die Momente sollen bleiben.
   */
  it('rechnet beim Einschalten der Wiederholung alle Zeitpunkte um', () => {
    const vorher = felder({
      reminders: [
        { form: 'absolute', at: VORHER },
        { form: 'absolute', at: DUE },
      ],
    })
    const ergebnis = alignReminders(vorher, ziel({ recurrence: 'daily' }), NOW)

    expect(ergebnis.reminders).toEqual([
      { form: 'offset', minutes: 90 },
      { form: 'offset', minutes: 0 },
    ])
  })

  it('rechnet beim Abschalten der Wiederholung alle Vorläufe um', () => {
    const vorher = felder({
      recurrence: 'daily',
      reminders: [
        { form: 'offset', minutes: 90 },
        { form: 'offset', minutes: 0 },
      ],
    })
    const ergebnis = alignReminders(vorher, ziel({ recurrence: null }), NOW)

    expect(ergebnis.reminders).toEqual([
      { form: 'absolute', at: VORHER },
      { form: 'absolute', at: DUE },
    ])
  })

  it('verwirft beim Abschalten, was schon vorbei wäre', () => {
    const vorher = felder({
      due_at: '2026-01-01T11:00:00.000Z',
      recurrence: 'daily',
      reminders: [{ form: 'offset', minutes: 0 }],
    })
    const ergebnis = alignReminders(
      vorher,
      ziel({ due_at: '2026-01-01T11:00:00.000Z', recurrence: null }),
      NOW,
    )
    expect(ergebnis.reminders).toEqual([])
  })

  /**
   * Die Fälligkeit zu entfernen heißt nicht, die Erinnerungen zu löschen. Genau
   * dafür sind die beiden ja getrennt: Die Momente wandern in die absolute Form
   * und bleiben erhalten.
   */
  it('behält die Erinnerungen, wenn die Fälligkeit verschwindet', () => {
    const vorher = felder({
      recurrence: 'daily',
      reminders: [{ form: 'offset', minutes: 30 }],
    })
    const ergebnis = alignReminders(vorher, ziel({ due_at: null, recurrence: 'daily' }), NOW)

    expect(ergebnis.recurrence).toBeNull()
    expect(ergebnis.reminders).toEqual([{ form: 'absolute', at: '2026-01-02T08:30:00.000Z' }])
  })

  it('verwirft einen unplausiblen Vorlauf', () => {
    const ergebnis = alignReminders(
      null,
      ziel({ recurrence: 'daily', reminders: [{ form: 'offset', minutes: 99_999_999 }] }),
      NOW,
    )
    expect(ergebnis.reminders).toEqual([])
  })
})

describe('Zeitpunkt einer Erinnerung', () => {
  it('gibt bei absoluten Erinnerungen den Zeitpunkt zurück', () => {
    expect(reminderTimeOf({ form: 'absolute', at: VORHER }, null)).toBe(VORHER)
  })

  it('rechnet bei Vorläufen aus der Fälligkeit', () => {
    expect(reminderTimeOf({ form: 'offset', minutes: 90 }, DUE)).toBe(VORHER)
    expect(reminderTimeOf({ form: 'offset', minutes: -90 }, DUE)).toBe('2026-01-02T10:30:00.000Z')
  })

  it('gibt null zurück, wenn der Bezugspunkt fehlt', () => {
    expect(reminderTimeOf({ form: 'offset', minutes: 90 }, null)).toBeNull()
  })
})

describe('Umrechnung zwischen den Formen', () => {
  it('rechnet absolut in einen Vorlauf', () => {
    expect(offsetFromAbsolute(DUE, VORHER)).toBe(90)
    expect(offsetFromAbsolute(DUE, '2026-01-02T13:00:00.000Z')).toBe(-240)
  })

  it('rechnet einen Vorlauf in einen Zeitpunkt', () => {
    expect(absoluteFromOffset(DUE, 90, NOW)).toBe(VORHER)
    expect(absoluteFromOffset(DUE, -240, NOW)).toBe('2026-01-02T13:00:00.000Z')
  })

  it('gibt null zurück, wenn der Zeitpunkt schon vorbei wäre', () => {
    expect(absoluteFromOffset('2026-01-01T11:00:00.000Z', 0, NOW)).toBeNull()
  })

  it('erkennt unplausible Vorläufe', () => {
    expect(isPlausibleOffset(0)).toBe(true)
    expect(isPlausibleOffset(-2880)).toBe(true)
    expect(isPlausibleOffset(Number.NaN)).toBe(false)
    expect(isPlausibleOffset(99_999_999)).toBe(false)
  })
})

describe('Erinnerungen aus der Datenbank lesen', () => {
  it('liest eine gültige Liste', () => {
    expect(
      parseReminders([
        { form: 'offset', minutes: 90 },
        { form: 'absolute', at: VORHER },
      ]),
    ).toEqual([
      { form: 'offset', minutes: 90 },
      { form: 'absolute', at: VORHER },
    ])
  })

  it('kommt mit null und Unbekanntem zurecht', () => {
    expect(parseReminders(null)).toEqual([])
    expect(parseReminders('kaputt')).toEqual([])
    expect(parseReminders([1, 'x', null, { form: 'was anderes' }])).toEqual([])
  })

  it('lässt einzelne kaputte Einträge fallen, nicht die ganze Liste', () => {
    expect(
      parseReminders([
        { form: 'offset', minutes: 30 },
        { form: 'absolute', at: 'kein Datum' },
        { form: 'offset', minutes: 'viel' },
      ]),
    ).toEqual([{ form: 'offset', minutes: 30 }])
  })

  it('normalisiert Schreibweisen von Zeitstempeln', () => {
    expect(parseReminders([{ form: 'absolute', at: '2026-01-02T07:30:00+00:00' }])).toEqual([
      { form: 'absolute', at: VORHER },
    ])
  })

  it('kürzt eine zu lange Liste', () => {
    const viele = Array.from({ length: MAX_REMINDERS + 3 }, (_, i) => ({
      form: 'offset',
      minutes: i,
    }))
    expect(parseReminders(viele)).toHaveLength(MAX_REMINDERS)
  })
})
