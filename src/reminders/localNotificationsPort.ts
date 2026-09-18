import type { IsoDateTime } from '../domain/types'

/**
 * Abstraktion für lokale Benachrichtigungen.
 *
 * Wie beim `RemoteGateway` kennt die Logik nur dieses Interface – dadurch sind
 * Planung und Abgleich ohne Android und ohne Plugin testbar.
 */

export type ReminderPermission =
  /** Erlaubt – Erinnerungen können geplant werden. */
  | 'granted'
  /** Vom Benutzer abgelehnt; nur die Systemeinstellungen können das ändern. */
  | 'denied'
  /** Noch nicht gefragt. */
  | 'prompt'
  /** Plattform unterstützt keine geplanten Benachrichtigungen (z. B. Browser). */
  | 'unsupported'

export interface ReminderToSchedule {
  notificationId: number
  at: IsoDateTime
  title: string
  body: string
  /** Wird mitgegeben, damit die Benachrichtigung zur Aufgabe zurückverfolgbar ist. */
  taskId: string
}

export interface LocalNotificationsPort {
  checkPermission(): Promise<ReminderPermission>
  requestPermission(): Promise<ReminderPermission>
  schedule(reminders: ReminderToSchedule[]): Promise<void>
  cancel(notificationIds: number[]): Promise<void>
}
