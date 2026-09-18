import { fromRemoteList, fromRemoteMember, fromRemoteTask } from '../domain/mapping'
import { resolveMerge, type MergeOutcome } from '../domain/merge'
import type { RemoteList, RemoteListMember, RemoteTask } from '../domain/types'
import type { LocalDatabase } from '../db/localDb'

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

function addOutcome(stats: ApplyStats, outcome: MergeOutcome): void {
  if (outcome === 'inserted') stats.inserted += 1
  else if (outcome === 'remote-wins') stats.remoteWins += 1
  else if (outcome === 'local-wins') stats.localWins += 1
  else stats.unchanged += 1
}

export async function applyRemoteLists(db: LocalDatabase, remote: RemoteList[]): Promise<ApplyStats> {
  const stats = emptyStats()
  await db.transaction('rw', db.lists, async () => {
    for (const remoteList of remote) {
      const local = await db.lists.get(remoteList.id)
      const { row, outcome } = resolveMerge(local, fromRemoteList(remoteList))
      if (outcome !== 'unchanged') {
        await db.lists.put(row)
      }
      addOutcome(stats, outcome)
    }
  })
  return stats
}

export async function applyRemoteTasks(db: LocalDatabase, remote: RemoteTask[]): Promise<ApplyStats> {
  const stats = emptyStats()
  await db.transaction('rw', db.lists, db.tasks, async () => {
    for (const remoteTask of remote) {
      // Aufgaben ohne lokal bekannte Liste werden übersprungen. Das kann bei
      // RLS-Verletzungen oder halb übertragenen Snapshots passieren und würde
      // sonst unsichtbare Waisen erzeugen.
      const parent = await db.lists.get(remoteTask.list_id)
      if (!parent) continue

      const local = await db.tasks.get(remoteTask.id)
      const { row, outcome } = resolveMerge(local, fromRemoteTask(remoteTask))
      if (outcome !== 'unchanged') {
        await db.tasks.put(row)
      }
      addOutcome(stats, outcome)
    }
  })
  return stats
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
  await db.transaction('rw', db.lists, db.list_members, db.tasks, async () => {
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

      const key: [string, string] = [remoteMember.list_id, remoteMember.user_id]
      const local = await db.list_members.get(key)
      const { row, outcome } = resolveMerge(local, fromRemoteMember(remoteMember))
      if (outcome !== 'unchanged') {
        await db.list_members.put(row)
      }
      addOutcome(stats, outcome)
    }
  })
  return stats
}
