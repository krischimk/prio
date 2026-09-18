import type { ReminderStatus } from './reminderService'

/**
 * Übersetzt den Zustand der Erinnerungen in einen Text für die Oberfläche.
 *
 * Getrennt von der React-Komponente, damit die Formulierungen testbar sind –
 * wie bei der Sync-Anzeige.
 */

export type ReminderTone = 'ok' | 'error'

export interface ReminderDescription {
  /** `null`, wenn nichts angezeigt werden soll (z. B. im Browser). */
  text: string | null
  tone: ReminderTone
  /** `true`, wenn ein Knopf zum Aktivieren angeboten werden soll. */
  canEnable: boolean
}

export function describeReminderState(status: ReminderStatus | null): ReminderDescription {
  // Browser: dort gibt es keine geplanten Benachrichtigungen – der Hinweis
  // wäre nur Verwirrung.
  if (!status || status.kind === 'unsupported') {
    return { text: null, tone: 'ok', canEnable: false }
  }

  switch (status.kind) {
    case 'permission-required':
      return { text: 'Erinnerungen sind aus.', tone: 'ok', canEnable: true }
    case 'permission-denied':
      return {
        text: 'Erinnerungen sind blockiert. In den Systemeinstellungen erlauben.',
        tone: 'error',
        canEnable: false,
      }
    case 'error':
      return {
        text: status.message ?? 'Erinnerungen konnten nicht geplant werden.',
        tone: 'error',
        canEnable: false,
      }
    case 'ok':
      if (status.scheduled === 0) {
        return { text: null, tone: 'ok', canEnable: false }
      }
      return {
        text:
          status.scheduled === 1
            ? '1 Erinnerung geplant'
            : `${status.scheduled} Erinnerungen geplant`,
        tone: 'ok',
        canEnable: false,
      }
  }
}
