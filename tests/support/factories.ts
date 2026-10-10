import { createFixedClock } from '../../src/domain/clock'
import type { LocalList, LocalListMember, LocalListPreference, LocalUserPreference, LocalTask, RemoteList, RemoteTask, RemoteListMember } from '../../src/domain/types'

/** Fabriken für Testdaten. Alle Werte sind überschreibbar. */

export const T0 = '2026-01-01T10:00:00.000Z'
export const T1 = '2026-01-01T11:00:00.000Z'
export const T2 = '2026-01-01T12:00:00.000Z'

export function localTask(overrides: Partial<LocalTask> = {}): LocalTask {
  return {
    id: 'task-1',
    list_id: 'list-1',
    section_id: null,
    title: 'Aufgabe',
    description: null,
    due_at: null,
    completed: false,
    completed_at: null,
    completed_expires_at: null,
    expired_at: null,
    reopen_context: null,
    recurrence: null,
    successor_id: null,
    reminders: [],
    position: 0,
    created_at: T0,
    updated_at: T0,
    deleted_at: null,
    dirty: 0,
    ...overrides,
  }
}

export function remoteTask(overrides: Partial<RemoteTask> = {}): RemoteTask {
  const { dirty: _dirty, ...rest } = localTask(overrides as Partial<LocalTask>)
  return rest
}

export function localList(overrides: Partial<LocalList> = {}): LocalList {
  return {
    id: 'list-1',
    name: 'Liste',
    owner_id: 'user-1',
    is_shared: false,
    icon: null,
    sections: [],
    keep_completed: false,
    completion_retention_started_at: null,
    created_at: T0,
    updated_at: T0,
    deleted_at: null,
    dirty: 0,
    ...overrides,
  }
}

export function remoteList(overrides: Partial<RemoteList> = {}): RemoteList {
  const { dirty: _dirty, ...rest } = localList(overrides as Partial<LocalList>)
  return rest
}

export function localMember(overrides: Partial<LocalListMember> = {}): LocalListMember {
  return {
    list_id: 'list-1',
    user_id: 'user-2',
    created_at: T0,
    updated_at: T0,
    deleted_at: null,
    dirty: 0,
    ...overrides,
  }
}

export function remoteMember(overrides: Partial<RemoteListMember> = {}): RemoteListMember {
  const { dirty: _dirty, ...rest } = localMember(overrides as Partial<LocalListMember>)
  return rest
}

export { createFixedClock }

export function localListPreference(overrides: Partial<LocalListPreference> = {}): LocalListPreference {
  return { list_id: 'list-1', user_id: 'user-1', include_in_overview: false, created_at: T0, updated_at: T0, deleted_at: null, dirty: 0, ...overrides }
}

export function localUserPreference(overrides: Partial<LocalUserPreference> = {}): LocalUserPreference {
  return { id: 'user-1', default_list_id: null, overview_mode: 'by_list', created_at: T0, updated_at: T0, deleted_at: null, dirty: 0, ...overrides }
}
