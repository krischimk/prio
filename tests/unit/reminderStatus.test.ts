import { describe, expect, it } from 'vitest'
import { describeReminderState } from '../../src/ui/status/reminderStatus'
import type { ReminderStatus } from '../../src/reminders/reminderService'

function status(
  kind: ReminderStatus['kind'],
  scheduled = 0,
  message: string | null = null,
): ReminderStatus {
  return { kind, permission: kind === 'permission-denied' ? 'denied' : 'granted', scheduled, message }
}

describe('Anzeige der Erinnerungen', () => {
  it('zeigt im Browser nichts an', () => {
    expect(describeReminderState(status('unsupported')).text).toBeNull()
    expect(describeReminderState(null).text).toBeNull()
  })

  it('bietet das Aktivieren an, solange die Berechtigung fehlt', () => {
    const description = describeReminderState(status('permission-required'))
    expect(description.canEnable).toBe(true)
    expect(description.text).toBe('Erinnerungen sind aus.')
  })

  it('weist auf blockierte Erinnerungen hin', () => {
    const description = describeReminderState(status('permission-denied'))
    expect(description.canEnable).toBe(false)
    expect(description.tone).toBe('error')
    expect(description.text).toContain('Systemeinstellungen')
  })

  it('nennt die Anzahl geplanter Erinnerungen', () => {
    expect(describeReminderState(status('ok', 1)).text).toBe('1 Erinnerung geplant')
    expect(describeReminderState(status('ok', 3)).text).toBe('3 Erinnerungen geplant')
  })

  /**
   * Gemeldeter Fehler: Stand nichts an, ergab die Beschreibung keinen Text und
   * keinen Knopf – genau wie im Browser. Die Einstellungen zeigten darauf
   * „Erinnerungen sind auf diesem Gerät nicht verfügbar.", obwohl die
   * Berechtigung erteilt war und nur kein Termin anstand.
   */
  it('sagt bei erteilter Berechtigung, dass Erinnerungen an sind', () => {
    const description = describeReminderState(status('ok', 0))
    expect(description.text).toBe('Erinnerungen sind an.')
    expect(description.available).toBe(true)
  })

  it('unterscheidet „nichts geplant" von „geht hier nicht"', () => {
    expect(describeReminderState(status('ok', 0)).available).toBe(true)
    expect(describeReminderState(status('unsupported')).available).toBe(false)
    expect(describeReminderState(null).available).toBe(false)
  })

  it('zeigt Fehlermeldungen an', () => {
    const description = describeReminderState(status('error', 0, 'Kein Zugriff auf den AlarmManager'))
    expect(description.tone).toBe('error')
    expect(description.text).toBe('Kein Zugriff auf den AlarmManager')
  })
})
