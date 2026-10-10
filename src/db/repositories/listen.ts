import { parseSections, withNewSection, withRenamedSection, withoutSection } from '../../domain/sections'
import { newId } from '../../domain/ids'
import { timeOf } from '../../domain/clock'
import { compareListsByName, restoreCutoff } from '../../domain/ordering'
import { completionDeadline, completionExpired } from '../../domain/taskLifecycle'
import { normalisiereAufgabe } from '../../domain/normalize'
import type { LocalList, LocalTask } from '../../domain/types'
import { requireText, ValidationError } from '../validation'
import type { Kontext } from './context'
import type { Repositories } from './types'

export function listen(ctx: Kontext): Pick<Repositories, 'createList' | 'renameList' | 'setListIcon' | 'setListKeepCompleted' | 'deleteList' | 'getList' | 'listLists' | 'listDeletedLists' | 'restoreList' | 'addListSection' | 'renameListSection' | 'deleteListSection'> {
  return {
    async listDeletedLists() {
      const grenze = restoreCutoff(timeOf(ctx.clock.now()))
      const lists = await ctx.db.lists.where('deleted_at').aboveOrEqual(grenze).toArray()
      return lists
        .filter((list) => list.owner_id !== '')
        .sort((a, b) => (b.deleted_at ?? '').localeCompare(a.deleted_at ?? ''))
    },

    /**
     * Holt eine gelöschte Liste zurück – samt der Aufgaben, die mit ihr
     * gelöscht wurden.
     *
     * Erkannt werden sie an ihrem `deleted_at`: `deleteList` stempelt Liste und
     * Aufgaben mit demselben Zeitstempel. Aufgaben, die vorher einzeln gelöscht
     * wurden, bleiben damit gelöscht.
     */
    async restoreList(listId) {
      const list = await ctx.db.lists.get(listId)
      if (!list) throw new ValidationError('not-found', 'Diese Liste existiert nicht mehr.')
      const zeitpunkt = list.deleted_at

      await ctx.db.transaction('rw', ctx.db.lists, ctx.db.tasks, async () => {
        await ctx.db.lists.put({ ...list, deleted_at: null, ...ctx.stamp() })
        if (zeitpunkt === null) return
        const mitgeloescht = await ctx.db.tasks
          .where('list_id')
          .equals(listId)
          .filter((task) => task.deleted_at === zeitpunkt && !completionExpired(normalisiereAufgabe(task), ctx.clock.nowMs()))
          .toArray()
        if (mitgeloescht.length > 0) {
          await ctx.db.tasks.bulkPut(
            mitgeloescht.map((task) => ({ ...task, deleted_at: null, ...ctx.stamp() })),
          )
        }
      })
    },

    async createList(name, ownerId) {
      const now = ctx.clock.now()
      const list: LocalList = {
        // Noch keine Abschnitte – der Plan ist von Anfang an da, nicht erst
        // nach dem ersten Anlegen.
        sections: [],
        keep_completed: false,
        completion_retention_started_at: now,
        id: newId(),
        name: requireText(name, 'Der Listenname'),
        owner_id: ownerId,
        is_shared: false,
        icon: null,
        created_at: now,
        updated_at: now,
        deleted_at: null,
        dirty: 1,
      }
      await ctx.db.lists.add(list)
      return list
    },

    async renameList(listId, name) {
      const list = await ctx.requireList(listId)
      const updated: LocalList = { ...list, name: requireText(name, 'Der Listenname'), ...ctx.stamp() }
      await ctx.db.lists.put(updated)
      return updated
    },

    async setListKeepCompleted(listId, userId, keep) {
      await ctx.db.transaction('rw', ctx.db.lists, ctx.db.tasks, async () => {
        const list = await ctx.requireList(listId)
        if (list.owner_id !== userId) throw new ValidationError('invalid', 'Nur der Besitzer kann diese Listenregel ändern.')
        if (list.keep_completed === keep) return
        const now = ctx.clock.now()
        const tasks = (await ctx.db.tasks.where('list_id').equals(listId).toArray()).map(normalisiereAufgabe)
        // Bereits Abgelaufenes bekommt durch Umschalten keine neue Frist.
        const changed = tasks.filter(task => task.completed && !completionExpired(task, ctx.clock.nowMs()))
          .map(task => ({ ...task, completed_expires_at: completionDeadline(now, keep), ...ctx.stamp() }))
        await ctx.db.lists.put({ ...list, keep_completed: keep, completion_retention_started_at: keep ? list.completion_retention_started_at : now, ...ctx.stamp() })
        if (changed.length) await ctx.db.tasks.bulkPut(changed)
      })
    },

    async setListIcon(listId, icon) {
      const list = await ctx.requireList(listId)
      const updated: LocalList = { ...list, icon, ...ctx.stamp() }
      await ctx.db.lists.put(updated)
      return updated
    },

    async deleteList(listId) {
      const list = await ctx.requireList(listId)
      await ctx.db.transaction('rw', ctx.db.lists, ctx.db.tasks, async () => {
        const { updated_at } = ctx.stamp()
        await ctx.db.lists.put({ ...list, deleted_at: updated_at, updated_at, dirty: 1 })
        const tasks = await ctx.db.tasks.where('list_id').equals(listId).toArray()
        const open = tasks.filter((task) => task.deleted_at === null)
        if (open.length > 0) {
          await ctx.db.tasks.bulkPut(
            open.map((task) => ({ ...task, deleted_at: updated_at, updated_at, dirty: 1 })),
          )
        }
      })
    },

    async getList(listId) {
      const list = await ctx.db.lists.get(listId)
      return list && list.deleted_at === null ? ctx.mitAbschnittsplan(list) : undefined
    },

    async listLists() {
      const lists = await ctx.db.lists.toArray()
      return lists
        .filter((list) => list.deleted_at === null)
        .map(ctx.mitAbschnittsplan)
        .sort(compareListsByName)
    },

    /**
     * Soft Delete inklusive Kaskade auf die Aufgaben der Liste.
     *
     * Ohne Kaskade blieben Aufgaben als unsichtbare Waisen zurück, die bei
     * jedem Sync mit hochgeladen würden. Verweise auf Mitgliedschaften werden
     * nicht angefasst: Ohne die Liste sind sie über die Server-Policies
     * ohnehin nicht mehr erreichbar.
     */
    async addListSection(listId, name) {
      const list = await ctx.requireList(listId)
      const neu = withNewSection(parseSections(list.sections), name)
      if (neu === null) return null
      await ctx.db.lists.put({ ...list, sections: neu.sections, ...ctx.stamp() })
      return neu.id
    },

    async renameListSection(listId, sectionId, name) {
      const list = await ctx.requireList(listId)
      const sections = withRenamedSection(parseSections(list.sections), sectionId, name)
      if (sections === parseSections(list.sections)) return
      await ctx.db.lists.put({ ...list, sections, ...ctx.stamp() })
    },

    async deleteListSection(listId, sectionId) {
      const list = await ctx.requireList(listId)
      const sections = withoutSection(parseSections(list.sections), sectionId)
      const { updated_at } = ctx.stamp()

      // Zwei Schreibungen, ein Vorgang: Der Abschnitt verschwindet aus dem Plan,
      // und seine Aufgaben fallen nach „ohne Bereich". Bliebe der Verweis
      // stehen, zeigte er ins Leere – angezeigt würde die Aufgabe wie „ohne
      // Bereich", aber die Daten wären irreführend.
      await ctx.db.transaction('rw', ctx.db.lists, ctx.db.tasks, async () => {
        await ctx.db.lists.put({ ...list, sections, updated_at, dirty: 1 })

        const aufgaben = await ctx.db.tasks.where('list_id').equals(listId).toArray()
        const betroffen: LocalTask[] = aufgaben
          .filter((task) => task.deleted_at === null && task.section_id === sectionId)
          .map((task) => ({ ...task, section_id: null, updated_at, dirty: 1 }))
        if (betroffen.length > 0) {
          await ctx.db.tasks.bulkPut(betroffen)
        }
      })
    },
  }
}
