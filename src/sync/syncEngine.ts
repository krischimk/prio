import { systemClock, type Clock } from '../domain/clock'
import { isEmptyPayload, toPushPayload } from '../domain/mapping'
import type { IsoDateTime } from '../domain/types'
import type { LocalDatabase } from '../db/localDb'
import { applyRemoteLists, applyRemoteMembers, applyRemoteTasks } from './applyRemote'
import { classifyRemoteError, type RemoteError, type RemoteGateway } from './remoteGateway'
import { collectDirty, markPushed, META_LAST_SYNC_AT, writeMeta } from './syncStore'

/**
 * Sync-Engine.
 *
 * Ablauf eines Durchlaufs (bewusst einfach und in dieser Reihenfolge):
 *
 *   1. Offline? → sofort abbrechen, nichts anfassen.
 *   2. Alle `dirty`-Zeilen sammeln und zu Supabase hochladen (Upsert).
 *   3. Erfolgreich hochgeladene Zeilen als sauber markieren.
 *   4. Kompletten Serverbestand herunterladen.
 *   5. Heruntergeladene Zeilen zusammenführen (Last Write Wins, siehe `merge.ts`).
 *
 * Erst pushen, dann pullen: Dadurch gewinnt bei gleichem Zeitstempel die
 * lokale Änderung, weil sie bereits auf dem Server liegt.
 *
 * Fehlerverhalten:
 *  - Ein lokaler Fehlschlag beim Push bricht den Pull nicht ab (außer bei
 *    Offline/Auth). So bleiben die Daten wenigstens in einer Richtung aktuell.
 *  - Ein fehlgeschlagener Upload lässt die Zeilen `dirty` – es geht nichts
 *    verloren, der nächste Durchlauf versucht es erneut.
 *
 * Bewusste Vereinfachung: Ein Datensatz, den der Server dauerhaft ablehnt
 * (z. B. weil der Zugriff auf eine gemeinsame Liste entzogen wurde), bleibt
 * dauerhaft in der Queue und wird bei jedem Sync erneut versucht. Für 0.1
 * ist das akzeptabel; ein Ausbau würde abgelehnte Zeilen separat ablegen.
 *
 * Diese Datei hängt nicht von React ab und ist ohne Cloud testbar.
 */

export type SyncStatusKind = 'ok' | 'partial' | 'offline' | 'auth' | 'error'

export interface SyncResult {
  kind: SyncStatusKind
  /** Anzahl erfolgreich hochgeladener Zeilen. */
  pushed: number
  /** Anzahl heruntergeladener Zeilen. */
  pulled: number
  message: string | null
  at: IsoDateTime
}

export interface SyncEngineOptions {
  db: LocalDatabase
  gateway: RemoteGateway
  /** Benutzer-ID der angemeldeten Person (für "wurde aus Liste entfernt"). */
  currentUserId: string
  clock?: Clock
  isOnline?: () => boolean
  /** Wird nach jedem Durchlauf aufgerufen (für die Statusanzeige). */
  onResult?: (result: SyncResult) => void
}

export interface SyncEngine {
  /** Führt einen Sync aus. Parallele Aufrufe werden serialisiert. */
  sync(): Promise<SyncResult>
  /** `true`, solange ein Durchlauf läuft. */
  isBusy(): boolean
}

export const OFFLINE_MESSAGE = 'Offline – Änderungen werden später synchronisiert.'

export function createSyncEngine(options: SyncEngineOptions): SyncEngine {
  const clock = options.clock ?? systemClock
  const isOnline = options.isOnline ?? (() => true)
  let current: Promise<SyncResult> | null = null

  async function execute(): Promise<SyncResult> {
    const at = clock.now()

    const result = (kind: SyncStatusKind, message: string | null): SyncResult => ({
      kind,
      pushed: 0,
      pulled: 0,
      message,
      at,
    })

    if (!isOnline()) {
      return result('offline', OFFLINE_MESSAGE)
    }

    const dirty = await collectDirty(options.db)
    const payload = toPushPayload(dirty.lists, dirty.members, dirty.tasks)
    const pushCount = payload.lists.length + payload.members.length + payload.tasks.length

    let pushed = 0
    let pushError: RemoteError | null = null

    if (!isEmptyPayload(payload)) {
      try {
        await options.gateway.push(payload)
        await markPushed(options.db, payload)
        pushed = pushCount
      } catch (error) {
        pushError = classifyRemoteError(error)
      }
    }

    if (pushError && (pushError.kind === 'offline' || pushError.kind === 'auth')) {
      const kind: SyncStatusKind = pushError.kind
      return result(kind, kind === 'offline' ? OFFLINE_MESSAGE : pushError.message)
    }

    let pulled = 0
    let pullError: RemoteError | null = null

    try {
      const snapshot = await options.gateway.pull()
      // Reihenfolge: Listen → Mitgliedschaften → Aufgaben.
      await applyRemoteLists(options.db, snapshot.lists)
      await applyRemoteMembers(options.db, snapshot.members, options.currentUserId)
      await applyRemoteTasks(options.db, snapshot.tasks)
      pulled = snapshot.lists.length + snapshot.members.length + snapshot.tasks.length
      await writeMeta(options.db, META_LAST_SYNC_AT, at)
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
      const message =
        kind === 'offline'
          ? OFFLINE_MESSAGE
          : (pushError?.message ?? pullError?.message ?? 'Synchronisation fehlgeschlagen.')
      return { kind, pushed, pulled, message, at }
    }

    return { kind: 'ok', pushed, pulled, message: null, at }
  }

  return {
    async sync() {
      // Läuft bereits ein Sync, wird dieser abgewartet und danach ein eigener
      // Durchlauf gestartet. So ist garantiert, dass der Aufrufer einen
      // Durchlauf bekommt, der seine Änderung enthält.
      while (current) {
        await current.catch(() => undefined)
      }
      current = execute()
      try {
        const finished = await current
        options.onResult?.(finished)
        return finished
      } finally {
        current = null
      }
    },
    isBusy: () => current !== null,
  }
}
