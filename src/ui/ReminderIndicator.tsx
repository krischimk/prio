import { useWorkspace } from '../app/useWorkspace'
import { describeReminderState } from '../reminders/reminderStatus'
import { primaryButton } from './styles'

/**
 * Zeigt an, ob und wie viele Erinnerungen geplant sind, und bietet das
 * Aktivieren an.
 *
 * Im Browser wird nichts gerendert – dort gibt es keine geplanten
 * Benachrichtigungen, und ein dauerhafter Hinweis darauf wäre nur Ballast.
 */
export function ReminderIndicator() {
  const { reminderStatus, enableReminders } = useWorkspace()
  const { text, tone, canEnable } = describeReminderState(reminderStatus)

  if (canEnable) {
    return (
      <button
        type="button"
        className={`${primaryButton} px-2 py-1 text-xs`}
        onClick={() => {
          void enableReminders()
        }}
      >
        Erinnerungen aktivieren
      </button>
    )
  }

  if (!text) return null

  return (
    <span
      data-testid="reminder-status"
      className={`text-xs ${tone === 'error' ? 'text-red-400' : 'text-neutral-500'}`}
    >
      {text}
    </span>
  )
}
