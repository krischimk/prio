import { useWorkspace } from '../app/useWorkspace'
import { describeReminderState } from './status/reminderStatus'
import { mutedText, statusTone } from './styles'
import { Button } from './components/Button'

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
      <Button
        variant="primary" size="sm"
        onClick={() => {
          void enableReminders()
        }}
      >
        Erinnerungen aktivieren
      </Button>
    )
  }

  if (!text) return null

  return (
    <span
      data-testid="reminder-status"
      className={`text-meta ${tone === 'error' ? statusTone.error.text : mutedText}`}
    >
      {text}
    </span>
  )
}
