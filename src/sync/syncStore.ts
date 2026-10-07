import type { IsoDateTime, LocalList, LocalListMember, LocalTask, PushPayload } from '../domain/types'
import type { LocalDatabase } from '../db/localDb'
import { readMeta, writeMeta } from '../db/metaStore'
import type { PushTabelle } from './remoteGateway'

/**
 * Persistenz-Helfer für die Sync-Engine.
 *
 * Die "Sync-Queue" ist bewusst keine eigene Tabelle, sondern das `dirty`-Flag
 * direkt an der Zeile. Vorteile für Version 0.1:
 *  - kein zweiter Zustand, der auseinanderlaufen kann,
 *  - eine Änderung an derselben Zeile erzeugt keinen doppelten Queue-Eintrag,
 *  - die Queue ist per Index abfragbar (`dirty = 1`).
 * Nachteil: Es gibt keine Historie und keine Reihenfolge – für 0.1 irrelevant,
 * weil pro Sync immer der komplette lokale Stand der schmutzigen Zeilen
 * hochgeladen wird (Idempotenz über Upsert).
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
 * sich die Zeile lokal (`updated_at`), wird sie wieder versucht. Nichts geht
 * verloren: Die Zeile bleibt in der lokalen Datenbank.
 */
export interface AbgelehnteZeile {
  tabelle: PushTabelle
  id: string
  /** Der abgelehnte Stand. Ändert er sich, wird es erneut versucht. */
  updated_at: IsoDateTime
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
  // Gedeckelt: Das Ablagefach ist eine Diagnose, kein Archiv.
  await writeMeta(db, META_ABGELEHNT, JSON.stringify(zeilen.slice(-50)))
}

/** Zählt einen Fehlversuch für diese Zeilen. */
export async function merkeAbgelehnt(
  db: LocalDatabase,
  zeilen: Array<{ tabelle: PushTabelle; id: string; updated_at: IsoDateTime }>,
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
      neu[vorhanden] = { ...neu[vorhanden], versuche: neu[vorhanden].versuche + 1, message, at }
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
 * Die abgelehnten Stände: `tabelle:id` → `updated_at`.
 *
 * Nur Einträge ab `ABGELEHNT_AB_VERSUCHEN` zählen. Beim Sammeln wird verglichen,
 * ob die Zeile **noch** auf diesem Stand steht: Eine lokale Änderung setzt
 * `updated_at` neu und wird damit wieder versucht – ohne dass jemand das
 * Ablagefach von Hand leeren müsste.
 */
async function abgelehnteStaende(db: LocalDatabase): Promise<Map<string, IsoDateTime>> {
  const bisher = await readAbgelehnt(db)
  const staende = new Map<string, IsoDateTime>()
  for (const eintrag of bisher) {
    if (eintrag.versuche >= ABGELEHNT_AB_VERSUCHEN) {
      staende.set(schluessel(eintrag.tabelle, eintrag.id), eintrag.updated_at)
    }
  }
  return staende
}

/** Wie viele Zeilen beiseitegelegt sind – für die Anzeige. */
export async function countAbgelehnt(db: LocalDatabase): Promise<number> {
  return (await abgelehnteStaende(db)).size
}

export interface DirtyRows {
  lists: LocalList[]
  members: LocalListMember[]
  tasks: LocalTask[]
}

export async function collectDirty(db: LocalDatabase): Promise<DirtyRows> {
  const [lists, members, tasks, staende] = await Promise.all([
    db.lists.where('dirty').equals(1).toArray(),
    db.list_members.where('dirty').equals(1).toArray(),
    db.tasks.where('dirty').equals(1).toArray(),
    abgelehnteStaende(db),
  ])
  const liegt = (tabelle: PushTabelle, id: string, updatedAt: IsoDateTime) =>
    staende.get(schluessel(tabelle, id)) === updatedAt
  return {
    lists: lists.filter((zeile) => !liegt('lists', zeile.id, zeile.updated_at)),
    members: members.filter(
      (zeile) => !liegt('members', `${zeile.list_id}:${zeile.user_id}`, zeile.updated_at),
    ),
    tasks: tasks.filter((zeile) => !liegt('tasks', zeile.id, zeile.updated_at)),
  }
}

/**
 * Offene Änderungen, die noch übertragen werden können.
 *
 * Beiseitegelegte Zeilen zählen nicht mit – sonst stünde „N Änderungen warten“
 * für immer da, obwohl nichts mehr zu tun ist.
 */
export async function countDirty(db: LocalDatabase): Promise<number> {
  const [lists, members, tasks] = await Promise.all([
    db.lists.where('dirty').equals(1).toArray(),
    db.list_members.where('dirty').equals(1).toArray(),
    db.tasks.where('dirty').equals(1).toArray(),
  ])
  const staende = await abgelehnteStaende(db)
  const liegt = (tabelle: PushTabelle, id: string, updatedAt: IsoDateTime) =>
    staende.get(schluessel(tabelle, id)) === updatedAt
  return (
    lists.filter((zeile) => !liegt('lists', zeile.id, zeile.updated_at)).length +
    members.filter(
      (zeile) => !liegt('members', `${zeile.list_id}:${zeile.user_id}`, zeile.updated_at),
    ).length +
    tasks.filter((zeile) => !liegt('tasks', zeile.id, zeile.updated_at)).length
  )
}

/**
 * Setzt `dirty` zurück – aber nur für Zeilen, die sich seit dem Upload nicht
 * erneut geändert haben. Verglichen wird deshalb `updated_at` (und sicherheits-
 * halber `deleted_at`). Ohne diese Prüfung ginge eine Änderung verloren, die
 * während des Uploads lokal passiert ist.
 */
export async function markPushed(db: LocalDatabase, payload: PushPayload): Promise<void> {
  await db.transaction('rw', db.lists, db.list_members, db.tasks, async () => {
    for (const row of payload.lists) {
      const local = await db.lists.get(row.id)
      if (local && local.updated_at === row.updated_at && local.deleted_at === row.deleted_at) {
        await db.lists.update(row.id, { dirty: 0 })
      }
    }
    for (const row of payload.members) {
      const local = await db.list_members.get([row.list_id, row.user_id])
      if (local && local.updated_at === row.updated_at && local.deleted_at === row.deleted_at) {
        await db.list_members.update([row.list_id, row.user_id], { dirty: 0 })
      }
    }
    for (const row of payload.tasks) {
      const local = await db.tasks.get(row.id)
      if (local && local.updated_at === row.updated_at && local.deleted_at === row.deleted_at) {
        await db.tasks.update(row.id, { dirty: 0 })
      }
    }
  })
}

export { readMeta, writeMeta }
