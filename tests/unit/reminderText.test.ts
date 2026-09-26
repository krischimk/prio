import { describe, expect, it } from 'vitest'
import { describeReminder, formatDuration, formatReminderOffset } from '../../src/ui/reminder'
import { localTask } from '../support/factories'

/**
 * Die Texte der Erinnerung.
 *
 * Sie entstehen an einer Stelle, damit Telefon und breite Ansicht dasselbe
 * sagen – die Regel aus `AGENTS.md`, die schon einmal verletzt wurde.
 */

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

describe('Erinnerung einer Aufgabe beschreiben', () => {
  const DUE = '2099-01-15T18:30:00.000Z'

  it('schweigt, wenn keine Erinnerung gesetzt ist', () => {
    expect(describeReminder(localTask({ due_at: DUE }))).toBeNull()
  })

  it('schweigt, wenn die Erinnerung ohnehin zur Fälligkeit passiert', () => {
    // Sonst stünde in jeder Zeile dasselbe wie in der Zeile darüber.
    expect(describeReminder(localTask({ due_at: DUE, remind_at: DUE }))).toBeNull()
  })

  it('nennt den Zeitpunkt, wenn er von der Fälligkeit abweicht', () => {
    const label = describeReminder(localTask({ due_at: DUE, remind_at: '2099-01-15T17:00:00.000Z' }))
    expect(label?.text).toContain('Erinnert:')
    expect(label?.afterDue).toBe(false)
  })

  it('kennzeichnet einen Nachlauf', () => {
    const label = describeReminder(localTask({ due_at: DUE, remind_at: '2099-01-15T20:00:00.000Z' }))
    expect(label?.afterDue).toBe(true)
  })

  it('zeigt eine Erinnerung auch ohne Fälligkeit', () => {
    const label = describeReminder(localTask({ due_at: null, remind_at: '2099-01-15T18:00:00.000Z' }))
    expect(label?.text).toContain('Erinnert:')
    expect(label?.afterDue).toBe(false)
  })

  it('rechnet bei wiederkehrenden Aufgaben aus dem Vorlauf', () => {
    const label = describeReminder(
      localTask({ due_at: DUE, recurrence: 'daily', reminder_offset_minutes: 30 }),
    )
    expect(label?.text).toContain('Erinnert:')
    expect(label?.afterDue).toBe(false)
  })

  it('schweigt bei einer wiederkehrenden Aufgabe mit Vorlauf 0', () => {
    expect(
      describeReminder(localTask({ due_at: DUE, recurrence: 'daily', reminder_offset_minutes: 0 })),
    ).toBeNull()
  })
})
