import { LocalNotifications } from '@capacitor/local-notifications'
import { isNativeApp } from '../app/platform'
import type {
  LocalNotificationsPort,
  ReminderPermission,
  ReminderToSchedule,
} from './localNotificationsPort'

/**
 * Umsetzung mit `@capacitor/local-notifications`.
 *
 * Die Termine werden beim Betriebssystem hinterlegt (Android: AlarmManager).
 * Sie kommen deshalb auch an, wenn die App geschlossen ist – das ist der
 * Unterschied zu einem Timer im JavaScript.
 *
 * Bewusst NICHT angefragt wird die Berechtigung für *exakte* Alarme
 * (`SCHEDULE_EXACT_ALARM`). Sie erfordert auf Android 12+ einen Extra-Weg durch
 * die Systemeinstellungen und ist für Erinnerungen an Aufgaben nicht nötig:
 * `allowWhileIdle` sorgt dafür, dass die Erinnerung auch im Energiesparmodus
 * zugestellt wird, gegebenenfalls um wenige Minuten verzögert.
 *
 * Im Browser gibt es keine geplanten Benachrichtigungen – dort meldet der Port
 * `unsupported`, und die App zeigt die Funktion gar nicht erst an.
 */
export function createCapacitorNotificationsPort(): LocalNotificationsPort {
  return {
    async checkPermission(): Promise<ReminderPermission> {
      if (!isNativeApp()) return 'unsupported'
      try {
        const status = await LocalNotifications.checkPermissions()
        return mapPermission(status.display)
      } catch {
        return 'unsupported'
      }
    },

    async requestPermission(): Promise<ReminderPermission> {
      if (!isNativeApp()) return 'unsupported'
      try {
        const status = await LocalNotifications.requestPermissions()
        return mapPermission(status.display)
      } catch {
        return 'denied'
      }
    },

    async schedule(reminders: ReminderToSchedule[]): Promise<void> {
      if (reminders.length === 0) return
      await LocalNotifications.schedule({
        notifications: reminders.map((reminder) => ({
          id: reminder.notificationId,
          title: reminder.title,
          body: reminder.body,
          schedule: { at: new Date(reminder.at), allowWhileIdle: true },
          extra: { taskId: reminder.taskId },
        })),
      })
    },

    async cancel(notificationIds: number[]): Promise<void> {
      if (notificationIds.length === 0) return
      await LocalNotifications.cancel({
        notifications: notificationIds.map((id) => ({ id })),
      })
    },
  }
}

function mapPermission(display: string): ReminderPermission {
  if (display === 'granted') return 'granted'
  if (display === 'denied') return 'denied'
  return 'prompt'
}
