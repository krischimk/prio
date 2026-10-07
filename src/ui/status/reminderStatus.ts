import type { ReminderStatus } from '../../reminders/reminderService'

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
  /**
   * `false`, wenn dieses Gerät keine Erinnerungen planen kann – im Browser
   * etwa. Getrennt von `text`, weil „nichts geplant" und „geht hier nicht"
   * sonst nicht auseinanderzuhalten wären: Beides ergab früher keinen Text
   * und keinen Knopf, und die Einstellungen behaupteten deshalb, Erinnerungen
   * seien nicht verfügbar, sobald bloß nichts anstand.
   */
  available: boolean
}

export function describeReminderState(status: ReminderStatus | null): ReminderDescription {
  // Browser: dort gibt es keine geplanten Benachrichtigungen – der Hinweis
  // wäre nur Verwirrung.
  if (!status || status.kind === 'unsupported') {
    return { text: null, tone: 'ok', canEnable: false, available: false }
  }

  switch (status.kind) {
    case 'permission-required':
      return { text: 'Erinnerungen sind aus.', tone: 'ok', canEnable: true, available: true }
    case 'permission-denied':
      return {
        text: 'Erinnerungen sind blockiert. In den Systemeinstellungen erlauben.',
        tone: 'error',
        canEnable: false,
        available: true,
      }
    case 'error':
      return {
        text: status.message ?? 'Erinnerungen konnten nicht geplant werden.',
        tone: 'error',
        canEnable: false,
        available: true,
      }
    case 'ok':
      if (status.scheduled === 0) {
        // Berechtigung ist da, es steht nur gerade nichts an. Das zu sagen ist
        // die einzige Stelle, an der die Einstellungen den Zustand verraten –
        // „verfügbar, aber nichts geplant" ist kein Fehler.
        return { text: 'Erinnerungen sind an.', tone: 'ok', canEnable: false, available: true }
      }
      return {
        text:
          status.scheduled === 1
            ? '1 Erinnerung geplant'
            : `${status.scheduled} Erinnerungen geplant`,
        tone: 'ok',
        canEnable: false,
        available: true,
      }
  }
}
