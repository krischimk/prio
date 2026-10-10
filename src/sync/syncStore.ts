import type { IsoDateTime, LocalList, LocalListMember, LocalListPreference, LocalTask, LocalUserPreference, PushPayload } from '../domain/types'
import type { LocalDatabase } from '../db/localDb'
import { readMeta, writeMeta } from '../db/metaStore'
import type { PushTabelle } from './remoteGateway'
import { sameData } from '../domain/equality'
import { toRemoteList, toRemoteMember, toRemoteTask, toRemotePreference, toRemoteUserPreference } from '../domain/mapping'
import { readCloudConflicts, readLocalCloudRow, writeCloudState } from '../db/cloudState'
import { canonicalCloudRow, type CloudRow } from '../domain/cloudMerge'

/**
 * Persistenz-Helfer für die Sync-Engine.
 *
 * Die "Sync-Queue" ist bewusst keine eigene Tabelle, sondern das `dirty`-Flag
 * direkt an der Zeile:
 *  - kein zweiter Zustand, der auseinanderlaufen kann,
 *  - eine Änderung an derselben Zeile erzeugt keinen doppelten Queue-Eintrag,
 *  - die Queue ist per Index abfragbar (`dirty = 1`).
 * Pro Sync wird der vollständige lokale Stand gegen die bestätigte Basis
 * geschrieben. Die Basis und echte Konflikte liegen in `cloudState`; das
 * Ablagefach hält den Inhalt dauerhaft abgelehnter Übertragungen fest.
 */

export const META_LAST_SYNC_AT = 'last_sync_at'
export const META_LAST_SYNC_STATUS = 'last_sync_status'

/**
 * Das Ablagefach für Zeilen, die der Server **dauerhaft** ablehnt.
 *
 * Anlass: Der Upload war alles-oder-nichts. Lehnte der Server eine Zeile ab
 * (etwa weil der Zugriff auf eine geteilte Liste entzogen wurde), blieb alles
 * `dirty`, der Zähler „N Änderungen warten“ wurde nie leer, und alle 30 Sekunden
 * ging derselbe Datenberg erneut raus.
 *
 * Jetzt wird gezählt: Erst nach `ABGELEHNT_AB_VERSUCHEN` Fehlversuchen wird eine
 * Zeile beiseitegelegt – ein einzelner Netzwerk- oder Serverfehler soll sie nicht
 * aus dem Abgleich nehmen. Beiseitegelegte Zeilen blockieren nichts mehr; ändert
 * sich ihr Inhalt lokal, wird sie wieder versucht, auch bei gleichem
 * Zeitstempel. Ihr abgelehnter Inhalt bleibt zusätzlich im Ablagefach erhalten.
 */
export interface AbgelehnteZeile {
  tabelle: PushTabelle
  id: string
  /** Der abgelehnte Stand. Ändert er sich, wird es erneut versucht. */
  updated_at: IsoDateTime
  row?: CloudRow
  versuche: number
  message: string
  at: IsoDateTime
}

const META_ABGELEHNT = 'rejected_rows'

/** Ab so vielen Fehlversuchen wird eine Zeile beiseitegelegt. */
export const ABGELEHNT_AB_VERSUCHEN = 3

export async function readAbgelehnt(db: LocalDatabase): Promise<AbgelehnteZeile[]> {
  const roh = await readMeta(db, META_ABGELEHNT)
  if (roh === null) return []
  try {
    const werte: unknown = JSON.parse(roh)
    return Array.isArray(werte) ? (werte as AbgelehnteZeile[]) : []
  } catch {
    return []
  }
}

async function writeAbgelehnt(db: LocalDatabase, zeilen: AbgelehnteZeile[]): Promise<void> {
  // Auch die Ablehnungsdaten steuern den Retry. Sie bleiben bis zur Bestätigung
  // erhalten; ein Diagnose-Limit würde alte Zeilen unbeabsichtigt freigeben.
  await writeMeta(db, META_ABGELEHNT, JSON.stringify(zeilen))
}

/** Zählt einen Fehlversuch für diese Zeilen. */
export async function merkeAbgelehnt(
  db: LocalDatabase,
  zeilen: Array<{ tabelle: PushTabelle; id: string; updated_at: IsoDateTime; row?: CloudRow }>,
  message: string,
  at: IsoDateTime,
): Promise<void> {
  const bisher = await readAbgelehnt(db)
  const neu = [...bisher]
  for (const zeile of zeilen) {
    const vorhanden = neu.findIndex(
      (eintrag) => eintrag.tabelle === zeile.tabelle && eintrag.id === zeile.id,
    )
    if (vorhanden >= 0) {
      const old = neu[vorhanden]
      const same = zeile.row && old.row ? sameData(zeile.row, old.row) : !zeile.row && !old.row && zeile.updated_at === old.updated_at
      neu[vorhanden] = { ...zeile, versuche: same ? old.versuche + 1 : 1, message, at }
    } else {
      neu.push({ ...zeile, versuche: 1, message, at })
    }
  }
  await writeAbgelehnt(db, neu)
}

/** Vergisst alles, was durchgegangen ist (oder sich seit dem Ablehnen geändert hat). */
export async function vergissAbgelehnt(db: LocalDatabase, payload: PushPayload): Promise<void> {
  const bisher = await readAbgelehnt(db)
  if (bisher.length === 0) return
  const durch = new Set<string>([
    ...payload.lists.map((zeile) => `lists:${zeile.id}`),
    ...payload.members.map((zeile) => `members:${zeile.list_id}:${zeile.user_id}`),
    ...payload.tasks.map((zeile) => `tasks:${zeile.id}`),
    ...(payload.preferences ?? []).map(row => `preferences:${row.list_id}:${row.user_id}`),
    ...(payload.userPreferences ?? []).map(row => `userPreferences:${row.id}`),
  ])
  await writeAbgelehnt(
    db,
    bisher.filter((eintrag) => !durch.has(schluessel(eintrag.tabelle, eintrag.id))),
  )
}

function schluessel(tabelle: PushTabelle, id: string): string {
  return `${tabelle}:${id}`
}

/**
 * Die abgelehnten Stände: `tabelle:id` → vollständiger Inhalt.
 *
 * Nur Einträge ab `ABGELEHNT_AB_VERSUCHEN` zählen. Beim Sammeln wird verglichen,
 * ob die Zeile noch denselben Inhalt hat. Alte Einträge ohne Inhalt werden im
 * geschützten Protokoll erneut geprüft. Das Ablagefach steuert nur dauerhaft
 * abgelehnte Übertragungen, nicht die interaktive Konfliktentscheidung.
 */
async function abgelehnteStaende(db: LocalDatabase): Promise<Map<string, AbgelehnteZeile>> {
  const bisher = await readAbgelehnt(db)
  const staende = new Map<string, AbgelehnteZeile>()
  for (const eintrag of bisher) {
    if (eintrag.versuche >= ABGELEHNT_AB_VERSUCHEN) {
      staende.set(schluessel(eintrag.tabelle, eintrag.id), eintrag)
    }
  }
  return staende
}

/** Wie viele aktuelle Eingaben beiseitegelegt sind; das Archiv zählt nicht mit. */
export async function countAbgelehnt(db: LocalDatabase): Promise<number> {
  const states = await abgelehnteStaende(db)
  const blocked = await Promise.all([...states.values()].map(async state => {
    const local = await readLocalCloudRow(db, state.tabelle, state.id)
    return Boolean(state.row && local?.dirty && sameData(state.row, local.row))
  }))
  return blocked.filter(Boolean).length
}

export interface DirtyRows {
  lists: LocalList[]
  members: LocalListMember[]
  tasks: LocalTask[]
  preferences: LocalListPreference[]
  userPreferences: LocalUserPreference[]
}

export async function collectDirty(db: LocalDatabase): Promise<DirtyRows> {
  const [lists, members, tasks, preferences, userPreferences, staende, conflicts] = await Promise.all([
    db.lists.where('dirty').equals(1).toArray(),
    db.list_members.where('dirty').equals(1).toArray(),
    db.tasks.where('dirty').equals(1).toArray(),
    db.list_preferences.where('dirty').equals(1).toArray(),
    db.user_preferences.where('dirty').equals(1).toArray(),
    abgelehnteStaende(db),
    readCloudConflicts(db),
  ])
  const liegt = (tabelle: PushTabelle, id: string, row: CloudRow) => {
    const old = staende.get(schluessel(tabelle, id))
    // Alte Einträge ohne Inhalt könnten aus einem vollständig abgelehnten
    // Tabellen-Upload stammen. Im neuen Schreibweg werden sie erneut geprüft.
    return old?.row && sameData(old.row, row)
  }
  return {
    lists: lists.filter((zeile) => !liegt('lists', zeile.id, toRemoteList(zeile)) && !conflicts.some(c => c.table === 'lists' && c.id === zeile.id && sameData(c.local, toRemoteList(zeile)))),
    members: members.filter(
      (zeile) => !liegt('members', `${zeile.list_id}:${zeile.user_id}`, toRemoteMember(zeile)) && !conflicts.some(c => c.table === 'members' && c.id === `${zeile.list_id}:${zeile.user_id}` && sameData(c.local, toRemoteMember(zeile))),
    ),
    tasks: tasks.filter((zeile) => !liegt('tasks', zeile.id, toRemoteTask(zeile)) && !conflicts.some(c => c.table === 'tasks' && c.id === zeile.id && sameData(c.local, toRemoteTask(zeile)))),
    preferences: preferences.filter(row => !liegt('preferences', `${row.list_id}:${row.user_id}`, toRemotePreference(row)) && !conflicts.some(c => c.table === 'preferences' && c.id === `${row.list_id}:${row.user_id}` && sameData(c.local, toRemotePreference(row)))),
    userPreferences: userPreferences.filter(row => !liegt('userPreferences', row.id, toRemoteUserPreference(row)) && !conflicts.some(c => c.table === 'userPreferences' && c.id === row.id && sameData(c.local, toRemoteUserPreference(row)))),
  }
}

/**
 * Offene Änderungen, die noch übertragen werden können.
 *
 * Beiseitegelegte Zeilen zählen nicht mit – sonst stünde „N Änderungen warten“
 * für immer da, obwohl nichts mehr zu tun ist.
 */
export async function countDirty(db: LocalDatabase): Promise<number> {
  const rows = await collectDirty(db)
  return rows.lists.length + rows.members.length + rows.tasks.length + rows.preferences.length + rows.userPreferences.length
}

/**
 * Setzt `dirty` zurück – aber nur für Zeilen, die sich seit dem Upload nicht
 * erneut geändert haben. Ein Zeitstempel allein ist nicht eindeutig: Zwei
 * Änderungen können in derselben Millisekunde erfolgen. Deshalb wird in der
 * Schreibtransaktion der vollständige synchronisierte Inhalt verglichen.
 */
export async function markPushed(db: LocalDatabase, payload: PushPayload): Promise<void> {
  await db.transaction('rw', [db.lists, db.list_members, db.tasks, db.list_preferences, db.user_preferences, db.meta], async () => {
    for (const row of payload.lists) {
      await writeCloudState(db, 'lists', row.id, { base: row })
      const local = await db.lists.get(row.id)
      if (local && sameData(canonicalCloudRow('lists', toRemoteList(local)), canonicalCloudRow('lists', row))) {
        await db.lists.update(row.id, { dirty: 0 })
      }
    }
    for (const row of payload.members) {
      await writeCloudState(db, 'members', `${row.list_id}:${row.user_id}`, { base: row })
      const local = await db.list_members.get([row.list_id, row.user_id])
      if (local && sameData(canonicalCloudRow('members', toRemoteMember(local)), canonicalCloudRow('members', row))) {
        await db.list_members.update([row.list_id, row.user_id], { dirty: 0 })
      }
    }
    for (const row of payload.tasks) {
      await writeCloudState(db, 'tasks', row.id, { base: row })
      const local = await db.tasks.get(row.id)
      if (local && sameData(canonicalCloudRow('tasks', toRemoteTask(local)), canonicalCloudRow('tasks', row))) {
        await db.tasks.update(row.id, { dirty: 0 })
      }
    }
    for (const row of payload.preferences ?? []) {
      await writeCloudState(db, 'preferences', `${row.list_id}:${row.user_id}`, { base: row })
      const local = await db.list_preferences.get([row.list_id, row.user_id])
      if (local && sameData(canonicalCloudRow('preferences', toRemotePreference(local)), canonicalCloudRow('preferences', row))) {
        await db.list_preferences.update([row.list_id, row.user_id], { dirty: 0 })
      }
    }
    for (const row of payload.userPreferences ?? []) {
      await writeCloudState(db, 'userPreferences', row.id, { base: row })
      const local = await db.user_preferences.get(row.id)
      if (local && sameData(canonicalCloudRow('userPreferences', toRemoteUserPreference(local)), canonicalCloudRow('userPreferences', row))) {
        await db.user_preferences.update(row.id, { dirty: 0 })
      }
    }
  })
}

export { readMeta, writeMeta }
