import { normalizeIso } from './clock'
import { normalisiereAufgabe, normalisiereListe, normalisiereMitglied } from './normalize'
import { parseSections } from './sections'
import type {
  LocalList,
  LocalListMember,
  LocalTask,
  PushPayload,
  RemoteList,
  RemoteListMember,
  RemoteTask,
} from './types'

/**
 * Umwandlung zwischen lokalem Datenmodell (Dexie) und Supabase-Datenmodell.
 *
 * Zwei Aufgaben:
 *  1. `dirty` entfernen bzw. ergänzen – dieses Feld existiert nur lokal und
 *     darf niemals an Supabase gesendet werden.
 *  2. Zeitstempel normalisieren, damit Last-Write-Wins über Zeitzonen und
 *     unterschiedliche Formatierungen (`+00:00` vs. `Z`) hinweg stabil ist.
 */

export function toRemoteList(local: LocalList): RemoteList {
  return {
    id: local.id,
    name: local.name,
    owner_id: local.owner_id,
    is_shared: local.is_shared,
    icon: local.icon,
    sections: parseSections(local.sections),
    created_at: normalizeIso(local.created_at),
    updated_at: normalizeIso(local.updated_at),
    deleted_at: normalizeIso(local.deleted_at),
  }
}

export function fromRemoteList(remote: RemoteList) {
  // Der Leserand ergänzt, was ältere Zeilen nicht kennen.
  return normalisiereListe(remote)
}

export function toRemoteTask(local: LocalTask): RemoteTask {
  return {
    id: local.id,
    list_id: local.list_id,
    title: local.title,
    description: local.description,
    due_at: normalizeIso(local.due_at),
    completed: local.completed,
    completed_at: normalizeIso(local.completed_at),
    recurrence: local.recurrence,
    successor_id: local.successor_id,
    reminders: local.reminders,
    section_id: local.section_id,
    // Letzte Absicherung an der Grenze: `NaN` würde beim Senden zu `null`, und
    // die Spalte ist `not null`. Ein ungültiger Wert darf das Hochladen nicht
    // für die gesamte Charge scheitern lassen.
    position: Number.isFinite(local.position) ? local.position : 0,
    created_at: normalizeIso(local.created_at),
    updated_at: normalizeIso(local.updated_at),
    deleted_at: normalizeIso(local.deleted_at),
  }
}

export function fromRemoteTask(remote: RemoteTask) {
  // Der Leserand ergänzt, was ältere Zeilen nicht kennen.
  return normalisiereAufgabe(remote)
}

export function toRemoteMember(local: LocalListMember): RemoteListMember {
  return {
    list_id: local.list_id,
    user_id: local.user_id,
    created_at: normalizeIso(local.created_at),
    updated_at: normalizeIso(local.updated_at),
    deleted_at: normalizeIso(local.deleted_at),
  }
}

export function fromRemoteMember(remote: RemoteListMember) {
  // Der Leserand ergänzt, was ältere Zeilen nicht kennen.
  return normalisiereMitglied(remote)
}

export function toPushPayload(
  lists: LocalList[],
  members: LocalListMember[],
  tasks: LocalTask[],
): PushPayload {
  return {
    lists: lists.map(toRemoteList),
    members: members.map(toRemoteMember),
    tasks: tasks.map(toRemoteTask),
  }
}

export function isEmptyPayload(payload: PushPayload): boolean {
  return payload.lists.length === 0 && payload.members.length === 0 && payload.tasks.length === 0
}
