import { describe, expect, it } from 'vitest'
import {
  absoluteFromOffset,
  type ReminderTarget,
  alignReminder,
  isPlausibleOffset,
  offsetFromAbsolute,
  reminderFormFor,
  type ReminderFields,
} from '../../src/domain/reminder'

/**
 * Die eine Regel: **Die Form der Erinnerung folgt der Wiederholung.**
 *
 * Einmalige Aufgaben tragen einen absoluten Zeitpunkt, wiederkehrende einen
 * Vorlauf. Diese Datei prüft die Regel und die Übergänge dazwischen – den Ort,
 * an dem so ein Umbau erfahrungsgemäß still etwas verliert.
 */

const NOW = Date.parse('2026-01-01T12:00:00.000Z')
const DUE = '2026-01-02T09:00:00.000Z'

function felder(overrides: Partial<ReminderFields> = {}): ReminderFields {
  return {
    due_at: DUE,
    recurrence: null,
    remind_at: null,
    reminder_offset_minutes: null,
    ...overrides,
  }
}

/**
 * Ein Zielzustand lässt die Erinnerungsfelder weg (`undefined`).
 *
 * Das ist der Normalfall: Ein Formular, das nur Fälligkeit und Wiederholung
 * ändert, sagt zur Erinnerung nichts – und dann wird sie umgerechnet.
 */
function ziel(overrides: Partial<ReminderTarget> = {}): ReminderTarget {
  return { due_at: DUE, recurrence: null, ...overrides }
}

describe('Form der Erinnerung', () => {
  it('ist relativ, sobald die Aufgabe wiederkehrend ist', () => {
    expect(reminderFormFor('daily', DUE)).toBe('relative')
  })

  it('ist absolut bei einmaligen Aufgaben', () => {
    expect(reminderFormFor(null, DUE)).toBe('absolute')
  })

  it('ist keine, wenn es keine Fälligkeit gibt', () => {
    // Eine Wiederholung ohne Fälligkeit gibt es nicht – siehe `alignReminder`.
    expect(reminderFormFor('daily', null)).toBe('none')
    expect(reminderFormFor(null, null)).toBe('none')
  })
})

describe('Erinnerung ausrichten', () => {
  it('lässt den absoluten Zeitpunkt einer einmaligen Aufgabe stehen', () => {
    const ergebnis = alignReminder(null, felder({ remind_at: DUE }), NOW)
    expect(ergebnis).toEqual({
      due_at: DUE,
      recurrence: null,
      remind_at: DUE,
      reminder_offset_minutes: null,
    })
  })

  it('erlaubt einer einmaligen Aufgabe eine Erinnerung ohne Fälligkeit', () => {
    const ergebnis = alignReminder(null, felder({ due_at: null, remind_at: DUE }), NOW)
    expect(ergebnis.remind_at).toBe(DUE)
    expect(ergebnis.due_at).toBeNull()
  })

  it('nimmt einer wiederkehrenden Aufgabe den absoluten Zeitpunkt', () => {
    // Beide gesetzt darf es nie geben: Welche Spalte gilt, entscheidet
    // `recurrence`, und ein widersprüchlicher Datensatz wäre nicht erklärbar.
    const ergebnis = alignReminder(
      null,
      felder({ recurrence: 'daily', remind_at: DUE, reminder_offset_minutes: 30 }),
      NOW,
    )
    expect(ergebnis.remind_at).toBeNull()
    expect(ergebnis.reminder_offset_minutes).toBe(30)
  })

  it('nimmt einer einmaligen Aufgabe den Vorlauf', () => {
    const ergebnis = alignReminder(
      felder({ recurrence: 'daily', reminder_offset_minutes: 30 }),
      felder({ recurrence: null, remind_at: null }),
      NOW,
    )
    expect(ergebnis.reminder_offset_minutes).toBeNull()
  })

  it('verwirft eine Wiederholung ohne Fälligkeit', () => {
    const ergebnis = alignReminder(null, felder({ due_at: null, recurrence: 'daily' }), NOW)
    expect(ergebnis.recurrence).toBeNull()
    expect(ergebnis.reminder_offset_minutes).toBeNull()
  })

  it('behandelt eine unbekannte Wiederholung wie keine', () => {
    const ergebnis = alignReminder(null, felder({ recurrence: 'stündlich' }), NOW)
    expect(ergebnis.recurrence).toBeNull()
  })

  it('nimmt einen ausdrücklich mitgeschickten Vorlauf wörtlich', () => {
    // Der Fall aus dem Formular: Der Nutzer stellt gerade 4 Stunden ein.
    const ergebnis = alignReminder(
      felder(),
      ziel({ recurrence: 'daily', reminder_offset_minutes: 240 }),
      NOW,
    )
    expect(ergebnis.reminder_offset_minutes).toBe(240)
  })

  it('lässt einen Nachlauf zu', () => {
    const ergebnis = alignReminder(null, felder({ recurrence: 'daily', reminder_offset_minutes: -240 }), NOW)
    expect(ergebnis.reminder_offset_minutes).toBe(-240)
  })

  it('verwirft einen unplausiblen Vorlauf', () => {
    const ergebnis = alignReminder(null, felder({ recurrence: 'daily', reminder_offset_minutes: 99_999_999 }), NOW)
    expect(ergebnis.reminder_offset_minutes).toBeNull()
  })

  /**
   * Der Übergang, bei dem am ehesten etwas verloren geht: Der Nutzer schaltet
   * die Wiederholung ein und der Moment soll bleiben, an dem erinnert wurde.
   */
  it('rechnet beim Einschalten der Wiederholung den Zeitpunkt in einen Vorlauf um', () => {
    const vorher = felder({ remind_at: '2026-01-02T07:30:00.000Z' })
    const ergebnis = alignReminder(vorher, ziel({ recurrence: 'daily' }), NOW)

    expect(ergebnis.reminder_offset_minutes).toBe(90)
    expect(ergebnis.remind_at).toBeNull()
  })

  it('rechnet beim Abschalten der Wiederholung den Vorlauf in einen Zeitpunkt um', () => {
    const vorher = felder({ recurrence: 'daily', reminder_offset_minutes: 90 })
    const ergebnis = alignReminder(vorher, ziel({ recurrence: null }), NOW)

    expect(ergebnis.remind_at).toBe('2026-01-02T07:30:00.000Z')
    expect(ergebnis.reminder_offset_minutes).toBeNull()
  })

  it('verwirft beim Abschalten eine Erinnerung, die schon vorbei wäre', () => {
    const vorher = felder({ due_at: '2026-01-01T11:00:00.000Z', recurrence: 'daily', reminder_offset_minutes: 0 })
    const ergebnis = alignReminder(
      vorher,
      felder({ due_at: '2026-01-01T11:00:00.000Z', recurrence: null, reminder_offset_minutes: null }),
      NOW,
    )

    expect(ergebnis.remind_at).toBeNull()
  })

  /**
   * Die Fälligkeit zu entfernen heißt nicht, die Erinnerung zu löschen. Genau
   * dafür sind die beiden ja getrennt: Der Moment wandert in die absolute Form
   * und bleibt damit erhalten.
   */
  it('behält die Erinnerung, wenn die Fälligkeit verschwindet', () => {
    const vorher = felder({ recurrence: 'daily', reminder_offset_minutes: 30 })
    const ergebnis = alignReminder(vorher, ziel({ due_at: null, recurrence: 'daily' }), NOW)

    // Die Wiederholung fällt weg – sie braucht einen Bezugspunkt.
    expect(ergebnis.recurrence).toBeNull()
    // Die Erinnerung nicht: 09:00 minus 30 Minuten, gerechnet über die alte Fälligkeit.
    expect(ergebnis.remind_at).toBe('2026-01-02T08:30:00.000Z')
    expect(ergebnis.reminder_offset_minutes).toBeNull()
  })

  it('streicht die Erinnerung, wenn der errechnete Zeitpunkt schon vorbei ist', () => {
    const vorher = felder({
      due_at: '2026-01-01T11:00:00.000Z',
      recurrence: 'daily',
      reminder_offset_minutes: 0,
    })
    const ergebnis = alignReminder(vorher, ziel({ due_at: null, recurrence: 'daily' }), NOW)

    expect(ergebnis.remind_at).toBeNull()
  })

  /**
   * Ohne diesen Fall ließe sich „keine Erinnerung" nicht von „nicht angefasst"
   * unterscheiden, und ein Löschen würde die Erinnerung wiederbeleben.
   */
  it('behält eine absolute Erinnerung, wenn nur die Fälligkeit wandert', () => {
    // Genau der Kern der Trennung: Der gewählte Moment bleibt, wo er war.
    const vorher = felder({ remind_at: '2026-01-02T07:30:00.000Z' })
    const ergebnis = alignReminder(vorher, ziel({ due_at: '2026-01-03T09:00:00.000Z' }), NOW)

    expect(ergebnis.remind_at).toBe('2026-01-02T07:30:00.000Z')
    expect(ergebnis.due_at).toBe('2026-01-03T09:00:00.000Z')
  })

  it('nimmt eine ausdrücklich gelöschte Erinnerung wörtlich', () => {
    const vorher = felder({ recurrence: 'daily', reminder_offset_minutes: 30 })
    const ergebnis = alignReminder(
      vorher,
      felder({ recurrence: 'daily', reminder_offset_minutes: null }),
      NOW,
    )

    expect(ergebnis.reminder_offset_minutes).toBeNull()
  })
})

describe('Umrechnung zwischen den Formen', () => {
  it('rechnet absolut in einen Vorlauf', () => {
    expect(offsetFromAbsolute(DUE, '2026-01-02T07:30:00.000Z')).toBe(90)
    expect(offsetFromAbsolute(DUE, '2026-01-02T13:00:00.000Z')).toBe(-240)
  })

  it('rechnet einen Vorlauf in einen Zeitpunkt', () => {
    expect(absoluteFromOffset(DUE, 90, NOW)).toBe('2026-01-02T07:30:00.000Z')
    expect(absoluteFromOffset(DUE, -240, NOW)).toBe('2026-01-02T13:00:00.000Z')
  })

  it('gibt null zurück, wenn der Zeitpunkt schon vorbei wäre', () => {
    expect(absoluteFromOffset('2026-01-01T11:00:00.000Z', 0, NOW)).toBeNull()
  })

  it('gibt null zurück, wenn der Bezugspunkt fehlt', () => {
    expect(offsetFromAbsolute(null, DUE)).toBeNull()
    expect(absoluteFromOffset(null, 30, NOW)).toBeNull()
  })

  it('erkennt unplausible Vorläufe', () => {
    expect(isPlausibleOffset(0)).toBe(true)
    expect(isPlausibleOffset(-2880)).toBe(true)
    expect(isPlausibleOffset(Number.NaN)).toBe(false)
    expect(isPlausibleOffset(99_999_999)).toBe(false)
  })
})
