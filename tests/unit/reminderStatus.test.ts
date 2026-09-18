import { describe, expect, it } from 'vitest'
import { describeReminderState } from '../../src/reminders/reminderStatus'
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

  it('schweigt, wenn nichts geplant ist', () => {
    expect(describeReminderState(status('ok', 0)).text).toBeNull()
  })

  it('zeigt Fehlermeldungen an', () => {
    const description = describeReminderState(status('error', 0, 'Kein Zugriff auf den AlarmManager'))
    expect(description.tone).toBe('error')
    expect(description.text).toBe('Kein Zugriff auf den AlarmManager')
  })
})
