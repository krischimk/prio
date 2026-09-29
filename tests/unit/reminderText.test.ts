import { describe, expect, it } from 'vitest'
import {
  describeReminders,
  formatDuration,
  formatReminderOffset,
  reminderSuggestion,
} from '../../src/ui/reminder'
import { localTask } from '../support/factories'

/**
 * Die Texte der Erinnerungen.
 *
 * Sie entstehen an einer Stelle, damit Telefon und breite Ansicht dasselbe
 * sagen – die Regel aus `AGENTS.md`, die schon einmal verletzt wurde.
 */

const DUE = '2099-01-15T18:30:00.000Z'

describe('Dauer beschreiben', () => {
  it('lässt Nullteile weg', () => {
    expect(formatDuration(90)).toBe('1 Std 30 Min')
    expect(formatDuration(60)).toBe('1 Std')
    expect(formatDuration(1440)).toBe('1 Tag')
    expect(formatDuration(1500)).toBe('1 Tag 1 Std')
    expect(formatDuration(45)).toBe('45 Min')
  })

  it('benutzt die Einzahl bei genau eins', () => {
    expect(formatDuration(1)).toBe('1 Min')
    expect(formatDuration(60)).toBe('1 Std')
    expect(formatDuration(1440)).toBe('1 Tag')
  })

  it('benutzt die Mehrzahl ab zwei', () => {
    expect(formatDuration(2)).toBe('2 Min')
    expect(formatDuration(120)).toBe('2 Std')
    expect(formatDuration(2880)).toBe('2 Tage')
  })

  it('kommt mit der Null zurecht', () => {
    expect(formatDuration(0)).toBe('0 Min')
  })
})

describe('Vorlauf beschreiben', () => {
  it('nennt die Fälligkeit als Bezugspunkt', () => {
    expect(formatReminderOffset(0)).toBe('Zur Fälligkeit')
  })

  it('beschreibt einen Vorlauf', () => {
    expect(formatReminderOffset(10)).toBe('10 Min vorher')
    expect(formatReminderOffset(90)).toBe('1 Std 30 Min vorher')
    expect(formatReminderOffset(1440)).toBe('1 Tag vorher')
  })

  it('beschreibt einen Nachlauf', () => {
    expect(formatReminderOffset(-240)).toBe('4 Std nach der Fälligkeit')
    expect(formatReminderOffset(-1)).toBe('1 Min nach der Fälligkeit')
  })
})

describe('Erinnerungen einer Aufgabe beschreiben', () => {
  it('schweigt, wenn keine Erinnerung gesetzt ist', () => {
    expect(describeReminders(localTask({ due_at: DUE }))).toEqual([])
  })

  it('schweigt, wenn die Erinnerung ohnehin zur Fälligkeit passiert', () => {
    // Sonst stünde in jeder Zeile dasselbe wie in der Zeile darüber.
    expect(
      describeReminders(localTask({ due_at: DUE, reminders: [{ form: 'absolute', at: DUE }] })),
    ).toEqual([])
  })

  it('nennt den Zeitpunkt, wenn er von der Fälligkeit abweicht', () => {
    const labels = describeReminders(
      localTask({
        due_at: DUE,
        reminders: [{ form: 'absolute', at: '2099-01-15T17:00:00.000Z' }],
      }),
    )
    expect(labels).toHaveLength(1)
    expect(labels[0]?.text).toContain('Erinnert:')
    expect(labels[0]?.afterDue).toBe(false)
  })

  it('gibt je Erinnerung eine Zeile zurück', () => {
    const labels = describeReminders(
      localTask({
        due_at: DUE,
        reminders: [
          { form: 'absolute', at: '2099-01-15T17:00:00.000Z' },
          { form: 'absolute', at: '2099-01-15T20:00:00.000Z' },
        ],
      }),
    )
    expect(labels).toHaveLength(2)
    expect(labels[1]?.afterDue).toBe(true)
  })

  it('zeigt eine Erinnerung auch ohne Fälligkeit', () => {
    const labels = describeReminders(
      localTask({ due_at: null, reminders: [{ form: 'absolute', at: '2099-01-15T18:00:00.000Z' }] }),
    )
    expect(labels).toHaveLength(1)
    expect(labels[0]?.text).toContain('Erinnert:')
  })

  it('benennt eine stummgeschaltete Erinnerung und lässt sie stehen', () => {
    // Sie muss sichtbar bleiben – sonst wüsste man nicht mehr, warum man nicht
    // geweckt wird.
    const labels = describeReminders(
      localTask({
        due_at: DUE,
        reminders: [{ form: 'absolute', at: '2099-01-15T17:00:00.000Z', mutedBy: ['a'] }],
      }),
      'a',
    )
    expect(labels).toHaveLength(1)
    expect(labels[0]?.muted).toBe(true)
    expect(labels[0]?.text).toContain('für mich stumm')
  })

  it('zeigt eine stummgeschaltete Erinnerung auch zur Fälligkeit', () => {
    // Für alle anderen wäre sie eine Dublette zur Fälligkeitszeile; für die
    // stummgeschaltete Person ist sie die einzige Spur ihrer Entscheidung.
    const task = localTask({ due_at: DUE, reminders: [{ form: 'absolute', at: DUE, mutedBy: ['a'] }] })
    expect(describeReminders(task, 'a')).toHaveLength(1)
    expect(describeReminders(task, 'b')).toHaveLength(0)
  })

  it('benennt sie nicht für andere', () => {
    const labels = describeReminders(
      localTask({
        due_at: DUE,
        reminders: [{ form: 'absolute', at: '2099-01-15T17:00:00.000Z', mutedBy: ['a'] }],
      }),
      'b',
    )
    expect(labels[0]?.muted).toBe(false)
    expect(labels[0]?.text).not.toContain('stumm')
  })

  it('rechnet bei wiederkehrenden Aufgaben aus dem Vorlauf', () => {
    const labels = describeReminders(
      localTask({ due_at: DUE, recurrence: 'daily', reminders: [{ form: 'offset', minutes: 30 }] }),
    )
    expect(labels).toHaveLength(1)
    expect(labels[0]?.afterDue).toBe(false)
  })

  it('schweigt bei einem Vorlauf von 0', () => {
    expect(
      describeReminders(
        localTask({ due_at: DUE, recurrence: 'daily', reminders: [{ form: 'offset', minutes: 0 }] }),
      ),
    ).toEqual([])
  })
})

describe('Vorschlag für eine neue Erinnerung', () => {
  const NOW = Date.parse('2099-01-15T14:23:00.000Z')

  it('schlägt bei wiederkehrenden Aufgaben die Fälligkeit vor', () => {
    expect(reminderSuggestion('daily', DUE, NOW)).toEqual({ form: 'offset', minutes: 0 })
  })

  it('schlägt bei einmaligen Aufgaben mit Fälligkeit diese vor', () => {
    expect(reminderSuggestion(null, DUE, NOW)).toEqual({ form: 'absolute', at: DUE })
  })

  it('weicht dem aus, was schon da ist', () => {
    // Sonst fiele die zweite Zeile beim Speichern als Dublette weg.
    const erste = reminderSuggestion(null, DUE, NOW, [])
    const zweite = reminderSuggestion(null, DUE, NOW, [erste])
    expect(zweite).not.toEqual(erste)

    const dritte = reminderSuggestion('daily', DUE, NOW, [{ form: 'offset', minutes: 0 }])
    expect(dritte).toEqual({ form: 'offset', minutes: 10 })
  })

  it('schlägt ohne Fälligkeit die nächste volle Stunde vor', () => {
    const vorschlag = reminderSuggestion(null, null, NOW)
    expect(vorschlag.form).toBe('absolute')
    expect(vorschlag.form === 'absolute' && new Date(vorschlag.at).getMinutes()).toBe(0)
    expect(vorschlag.form === 'absolute' && Date.parse(vorschlag.at)).toBeGreaterThan(NOW)
  })
})
