import type {
  PushPayload,
  RemoteList,
  RemoteListMember,
  RemoteSnapshot,
  RemoteTask,
} from '../../src/domain/types'
import { RemoteError, type RemoteGateway } from '../../src/sync/remoteGateway'

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
  readonly lists = new Map<string, RemoteList>()
  readonly members = new Map<string, RemoteListMember>()
  readonly tasks = new Map<string, RemoteTask>()

  /** Registrierte Konten für `shareListByEmail`: E-Mail (klein) → Benutzer-ID. */
  readonly accounts = new Map<string, string>()

  pushCalls = 0
  pullCalls = 0
  shareCalls = 0

  /** Wenn gesetzt, schlägt jeder Push/Pull mit diesem Fehler fehl. */
  failPushWith: RemoteError | null = null
  failPullWith: RemoteError | null = null

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
    }
  }

  async push(payload: PushPayload): Promise<void> {
    this.server.pushCalls += 1
    if (this.server.failPushWith) throw this.server.failPushWith

    // Dieselben Regeln wie die RLS-Policies in supabase/migrations/0002_rls.sql.
    // Nur so verhalten sich Tests wie der echte Server.
    for (const list of payload.lists) {
      if (list.owner_id !== this.userId) {
        throw new RemoteError('server', 'RLS: Nur der Besitzer darf eine Liste ändern.')
      }
      const existing = this.server.lists.get(list.id)
      if (existing && existing.owner_id !== this.userId) {
        throw new RemoteError('server', 'RLS: Diese Liste gehört einem anderen Benutzer.')
      }
      this.server.lists.set(list.id, list)
    }

    for (const member of payload.members) {
      const list = this.server.lists.get(member.list_id)
      if (!list) throw new RemoteError('server', 'RLS: Liste nicht gefunden.')
      if (list.owner_id !== this.userId) {
        throw new RemoteError('server', 'RLS: Nur der Besitzer verwaltet Mitglieder.')
      }
      this.server.members.set(memberKey(member), member)
    }

    for (const task of payload.tasks) {
      const list = this.server.lists.get(task.list_id)
      if (!list || !this.server.isVisibleList(list, this.userId)) {
        throw new RemoteError('server', 'RLS: Kein Zugriff auf diese Liste.')
      }
      this.server.tasks.set(task.id, task)
    }
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

  async push(): Promise<void> {
    this.calls += 1
    throw new RemoteError('offline', 'Netzwerk nicht erreichbar.')
  }

  async shareListByEmail(): Promise<{ userId: string }> {
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
    push: (payload) => resolve().push(payload),
    shareListByEmail: (listId, email) => resolve().shareListByEmail(listId, email),
  }
}

function memberKey(member: Pick<RemoteListMember, 'list_id' | 'user_id'>): string {
  return `${member.list_id}:${member.user_id}`
}
