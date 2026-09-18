import { systemClock, type Clock } from '../domain/clock'
import { newId } from '../domain/ids'
import type { LocalList, LocalListMember, LocalTask } from '../domain/types'
import type { LocalDatabase } from './localDb'
import { optionalText, requireText, ValidationError } from './validation'

/**
 * Geschäftslogik für Listen, Aufgaben und Mitgliedschaften.
 *
 * Grundregel: Jede schreibende Operation
 *   1. vergibt einen neuen `updated_at`-Zeitstempel,
 *   2. setzt `dirty = 1` und
 *   3. wartet NICHT auf den Server.
 *
 * Löschen ist immer ein Soft Delete (`deleted_at`), damit die Löschung später
 * synchronisiert werden kann. Es wird nie eine Zeile lokal entfernt, solange
 * sie noch nicht auf dem Server angekommen ist.
 */

export interface CreateTaskInput {
  listId: string
  title: string
  description?: string | null
  dueAt?: string | null
}

export interface UpdateTaskInput {
  title?: string
  description?: string | null
  dueAt?: string | null
}

export interface Repositories {
  // Listen
  createList(name: string, ownerId: string): Promise<LocalList>
  renameList(listId: string, name: string): Promise<LocalList>
  deleteList(listId: string): Promise<void>
  getList(listId: string): Promise<LocalList | undefined>
  listLists(): Promise<LocalList[]>

  // Aufgaben
  createTask(input: CreateTaskInput): Promise<LocalTask>
  updateTask(taskId: string, patch: UpdateTaskInput): Promise<LocalTask>
  setTaskCompleted(taskId: string, completed: boolean): Promise<LocalTask>
  /** Verschiebt eine Aufgabe in eine andere Liste (beide müssen zugänglich sein). */
  moveTask(taskId: string, targetListId: string): Promise<LocalTask>
  deleteTask(taskId: string): Promise<void>
  getTask(taskId: string): Promise<LocalTask | undefined>
  listTasks(listId: string): Promise<LocalTask[]>

  // Mitgliedschaften
  listMembers(listId: string): Promise<LocalListMember[]>
  markListShared(listId: string): Promise<void>
  removeMember(listId: string, userId: string): Promise<void>
}

/** Sortierung der Aufgabenliste: offene zuerst, dann nach Fälligkeit. */
export function compareTasks(a: LocalTask, b: LocalTask): number {
  if (a.completed !== b.completed) return a.completed ? 1 : -1
  const dueA = a.due_at === null ? Number.POSITIVE_INFINITY : Date.parse(a.due_at)
  const dueB = b.due_at === null ? Number.POSITIVE_INFINITY : Date.parse(b.due_at)
  if (dueA !== dueB) return dueA - dueB
  const createdA = Date.parse(a.created_at)
  const createdB = Date.parse(b.created_at)
  if (createdA !== createdB) return createdA - createdB
  return a.title.localeCompare(b.title)
}

export function createRepositories(db: LocalDatabase, clock: Clock = systemClock): Repositories {
  /** Baut die Felder, die bei jeder lokalen Änderung gesetzt werden. */
  function stamp(): { updated_at: string; dirty: 1 } {
    return { updated_at: clock.now(), dirty: 1 }
  }

  async function requireList(listId: string): Promise<LocalList> {
    const list = await db.lists.get(listId)
    if (!list || list.deleted_at !== null) {
      throw new ValidationError('Diese Liste existiert nicht mehr.')
    }
    return list
  }

  async function requireTask(taskId: string): Promise<LocalTask> {
    const task = await db.tasks.get(taskId)
    if (!task || task.deleted_at !== null) {
      throw new ValidationError('Diese Aufgabe existiert nicht mehr.')
    }
    return task
  }

  return {
    async createList(name, ownerId) {
      const now = clock.now()
      const list: LocalList = {
        id: newId(),
        name: requireText(name, 'Der Listenname'),
        owner_id: ownerId,
        is_shared: false,
        created_at: now,
        updated_at: now,
        deleted_at: null,
        dirty: 1,
      }
      await db.lists.add(list)
      return list
    },

    async renameList(listId, name) {
      const list = await requireList(listId)
      const updated: LocalList = { ...list, name: requireText(name, 'Der Listenname'), ...stamp() }
      await db.lists.put(updated)
      return updated
    },

    /**
     * Soft Delete inklusive Kaskade auf die Aufgaben der Liste.
     *
     * Ohne Kaskade blieben Aufgaben als unsichtbare Waisen zurück, die bei
     * jedem Sync mit hochgeladen würden. Verweise auf Mitgliedschaften werden
     * nicht angefasst: Ohne die Liste sind sie über die Server-Policies
     * ohnehin nicht mehr erreichbar.
     */
    async deleteList(listId) {
      const list = await requireList(listId)
      await db.transaction('rw', db.lists, db.tasks, async () => {
        const { updated_at } = stamp()
        await db.lists.put({ ...list, deleted_at: updated_at, updated_at, dirty: 1 })
        const tasks = await db.tasks.where('list_id').equals(listId).toArray()
        const open = tasks.filter((task) => task.deleted_at === null)
        if (open.length > 0) {
          await db.tasks.bulkPut(
            open.map((task) => ({ ...task, deleted_at: updated_at, updated_at, dirty: 1 })),
          )
        }
      })
    },

    async getList(listId) {
      const list = await db.lists.get(listId)
      return list && list.deleted_at === null ? list : undefined
    },

    async listLists() {
      const lists = await db.lists.toArray()
      return lists
        .filter((list) => list.deleted_at === null)
        .sort((a, b) => a.name.localeCompare(b.name))
    },

    async createTask(input) {
      await requireList(input.listId)
      const now = clock.now()
      const task: LocalTask = {
        id: newId(),
        list_id: input.listId,
        title: requireText(input.title, 'Der Titel'),
        description: optionalText(input.description),
        due_at: optionalText(input.dueAt),
        completed: false,
        created_at: now,
        updated_at: now,
        deleted_at: null,
        dirty: 1,
      }
      await db.tasks.add(task)
      return task
    },

    async updateTask(taskId, patch) {
      const task = await requireTask(taskId)
      const updated: LocalTask = {
        ...task,
        title: patch.title === undefined ? task.title : requireText(patch.title, 'Der Titel'),
        description:
          patch.description === undefined ? task.description : optionalText(patch.description),
        due_at: patch.dueAt === undefined ? task.due_at : optionalText(patch.dueAt),
        ...stamp(),
      }
      await db.tasks.put(updated)
      return updated
    },

    async setTaskCompleted(taskId, completed) {
      const task = await requireTask(taskId)
      const updated: LocalTask = { ...task, completed, ...stamp() }
      await db.tasks.put(updated)
      return updated
    },

    /**
     * Verschieben ist ein normales Update: `list_id` gehört zur Zeile und wird
     * damit beim nächsten Sync mit übertragen. Der Server prüft über die
     * RLS-Policies, dass die Ziel-Liste überhaupt zugänglich ist.
     */
    async moveTask(taskId, targetListId) {
      const task = await requireTask(taskId)
      if (task.list_id === targetListId) return task
      await requireList(targetListId)
      const updated: LocalTask = { ...task, list_id: targetListId, ...stamp() }
      await db.tasks.put(updated)
      return updated
    },

    async deleteTask(taskId) {
      const task = await requireTask(taskId)
      const { updated_at } = stamp()
      await db.tasks.put({ ...task, deleted_at: updated_at, updated_at, dirty: 1 })
    },

    async getTask(taskId) {
      const task = await db.tasks.get(taskId)
      return task && task.deleted_at === null ? task : undefined
    },

    async listTasks(listId) {
      const tasks = await db.tasks.where('list_id').equals(listId).toArray()
      return tasks.filter((task) => task.deleted_at === null).sort(compareTasks)
    },

    async listMembers(listId) {
      const members = await db.list_members.where('list_id').equals(listId).toArray()
      return members
        .filter((member) => member.deleted_at === null)
        .sort((a, b) => a.user_id.localeCompare(b.user_id))
    },

    async markListShared(listId) {
      const list = await requireList(listId)
      if (list.is_shared) return
      await db.lists.put({ ...list, is_shared: true, ...stamp() })
    },

    /**
     * Entfernt ein Mitglied lokal und markiert die Zeile als schmutzig.
     *
     * Das funktioniert auch offline, weil der Besitzer die Mitgliedszeile
     * bereits heruntergeladen hat. Der Server lehnt die Änderung ab, wenn der
     * Aufrufer nicht Besitzer der Liste ist (RLS).
     */
    async removeMember(listId, userId) {
      const existing = await db.list_members.get([listId, userId])
      if (!existing) {
        throw new ValidationError('Dieses Mitglied ist lokal nicht bekannt.')
      }
      const { updated_at } = stamp()
      const updated: LocalListMember = {
        ...existing,
        deleted_at: updated_at,
        updated_at,
        dirty: 1,
      }
      await db.list_members.put(updated)
    },
  }
}
