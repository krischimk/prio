import { systemClock, type Clock } from '../domain/clock'
import type { LocalDatabase } from '../db/localDb'
import { readMeta, writeMeta } from '../sync/syncStore'
import type { LocalNotificationsPort, ReminderPermission } from './localNotificationsPort'
import { planReminders } from './reminderPlan'
import { reconcileReminders } from './reminderReconciler'

/**
 * Erinnerungen für fällige Aufgaben.
 *
 * Ablauf eines Abgleichs (`sync`):
 *   1. Berechtigung prüfen. Fehlt sie, wird nichts angefasst.
 *   2. Aufgaben und Listen lokal lesen und daraus den Soll-Zustand berechnen
 *      (reine Funktion, siehe `reminderPlan.ts`).
 *   3. Mit dem zuletzt geplanten Zustand abgleichen (`reminderReconciler.ts`).
 *   4. Beim Betriebssystem abbrechen und neu planen.
 *   5. Den neuen Zustand lokal festhalten.
 *
 * Der Abgleich ist idempotent: Läuft er mehrfach, passiert beim zweiten Mal
 * nichts. Deshalb kann er gefahrlos nach jedem Sync und nach jeder lokalen
 * Änderung laufen.
 *
 * Diese Datei kennt weder React noch Capacitor und ist damit vollständig
 * testbar.
 */

export const META_REMINDER_ID_COUNTER = 'reminder_id_counter'

export type ReminderStatusKind =
  | 'ok'
  | 'unsupported'
  | 'permission-required'
  | 'permission-denied'
  | 'error'

export interface ReminderStatus {
  kind: ReminderStatusKind
  permission: ReminderPermission
  /** Anzahl der aktuell geplanten Erinnerungen. */
  scheduled: number
  message: string | null
}

export interface ReminderService {
  /** Nur lesen: Berechtigung und Anzahl, ohne etwas zu verändern. */
  status(): Promise<ReminderStatus>
  /** Fragt die Berechtigung an und gleicht danach ab. */
  enable(): Promise<ReminderStatus>
  /** Gleicht den geplanten Zustand mit den Aufgaben ab. */
  sync(): Promise<ReminderStatus>
}

export function createReminderService(options: {
  db: LocalDatabase
  port: LocalNotificationsPort
  clock?: Clock
}): ReminderService {
  const clock = options.clock ?? systemClock
  let current: Promise<ReminderStatus> | null = null

  async function describe(
    permission: ReminderPermission,
    scheduled: number,
    kind: ReminderStatusKind,
    message: string | null = null,
  ): Promise<ReminderStatus> {
    return { kind, permission, scheduled, message }
  }

  async function run(): Promise<ReminderStatus> {
    const permission = await options.port.checkPermission()

    if (permission === 'unsupported') {
      return describe(permission, 0, 'unsupported')
    }
    if (permission !== 'granted') {
      return describe(permission, 0, permission === 'denied' ? 'permission-denied' : 'permission-required')
    }

    const [tasks, lists, tracked] = await Promise.all([
      options.db.tasks.toArray(),
      options.db.lists.toArray(),
      options.db.reminders.toArray(),
    ])

    const desired = planReminders(tasks, lists, clock.nowMs())

    let counter = Number(await readMeta(options.db, META_REMINDER_ID_COUNTER))
    if (!Number.isFinite(counter) || counter < 0) counter = 0
    const allocateNotificationId = () => {
      counter += 1
      return counter
    }

    const actions = reconcileReminders(desired, tracked, allocateNotificationId)

    // Erst beim Betriebssystem aufräumen, dann neu planen. Umgekehrt könnte
    // ein verschobener Termin kurz doppelt existieren.
    // Leere Aufrufe werden übersprungen – ein idempotenter Lauf soll das
    // Betriebssystem gar nicht erst berühren.
    if (actions.cancel.length > 0) await options.port.cancel(actions.cancel)
    if (actions.schedule.length > 0) await options.port.schedule(actions.schedule)

    await options.db.transaction('rw', options.db.reminders, async () => {
      await options.db.reminders.clear()
      if (actions.tracked.length > 0) {
        await options.db.reminders.bulkPut(actions.tracked)
      }
    })
    await writeMeta(options.db, META_REMINDER_ID_COUNTER, String(counter))

    return describe(permission, actions.tracked.length, 'ok')
  }

  /** Parallele Aufrufe werden serialisiert – der Zustand darf nicht doppelt laufen. */
  async function serialized(operation: () => Promise<ReminderStatus>): Promise<ReminderStatus> {
    while (current) {
      await current.catch(() => undefined)
    }
    current = operation().catch(async (error: unknown) => {
      const permission = await options.port.checkPermission().catch(() => 'unsupported' as const)
      return describe(
        permission,
        0,
        'error',
        error instanceof Error ? error.message : 'Erinnerungen konnten nicht geplant werden.',
      )
    })
    try {
      return await current
    } finally {
      current = null
    }
  }

  return {
    async status() {
      const permission = await options.port.checkPermission()
      if (permission === 'unsupported') return describe(permission, 0, 'unsupported')
      if (permission !== 'granted') {
        return describe(permission, 0, permission === 'denied' ? 'permission-denied' : 'permission-required')
      }
      const scheduled = await options.db.reminders.count()
      return describe(permission, scheduled, 'ok')
    },

    async enable() {
      const permission = await options.port.requestPermission()
      if (permission === 'unsupported') return describe(permission, 0, 'unsupported')
      if (permission !== 'granted') {
        return describe(permission, 0, 'permission-denied')
      }
      return serialized(run)
    },

    async sync() {
      return serialized(run)
    },
  }
}
