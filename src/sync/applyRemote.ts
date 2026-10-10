import type { RemoteList, RemoteListMember, RemoteListPreference, RemoteTask, RemoteUserPreference } from '../domain/types'
import type { LocalDatabase } from '../db/localDb'
import { acceptCloudRow } from '../db/cloudState'

/**
 * Übernahme heruntergeladener Serverdaten in die lokale Datenbank.
 *
 * Diese Datei enthält die eigentliche Konfliktlogik beim Pull. Sie ist bewusst
 * frei von React, Supabase und Netzwerkzugriff und damit direkt testbar.
 *
 * Reihenfolge im Sync (siehe `syncEngine.ts`): erst Listen, dann
 * Mitgliedschaften, dann Aufgaben. Die Aufgaben zuletzt, weil sie sich auf
 * Listen beziehen.
 */

export interface ApplyStats {
  inserted: number
  remoteWins: number
  localWins: number
  unchanged: number
}

export function emptyStats(): ApplyStats {
  return { inserted: 0, remoteWins: 0, localWins: 0, unchanged: 0 }
}

function addOutcome(stats: ApplyStats, outcome: Awaited<ReturnType<typeof acceptCloudRow>>): void {
  if (outcome === 'inserted') stats.inserted += 1
  else if (outcome === 'remote-wins') stats.remoteWins += 1
  else if (outcome === 'local-wins') stats.localWins += 1
  else stats.unchanged += 1
}

export async function applyRemoteLists(db: LocalDatabase, remote: RemoteList[]): Promise<ApplyStats> {
  const stats = emptyStats()
  await db.transaction('rw', db.lists, db.meta, async () => {
    for (const remoteList of remote) {
      const outcome = await acceptCloudRow(db, 'lists', remoteList)
      addOutcome(stats, outcome)
    }
  })
  return stats
}

export async function applyRemoteTasks(db: LocalDatabase, remote: RemoteTask[]): Promise<ApplyStats> {
  const stats = emptyStats()
  await db.transaction('rw', db.lists, db.tasks, db.meta, async () => {
    for (const remoteTask of remote) {
      // Aufgaben ohne lokal bekannte Liste werden übersprungen. Das kann bei
      // RLS-Verletzungen oder halb übertragenen Snapshots passieren und würde
      // sonst unsichtbare Waisen erzeugen.
      const parent = await db.lists.get(remoteTask.list_id)
      if (!parent) continue

      const outcome = await acceptCloudRow(db, 'tasks', remoteTask)
      addOutcome(stats, outcome)
    }
  })
  return stats
}

/** Persönliche Einstellungen werden nur für den angemeldeten Benutzer gelesen. */
export async function applyRemotePreferences(db: LocalDatabase, preferences: RemoteListPreference[], userPreferences: RemoteUserPreference[], userId: string): Promise<void> {
  await db.transaction('rw', db.list_preferences, db.user_preferences, db.meta, async () => {
    for (const row of preferences) {
      if (row.user_id === userId) await acceptCloudRow(db, 'preferences', row)
    }
    for (const row of userPreferences) {
      if (row.id === userId) await acceptCloudRow(db, 'userPreferences', row)
    }
  })
}

/**
 * Mitgliedschaften übernehmen.
 *
 * Sonderfall Entfernen: Der Besitzer markiert die Mitgliedschaft serverseitig
 * mit `deleted_at`. Der entfernte Benutzer darf seine eigene Zeile weiterhin
 * lesen (RLS) und erfährt dadurch, dass er keinen Zugriff mehr hat. Seine
 * lokale Kopie der fremden Liste wird daraufhin vollständig entfernt – sie
 * gehört ihm nicht, und ein weiterer Sync würde daran scheitern, dass der
 * Server jede Schreiboperation ablehnt.
 *
 * Wird derselbe Benutzer später erneut hinzugefügt, kommt die Liste beim
 * nächsten Pull einfach wieder vollständig vom Server.
 */
export async function applyRemoteMembers(
  db: LocalDatabase,
  remote: RemoteListMember[],
  currentUserId: string,
): Promise<ApplyStats> {
  const stats = emptyStats()
  await db.transaction('rw', db.lists, db.list_members, db.tasks, db.meta, async () => {
    for (const remoteMember of remote) {
      const isSelf = remoteMember.user_id === currentUserId

      if (isSelf && remoteMember.deleted_at !== null) {
        const list = await db.lists.get(remoteMember.list_id)
        // Nur fremde Listen entfernen. Eine eigene, selbst gelöschte Liste
        // bleibt als Soft-Delete-Tombstone erhalten, damit die Löschung
        // hochgeladen werden kann.
        if (list && list.owner_id !== currentUserId) {
          await db.tasks.where('list_id').equals(remoteMember.list_id).delete()
          await db.list_members.where('list_id').equals(remoteMember.list_id).delete()
          await db.lists.delete(remoteMember.list_id)
        }
        continue
      }

      const outcome = await acceptCloudRow(db, 'members', remoteMember)
      addOutcome(stats, outcome)
    }
  })
  return stats
}
