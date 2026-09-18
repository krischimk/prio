import type {
  LocalNotificationsPort,
  ReminderPermission,
  ReminderToSchedule,
} from '../../src/reminders/localNotificationsPort'

/**
 * In-Memory-Ersatz für die Benachrichtigungen des Betriebssystems.
 *
 * Führt die geplanten Termine wie das echte System, damit Tests den Endzustand
 * prüfen können und nicht nur die Aufrufe.
 */
export class FakeNotificationsPort implements LocalNotificationsPort {
  permission: ReminderPermission = 'granted'

  /** Was aktuell "beim Betriebssystem" geplant ist. */
  readonly pending = new Map<number, ReminderToSchedule>()

  scheduleCalls = 0
  cancelCalls = 0
  requestCalls = 0

  failScheduleWith: Error | null = null

  async checkPermission(): Promise<ReminderPermission> {
    return this.permission
  }

  async requestPermission(): Promise<ReminderPermission> {
    this.requestCalls += 1
    return this.permission
  }

  async schedule(reminders: ReminderToSchedule[]): Promise<void> {
    this.scheduleCalls += 1
    if (this.failScheduleWith) throw this.failScheduleWith
    for (const reminder of reminders) this.pending.set(reminder.notificationId, reminder)
  }

  async cancel(notificationIds: number[]): Promise<void> {
    this.cancelCalls += 1
    for (const id of notificationIds) this.pending.delete(id)
  }

  /** Alle geplanten Titel, sortiert – für gut lesbare Zusicherungen. */
  titles(): string[] {
    return [...this.pending.values()].map((reminder) => reminder.title).sort()
  }
}
