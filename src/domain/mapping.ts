import { normalizeIso } from './clock'
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
    created_at: normalizeIso(local.created_at),
    updated_at: normalizeIso(local.updated_at),
    deleted_at: normalizeIso(local.deleted_at),
  }
}

export function fromRemoteList(remote: RemoteList): LocalList {
  return {
    id: remote.id,
    name: remote.name,
    owner_id: remote.owner_id,
    is_shared: remote.is_shared,
    // Ältere Zeilen kennen das Feld noch nicht.
    icon: remote.icon ?? null,
    created_at: normalizeIso(remote.created_at),
    updated_at: normalizeIso(remote.updated_at),
    deleted_at: normalizeIso(remote.deleted_at),
    dirty: 0,
  }
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
    position: local.position,
    created_at: normalizeIso(local.created_at),
    updated_at: normalizeIso(local.updated_at),
    deleted_at: normalizeIso(local.deleted_at),
  }
}

export function fromRemoteTask(remote: RemoteTask): LocalTask {
  return {
    id: remote.id,
    list_id: remote.list_id,
    title: remote.title,
    description: remote.description,
    due_at: normalizeIso(remote.due_at),
    completed: remote.completed,
    // Ältere Zeilen kennen das Feld noch nicht – null ist der richtige Rückfall.
    completed_at: normalizeIso(remote.completed_at ?? null),
    position: remote.position ?? 0,
    created_at: normalizeIso(remote.created_at),
    updated_at: normalizeIso(remote.updated_at),
    deleted_at: normalizeIso(remote.deleted_at),
    dirty: 0,
  }
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

export function fromRemoteMember(remote: RemoteListMember): LocalListMember {
  return {
    list_id: remote.list_id,
    user_id: remote.user_id,
    created_at: normalizeIso(remote.created_at),
    updated_at: normalizeIso(remote.updated_at),
    deleted_at: normalizeIso(remote.deleted_at),
    dirty: 0,
  }
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
