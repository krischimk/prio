import { CLOUD_TABLES, canonicalCloudRow, cloudRowId } from '../../src/domain/cloudMerge'
import { sameData } from '../../src/domain/equality'
import { createFixedClock, type Clock } from '../../src/domain/clock'
import { completionDeadline } from '../../src/domain/taskLifecycle'
import type {
  PushPayload,
  RemoteList,
  RemoteListMember,
  RemoteListPreference,
  RemoteUserPreference,
  RemoteSnapshot,
  RemoteTask,
} from '../../src/domain/types'
import {
  classifyRemoteError,
  leeresPushErgebnis,
  RemoteError,
  type PushErgebnis,
  type RemoteGateway,
  type PushBases,
} from '../../src/sync/remoteGateway'

/**
 * In-Memory-Ersatz für Supabase.
 *
 * `FakeServer` hält die Daten (wie die Cloud), `FakeGateway` ist die Sicht
 * eines einzelnen Benutzers darauf. Der Gateway bildet die Sichtbarkeitsregeln
 * der Row-Level-Security nach:
 *
 *  - sichtbar sind eigene Listen und Listen mit aktiver Mitgliedschaft,
 *  - Mitgliedschaften sieht man nur für sich selbst oder als Besitzer,
 *  - Aufgaben sieht man nur für zugängliche Listen.
 *
 * Dadurch lassen sich Mehrgeräte- und Gemeinsame-Listen-Abläufe realistisch
 * testen, ohne echte Cloud.
 */
export class FakeServer {
  readonly clock: Clock
  constructor(clock: Clock = createFixedClock(Date.parse('2026-01-01T10:00:00Z'))) { this.clock = clock }
  readonly lists = new Map<string, RemoteList>()
  readonly members = new Map<string, RemoteListMember>()
  readonly tasks = new Map<string, RemoteTask>()
  readonly preferences = new Map<string, RemoteListPreference>()
  readonly userPreferences = new Map<string, RemoteUserPreference>()

  /** Registrierte Konten für `shareListByEmail`: E-Mail (klein) → Benutzer-ID. */
  readonly accounts = new Map<string, string>()

  pushCalls = 0
  pullCalls = 0
  shareCalls = 0

  /** Wenn gesetzt, schlägt jeder Push/Pull mit diesem Fehler fehl. */
  failPushWith: RemoteError | null = null
  failPullWith: RemoteError | null = null

  expireCompleted(): void {
    for (const [id, task] of this.tasks) {
      if (task.completed && !task.expired_at && task.completed_expires_at && Date.parse(task.completed_expires_at) <= this.clock.nowMs()) {
        this.tasks.set(id, { ...task, expired_at: this.clock.now(), deleted_at: this.clock.now(), updated_at: this.clock.now(), title: 'Abgelaufene Aufgabe', description: null, due_at: null, reminders: [], recurrence: null, successor_id: null, section_id: null, reopen_context: null })
      }
    }
  }

  /** Erzeugt die Sicht eines Benutzers auf diesen Server. */
  gatewayFor(userId: string): FakeGateway {
    return new FakeGateway(this, userId)
  }

  registerAccount(email: string, userId: string): void {
    this.accounts.set(email.trim().toLowerCase(), userId)
  }

  taskById(id: string): RemoteTask | undefined {
    return this.tasks.get(id)
  }

  listById(id: string): RemoteList | undefined {
    return this.lists.get(id)
  }

  memberOf(listId: string, userId: string): RemoteListMember | undefined {
    return this.members.get(memberKey({ list_id: listId, user_id: userId }))
  }

  isVisibleList(list: RemoteList, userId: string): boolean {
    if (list.owner_id === userId) return true
    if (list.deleted_at !== null) return false
    const membership = this.memberOf(list.id, userId)
    return membership !== undefined && membership.deleted_at === null
  }
}

export class FakeGateway implements RemoteGateway {
  readonly userId: string
  private readonly server: FakeServer

  constructor(server: FakeServer, userId: string) {
    this.server = server
    this.userId = userId
  }

  async pull(): Promise<RemoteSnapshot> {
    this.server.pullCalls += 1
    if (this.server.failPullWith) throw this.server.failPullWith
    this.server.expireCompleted()

    const visibleLists = [...this.server.lists.values()].filter((list) =>
      this.server.isVisibleList(list, this.userId),
    )
    const visibleListIds = new Set(visibleLists.map((list) => list.id))

    return {
      lists: visibleLists,
      members: [...this.server.members.values()].filter(
        (member) => member.user_id === this.userId || this.isOwner(member.list_id),
      ),
      tasks: [...this.server.tasks.values()].filter((task) => visibleListIds.has(task.list_id)),
      ...([...this.server.preferences.values()].some(row => row.user_id === this.userId) ? { preferences: [...this.server.preferences.values()].filter(row => row.user_id === this.userId) } : {}),
      ...(this.server.userPreferences.has(this.userId) ? { userPreferences: [this.server.userPreferences.get(this.userId)!] } : {}),
    }
  }

  async push(payload: PushPayload, bases: PushBases = { lists: {}, members: {}, tasks: {} }): Promise<PushErgebnis> {
    this.server.pushCalls += 1
    const result = leeresPushErgebnis()
    result.konflikte = []
    for (const table of CLOUD_TABLES) {
      for (const row of payload[table] ?? []) {
        const id = cloudRowId(table, row)
        try {
          if (this.server.failPushWith) throw this.server.failPushWith
          this.server.expireCompleted()
          const store = this.server[table]
          const existing = store.get(id)
          if (table === 'lists') {
            const list = row as RemoteList
            if (list.owner_id !== this.userId || (existing && (existing as RemoteList).owner_id !== this.userId)) {
              throw new RemoteError('server', 'RLS: Nur der Besitzer darf eine Liste ändern.')
            }
          } else if (table === 'members') {
            const member = row as RemoteListMember
            const ownLeave = existing && member.user_id === this.userId && member.deleted_at !== null
              && member.created_at === existing.created_at
            if (!this.isOwner(member.list_id) && !ownLeave) throw new RemoteError('server', 'RLS: Nur der Besitzer verwaltet Mitglieder.')
          } else if (table === 'preferences') {
            const pref = row as RemoteListPreference
            const list = this.server.lists.get(pref.list_id)
            if (pref.user_id !== this.userId || !list || !this.server.isVisibleList(list, this.userId)) throw new RemoteError('server', 'Nur die eigene zugängliche Listenauswahl darf geändert werden.')
          } else if (table === 'userPreferences') {
            const pref = row as RemoteUserPreference
            if (pref.id !== this.userId || !['by_list', 'newest'].includes(pref.overview_mode)) throw new RemoteError('server', 'Ungültige persönliche Einstellung.')
            const target = pref.default_list_id && this.server.lists.get(pref.default_list_id)
            if (pref.default_list_id && pref.default_list_id !== (existing as RemoteUserPreference | undefined)?.default_list_id && (!target || !this.server.isVisibleList(target, this.userId))) throw new RemoteError('server', 'Kein Zugriff auf die Standardliste.')
          } else {
            const task = row as RemoteTask
            const target = this.server.lists.get(task.list_id)
            const source = existing && this.server.lists.get((existing as RemoteTask).list_id)
            if (!target || !this.server.isVisibleList(target, this.userId) || (existing && (!source || !this.server.isVisibleList(source, this.userId)))) {
              throw new RemoteError('server', 'RLS: Kein Zugriff auf diese Liste.')
            }
          }
          const expected = bases[table]?.[id] ?? null
          const actual = existing ? canonicalCloudRow(table, existing) : null
          if (table === 'tasks' && (existing as RemoteTask | undefined)?.expired_at && !sameData(actual, canonicalCloudRow(table, row))) {
            result.konflikte.push({ table, id, base: expected, local: row, remote: existing!, fields: [] }); continue
          }
          if (!sameData(actual, canonicalCloudRow(table, row)) && !sameData(actual, expected ? canonicalCloudRow(table, expected) : null)) {
            result.konflikte.push({ table, id, base: expected, local: row, remote: existing ?? null, fields: [] })
            continue
          }
          if (existing && existing.created_at !== row.created_at) throw new RemoteError('server', 'Der Erstellzeitpunkt ist unveränderlich.')
          let saved = row
          if (table === 'lists') {
            const list = row as RemoteList; const old = existing as RemoteList | undefined
            saved = { ...list, completion_retention_started_at: !old ? new Date(Math.min(Date.parse(list.completion_retention_started_at ?? this.server.clock.now()),this.server.clock.nowMs())).toISOString() : old.keep_completed && !list.keep_completed ? this.server.clock.now() : old.completion_retention_started_at ?? null }
          } else if (table === 'tasks') {
            const task = row as RemoteTask; const old = existing as RemoteTask | undefined
            if (old?.completed && task.completed && old.completed_at !== task.completed_at) throw new RemoteError('server', 'Der Abschlusszeitpunkt bleibt erhalten.')
            if ((task.expired_at ?? null) !== (old?.expired_at ?? null)) throw new RemoteError('server', 'Der Ablauf gehört dem Server.')
            const keep = this.server.lists.get(task.list_id)?.keep_completed === true
            const completedAt = task.completed ? new Date(Math.max(Math.min(Date.parse(task.completed_at!), this.server.clock.nowMs()), Date.parse(this.server.lists.get(task.list_id)?.completion_retention_started_at ?? task.completed_at!))).toISOString() : this.server.clock.now()
            saved = { ...task, completed_expires_at: !task.completed ? null : old?.completed && old.list_id !== task.list_id ? completionDeadline(this.server.clock.now(), keep) : old?.completed && old.completed_at === task.completed_at ? old.completed_expires_at ?? null : completionDeadline(completedAt, keep) }
          }
          store.set(id, structuredClone(saved) as never)
          if (table === 'lists' && existing && ((existing as RemoteList).keep_completed === true) !== ((row as RemoteList).keep_completed === true)) {
            for (const [taskId, task] of this.server.tasks) if (task.list_id === id && task.completed && !task.expired_at) {
              this.server.tasks.set(taskId, { ...task, completed_expires_at: completionDeadline(this.server.clock.now(), (row as RemoteList).keep_completed === true), updated_at: this.server.clock.now() })
            }
          }
          this.server.expireCompleted()
          const current = store.get(id)!
          if (sameData(canonicalCloudRow(table, current), canonicalCloudRow(table, row))) {
            ;(result.hochgeladen[table] ??= []).push(current as never)
          } else result.konflikte.push({ table, id, base: expected, local: row, remote: current, fields: [] })
        } catch (cause) {
          result.fehler.push({ tabelle: table, ids: [id], error: classifyRemoteError(cause) })
        }
      }
    }
    return result
  }

  async shareListByEmail(listId: string, email: string): Promise<{ userId: string }> {
    this.server.shareCalls += 1
    const list = this.server.lists.get(listId)
    if (!list) throw new RemoteError('server', 'Liste nicht gefunden.')
    if (list.owner_id !== this.userId) {
      throw new RemoteError('server', 'Nur der Besitzer kann diese Liste teilen.')
    }

    const targetUserId = this.server.accounts.get(email.trim().toLowerCase())
    if (!targetUserId) {
      throw new RemoteError('server', 'Es gibt keinen registrierten Nutzer mit dieser E-Mail-Adresse.')
    }
    if (targetUserId === this.userId) {
      throw new RemoteError('server', 'Du bist bereits Besitzer dieser Liste.')
    }

    const now = new Date().toISOString()
    this.server.members.set(`${listId}:${targetUserId}`, {
      list_id: listId,
      user_id: targetUserId,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    })
    this.server.lists.set(listId, { ...list, is_shared: true })
    return { userId: targetUserId }
  }

  /**
   * Adressen der Personen, mit denen dieser Benutzer eine nicht gelöschte
   * Liste teilt – dieselbe Sicht, die die Serverfunktion `co_member_contacts`
   * herausgibt.
   */
  async coMemberContacts(): Promise<{ userId: string; email: string }[]> {
    const kontakte = new Map<string, string>()

    // Beteiligt ist, wer die Liste besitzt **oder** aktives Mitglied ist.
    for (const liste of this.server.lists.values()) {
      if (liste.deleted_at !== null) continue

      const mitglieder = [...this.server.members.values()].filter(
        (eintrag) => eintrag.list_id === liste.id && eintrag.deleted_at === null,
      )
      const dabei =
        liste.owner_id === this.userId || mitglieder.some((m) => m.user_id === this.userId)
      if (!dabei) continue

      const beteiligte = [liste.owner_id, ...mitglieder.map((m) => m.user_id)]
      for (const userId of beteiligte) {
        if (userId === this.userId || kontakte.has(userId)) continue
        for (const [email, id] of this.server.accounts) {
          if (id === userId) kontakte.set(userId, email)
        }
      }
    }

    return [...kontakte]
      .map(([userId, email]) => ({ userId, email }))
      .sort((a, b) => a.email.localeCompare(b.email))
  }

  private isOwner(listId: string): boolean {
    return this.server.lists.get(listId)?.owner_id === this.userId
  }
}

/**
 * Gateway, das jeden Zugriff mit einem Netzwerkfehler abbricht – für die
 * Prüfung "Supabase ist pausiert / nicht erreichbar".
 */
export class OfflineGateway implements RemoteGateway {
  calls = 0

  async pull(): Promise<RemoteSnapshot> {
    this.calls += 1
    throw new RemoteError('offline', 'Netzwerk nicht erreichbar.')
  }

  async push(payload: PushPayload): Promise<PushErgebnis> {
    this.calls += 1
    // Kein Netz: nichts geht durch, alles bleibt liegen.
    const ergebnis = leeresPushErgebnis()
    for (const tabelle of CLOUD_TABLES) {
      if (payload[tabelle]?.length) {
        ergebnis.fehler.push({
          tabelle,
          error: new RemoteError('offline', 'Netzwerk nicht erreichbar.'),
        })
      }
    }
    return ergebnis
  }

  async shareListByEmail(): Promise<{ userId: string }> {
    this.calls += 1
    throw new RemoteError('offline', 'Netzwerk nicht erreichbar.')
  }

  async coMemberContacts(): Promise<{ userId: string; email: string }[]> {
    this.calls += 1
    throw new RemoteError('offline', 'Netzwerk nicht erreichbar.')
  }
}

export function createFakeServer(): FakeServer {
  return new FakeServer()
}

/**
 * Gateway, das den Benutzer erst zur Laufzeit bestimmt.
 *
 * Nötig für UI-Tests: Dort wird das Gateway an die App übergeben, bevor
 * überhaupt klar ist, wer sich anmeldet.
 */
export function createLazyGateway(server: FakeServer, currentUserId: () => string): RemoteGateway {
  const resolve = (): FakeGateway => server.gatewayFor(currentUserId())
  return {
    pull: () => resolve().pull(),
    push: (payload, bases) => resolve().push(payload, bases),
    shareListByEmail: (listId, email) => resolve().shareListByEmail(listId, email),
    coMemberContacts: () => resolve().coMemberContacts(),
  }
}

function memberKey(member: Pick<RemoteListMember, 'list_id' | 'user_id'>): string {
  return `${member.list_id}:${member.user_id}`
}
