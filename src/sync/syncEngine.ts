import { systemClock, type Clock } from '../domain/clock'
import { isEmptyPayload, toPushPayload } from '../domain/mapping'
import type { IsoDateTime } from '../domain/types'
import type { LocalDatabase } from '../db/localDb'
import { acceptCloudRow, readCloudConflicts, readCloudState, readLocalCloudRow, writeCloudState } from '../db/cloudState'
import { CLOUD_TABLES, cloudRowId, type CloudRow } from '../domain/cloudMerge'
import { sameData } from '../domain/equality'
import { newId } from '../domain/ids'
import { applyRemoteLists, applyRemoteMembers, applyRemoteTasks, applyRemotePreferences } from './applyRemote'
import {
  classifyRemoteError,
  type PushTabelle,
  type RemoteError,
  type SyncTransport,
  type PushBases,
} from './remoteGateway'
import {
  collectDirty,
  markPushed,
  merkeAbgelehnt,
  META_LAST_SYNC_AT,
  META_PULL_CHECKPOINT,
  META_APPLIED_DATA_VERSION,
  readPullCheckpoint,
  readMeta,
  vergissAbgelehnt,
  writeMeta,
} from './syncStore'

/**
 * Sync-Engine.
 *
 * Dirty-Zeilen und bestätigte Basis werden gemeinsam gelesen, geschützt
 * geschrieben und anhand des bestätigten Inhalts bereinigt. Der Drei-Wege-
 * Vergleich führt unabhängige Felder automatisch zusammen; dafür gibt es
 * höchstens einen unmittelbaren weiteren Schreibversuch. Widersprechende
 * Änderungen bleiben lokal erhalten und werden als Konflikt gespeichert.
 * Danach werden Änderungen seit dem bestätigten Serverstand zusammengeführt.
 *
 * Dauerhafte Ablehnungen werden je Zeile isoliert, vorübergehende Fehler
 * bleiben erneut versuchbar. Ein Schreibfehler verhindert den Pull nur bei
 * Offline/Auth. Gerätezeitpunkte bestimmen keinen Konfliktgewinner.
 *
 * Diese Datei hängt nicht von React ab und ist ohne Cloud testbar.
 */

export type SyncStatusKind = 'ok' | 'partial' | 'offline' | 'auth' | 'error' | 'conflict'

export interface SyncResult {
  kind: SyncStatusKind
  /** Anzahl erfolgreich hochgeladener Zeilen. */
  pushed: number
  /** Anzahl heruntergeladener Zeilen. */
  pulled: number
  /** Tatsächliche Änderungen an lokalen Daten oder sichtbaren Konflikten. */
  changed: boolean
  message: string | null
  at: IsoDateTime
}

export interface SyncEngineOptions {
  db: LocalDatabase
  gateway: SyncTransport
  /** Benutzer-ID der angemeldeten Person (für "wurde aus Liste entfernt"). */
  currentUserId: string
  clock?: Clock
  isOnline?: () => boolean
  /** Beendete Laufzeiten übernehmen keine verspäteten Netzwerkantworten. */
  isActive?: () => boolean
  /** Wird nach jedem Durchlauf aufgerufen (für die Statusanzeige). */
  onResult?: (result: SyncResult) => void
}

export interface SyncEngine {
  /** Parallele Anforderungen teilen sich höchstens einen vorgemerkten Folgelauf. */
  sync(): Promise<SyncResult>
  /** `true`, solange ein Durchlauf läuft. */
  isBusy(): boolean
}

export function createSyncEngine(options: SyncEngineOptions): SyncEngine {
  const clock = options.clock ?? systemClock
  const isOnline = options.isOnline ?? (() => true)
  const isActive = options.isActive ?? (() => true)
  let current: Promise<SyncResult> | null = null
  let queued = false
  let observedDataVersion: string | null | undefined

  async function execute(): Promise<SyncResult> {
    const at = clock.now()
    let changed = false

    const result = (kind: SyncStatusKind, message: string | null): SyncResult => ({
      kind,
      pushed: 0,
      pulled: 0,
      changed,
      message,
      at,
    })

    if (!isActive()) return result('ok', null)
    if (!isOnline()) {
      return result('offline', null)
    }
    if (observedDataVersion === undefined) observedDataVersion = await readMeta(options.db, META_APPLIED_DATA_VERSION)

    let pushed = 0
    let pushError: RemoteError | null = null

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const { payload, bases } = await options.db.transaction('r', [options.db.lists, options.db.tasks, options.db.list_members, options.db.list_preferences, options.db.user_preferences, options.db.meta], async () => {
        const dirty = await collectDirty(options.db)
        const payload = toPushPayload(dirty.lists, dirty.members, dirty.tasks, dirty.preferences, dirty.userPreferences)
        const bases: PushBases = Object.fromEntries(CLOUD_TABLES.map(table => [table, {}]))
        await Promise.all(CLOUD_TABLES.flatMap(table => (payload[table] ?? []).map(async row => {
          const id = cloudRowId(table, row)
          bases[table]![id] = (await readCloudState(options.db, table, id)).base ?? null
        })))
        // Zeile und bestätigte Basis gehören zu derselben Momentaufnahme,
        // auch wenn ein zweiter Browser-Tab gerade synchronisiert.
        return { payload, bases }
      })
      if (isEmptyPayload(payload)) break
      // Für das Ablagefach: welche Zeilen steckten in welcher Tabelle?
      const kennungen = Object.fromEntries(CLOUD_TABLES.map(table => [table,
        (payload[table] ?? []).map(row => ({ tabelle: table, id: cloudRowId(table, row), updated_at: row.updated_at, row })),
      ])) as Record<PushTabelle, Array<{ tabelle: PushTabelle; id: string; updated_at: IsoDateTime; row: CloudRow }>>

      try {
        const ergebnis = await options.gateway.push(payload, bases)
        if (!isActive()) return result('ok', null)

        // Nur markieren, was wirklich angekommen ist – der Rest bleibt dirty.
        await markPushed(options.db, ergebnis.hochgeladen)
        await vergissAbgelehnt(options.db, ergebnis.hochgeladen)
        pushed += CLOUD_TABLES.reduce((sum, table) => sum + (ergebnis.hochgeladen[table]?.length ?? 0), 0)

        if (ergebnis.fehler.length > 0) {
          const offline = ergebnis.fehler.find((eintrag) => eintrag.error.kind === 'offline')
          const auth = ergebnis.fehler.find((eintrag) => eintrag.error.kind === 'auth')
          if (offline || auth) {
            // Kein Netz oder Sitzung abgelaufen: Alles bleibt liegen, und es
            // wird **nicht** gezählt – der nächste Versuch kommt von selbst.
            pushError = offline?.error ?? auth!.error
          } else {
            /*
             * Der Server hat abgelehnt. Fehlversuche werden gezählt: Erst nach
             * ein paar Anläufen wandert eine Zeile ins Ablagefach und blockiert
             * dann nichts mehr. Ein einzelner Serverfehler soll sie nicht aus
             * dem Abgleich nehmen.
             */
            for (const { tabelle, ids, error } of ergebnis.fehler) {
              if (error.retryable) continue
              const rejected = kennungen[tabelle].filter(row => !ids || ids.includes(row.id))
              await merkeAbgelehnt(options.db, rejected, error.message, at)
            }
            pushError = ergebnis.fehler[0].error
          }
        }
        for (const conflict of ergebnis.konflikte ?? []) {
          if (conflict.remote) {
            await options.db.transaction('rw', [options.db.lists, options.db.tasks, options.db.list_members, options.db.list_preferences, options.db.user_preferences, options.db.meta], async () => {
              if (await acceptCloudRow(options.db, conflict.table, conflict.remote!) !== 'unchanged') changed = true
            })
          } else {
            await options.db.transaction('rw', [options.db.lists, options.db.tasks, options.db.list_members, options.db.list_preferences, options.db.user_preferences, options.db.meta], async () => {
              const local = await readLocalCloudRow(options.db, conflict.table, conflict.id)
              const state = await readCloudState(options.db, conflict.table, conflict.id)
              if (local && await writeCloudState(options.db, conflict.table, conflict.id, { ...state, conflict: { ...conflict, local: local.row, fields: ['missing'] } })) changed = true
            })
          }
        }
        // Ein disjunkter Feldkonflikt wurde lokal zusammengeführt und kann
        // einmal gegen seine neue Basis versucht werden. Kein endloser Retry.
        if (!ergebnis.konflikte?.length || pushError) break
      } catch (error) {
        // Eine Implementierung, die wirft (etwa „gar kein Netz“), gilt als
        // vollständiger Fehlschlag – alles bleibt dirty.
        pushError = classifyRemoteError(error)
        break
      }
    }

    if (pushError && (pushError.kind === 'offline' || pushError.kind === 'auth')) {
      const kind: SyncStatusKind = pushError.kind
      return result(kind, kind === 'offline' ? null : pushError.message)
    }

    let pulled = 0
    let pullError: RemoteError | null = null

    try {
      if (!isActive()) return result('ok', null)
      const checkpoint = await readPullCheckpoint(options.db)
      const snapshot = await options.gateway.pull(checkpoint)
      await options.db.transaction('rw', [options.db.lists, options.db.tasks, options.db.list_members, options.db.list_preferences, options.db.user_preferences, options.db.meta], async () => {
        if (!isActive()) return
        // Ein anderer Tab darf eine neuere bestätigte Sicht nicht zurückdrehen.
        if (!sameData(checkpoint, await readPullCheckpoint(options.db))) {
          const applied = await readMeta(options.db, META_APPLIED_DATA_VERSION)
          if (applied !== observedDataVersion) changed = true
          observedDataVersion = applied
          queued = true
          return
        }
        let appliedChange = changed
        const stats = [
          await applyRemoteLists(options.db, snapshot.lists),
          await applyRemoteMembers(options.db, snapshot.members, options.currentUserId),
          await applyRemoteTasks(options.db, snapshot.tasks),
          await applyRemotePreferences(options.db, snapshot.preferences ?? [], snapshot.userPreferences ?? [], options.currentUserId),
        ]
        for (const listId of snapshot.removedListIds ?? []) {
          const list = await options.db.lists.get(listId)
          if (!checkpoint?.listIds.includes(listId) || !list || list.owner_id === options.currentUserId) continue
          await options.db.tasks.where('list_id').equals(listId).delete()
          await options.db.list_members.where('list_id').equals(listId).delete()
          await options.db.lists.delete(listId)
          appliedChange = true
        }
        if (stats.some(stat => stat.inserted + stat.remoteWins + stat.localWins > 0)) appliedChange = true
        if (appliedChange) await writeMeta(options.db, META_APPLIED_DATA_VERSION, newId())
        const applied = await readMeta(options.db, META_APPLIED_DATA_VERSION)
        if (appliedChange || applied !== observedDataVersion) changed = true
        observedDataVersion = applied
        if (snapshot.checkpoint) await writeMeta(options.db, META_PULL_CHECKPOINT, JSON.stringify(snapshot.checkpoint))
        pulled = CLOUD_TABLES.reduce((sum, table) => sum + (snapshot[table]?.length ?? 0), 0)
        await writeMeta(options.db, META_LAST_SYNC_AT, at)
      })
    } catch (error) {
      pullError = classifyRemoteError(error)
    }

    if (pushError || pullError) {
      const kind: SyncStatusKind =
        pushError?.kind === 'offline' || pullError?.kind === 'offline'
          ? 'offline'
          : pushError?.kind === 'auth' || pullError?.kind === 'auth'
            ? 'auth'
            : pushError && pullError
              ? 'error'
              : 'partial'
      // Kein Text aus der Fachschicht: Die Engine kennt den **Zustand**, die
      // Formulierung steht in `src/ui/status/syncStatus.ts`. Der Serverfehler
      // wird durchgereicht, weil er die Ursache benennt.
      const message = pushError?.message ?? pullError?.message ?? null
      return { kind, pushed, pulled, changed, message, at }
    }

    if ((await readCloudConflicts(options.db)).length > 0) return { kind: 'conflict', pushed, pulled, changed, message: null, at }
    return { kind: 'ok', pushed, pulled, changed, message: null, at }
  }

  return {
    sync() {
      if (current) { queued = true; return current }
      current = (async () => {
        let finished: SyncResult
        let changed = false, pushed = 0, pulled = 0
        do {
          queued = false
          finished = await execute()
          changed ||= finished.changed
          pushed += finished.pushed
          pulled += finished.pulled
          options.onResult?.(finished)
        } while (queued && isActive())
        return { ...finished, changed, pushed, pulled }
      })().finally(() => { current = null })
      return current
    },
    isBusy: () => current !== null,
  }
}
