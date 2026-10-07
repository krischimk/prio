import { normalisiereMitglied } from '../../domain/normalize'
import { compareMembersById } from '../../domain/ordering'
import type { LocalListMember } from '../../domain/types'
import { ValidationError } from '../validation'
import type { Kontext } from './context'
import type { Repositories } from './types'

export function mitglieder(ctx: Kontext): Pick<Repositories, 'listMembers' | 'markListShared' | 'leaveList' | 'removeMember'> {
  return {

    async listMembers(listId) {
      const members = await ctx.db.list_members.where('list_id').equals(listId).toArray()
      return members
        .filter((member) => member.deleted_at === null)
        .map(normalisiereMitglied)
        .sort(compareMembersById)
    },

    async markListShared(listId) {
      const list = await ctx.requireList(listId)
      if (list.is_shared) return
      await ctx.db.lists.put({ ...list, is_shared: true, ...ctx.stamp() })
    },

    /**
     * Entfernt ein Mitglied lokal und markiert die Zeile als schmutzig.
     *
     * Das funktioniert auch offline, weil der Besitzer die Mitgliedszeile
     * bereits heruntergeladen hat. Der Server lehnt die Änderung ab, wenn der
     * Aufrufer nicht Besitzer der Liste ist (RLS).
     */
    async leaveList(listId, userId) {
      const existing = await ctx.db.list_members.get([listId, userId])
      if (!existing) {
        throw new ValidationError('empty', 'Diese Mitgliedschaft ist lokal nicht bekannt.')
      }
      if (existing.deleted_at !== null) return

      const { updated_at } = ctx.stamp()
      const updated: LocalListMember = {
        ...existing,
        deleted_at: updated_at,
        updated_at,
        dirty: 1,
      }
      await ctx.db.list_members.put(updated)
    },

    async removeMember(listId, userId) {
      const existing = await ctx.db.list_members.get([listId, userId])
      if (!existing) {
        throw new ValidationError('empty', 'Dieses Mitglied ist lokal nicht bekannt.')
      }
      const { updated_at } = ctx.stamp()
      const updated: LocalListMember = {
        ...existing,
        deleted_at: updated_at,
        updated_at,
        dirty: 1,
      }
      await ctx.db.list_members.put(updated)
    },
  }
}
