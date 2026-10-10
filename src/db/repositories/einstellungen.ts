import { isPlausibleOffset } from '../../domain/reminder'
import { readMeta, writeMeta } from '../metaStore'
import { normalizeShareEmail, parseShareContacts, withCoMemberContacts, withShareContact } from '../../domain/shareContacts'
import type { Kontext } from './context'
import type { Repositories } from './types'
import { readCloudConflicts, resolveCloudConflict } from '../cloudState'
import { normalisiereListenauswahl, normalisiereStartansicht } from '../../domain/normalize'
import { requireText, ValidationError } from '../validation'

/**
 * Wie lange eine abgehakte Aufgabe unter „Aufgaben wiederherstellen“ auftaucht.
 *
 * Bewusste Entscheidung: Die Aufgabe verschwindet nach dem Abhaken sofort aus
 * der Liste, bleibt aber eine Woche lang auffindbar. Danach ist sie nur noch
 * über die Synchronisation erreichbar (sie ist nicht gelöscht, nur verborgen).
 */
/**
 * Die selbst gemerkten Vorlaufzeiten für die Schnellauswahl.
 *
 * Bewusst nur lokal: Es ist eine Eingabehilfe, keine Angabe über eine Aufgabe.
 * Sie liegt in der Datenbank des Benutzers (`prio-user-<id>`) und ist damit pro
 * Konto getrennt, wandert aber nicht auf andere Geräte – dafür bräuchte es einen
 * Sync-Pfad für Einstellungen, den es noch nicht gibt.
 */
const META_REMINDER_PRESETS = 'reminder_presets'

/**
 * Die Adressen, mit denen schon einmal eine Liste geteilt wurde.
 *
 * Ebenfalls bewusst nur lokal: eine Eingabehilfe für das Teilen-Formular. Sie
 * enthält E-Mail-Adressen anderer Personen – die haben in der Cloud nichts zu
 * suchen, solange sie dort keinen Zweck erfüllen.
 */
const META_SHARE_CONTACTS = 'share_contacts'
export function einstellungen(ctx: Kontext): Pick<Repositories, 'listReminderPresets' | 'setReminderPresets' | 'listShareContacts' | 'rememberShareContact' | 'mergeShareContacts' | 'listCloudConflicts' | 'resolveCloudConflict' | 'listListPreferences' | 'setListInOverview' | 'getUserPreferences' | 'updateUserPreferences'> {
  return {
    async getUserPreferences(userId) {
      const row = await ctx.db.user_preferences.get(userId)
      return row && row.deleted_at === null ? normalisiereStartansicht(row) : undefined
    },

    async updateUserPreferences(userId, patch) {
      requireText(userId, 'Die Benutzerkennung')
      if (patch.overviewMode !== undefined && !['by_list', 'newest'].includes(patch.overviewMode)) throw new ValidationError('invalid', 'Diese Ansicht ist nicht verfügbar.')
      await ctx.db.transaction('rw', ctx.db.lists, ctx.db.user_preferences, async () => {
        if (patch.defaultListId) await ctx.requireList(patch.defaultListId)
        const existing = await ctx.db.user_preferences.get(userId)
        const default_list_id = patch.defaultListId !== undefined ? patch.defaultListId : existing?.default_list_id ?? null
        const overview_mode = patch.overviewMode ?? existing?.overview_mode ?? 'by_list'
        if ((!existing || existing.deleted_at === null) && default_list_id === (existing?.default_list_id ?? null) && overview_mode === (existing?.overview_mode ?? 'by_list')) return
        await ctx.db.user_preferences.put({ id: userId, default_list_id, overview_mode, created_at: existing?.created_at ?? ctx.clock.now(), deleted_at: null, ...ctx.stamp() })
      })
    },

    async listListPreferences(userId) {
      return (await ctx.db.list_preferences.where('user_id').equals(userId).toArray())
        .filter(row => row.deleted_at === null).map(normalisiereListenauswahl)
    },

    async setListInOverview(listId, userId, included) {
      requireText(userId, 'Die Benutzerkennung')
      await ctx.db.transaction('rw', ctx.db.lists, ctx.db.list_preferences, async () => {
        await ctx.requireList(listId)
        const existing = await ctx.db.list_preferences.get([listId, userId])
        // Aus ist der Default; eine unveränderte Auswahl erzeugt keinen Upload.
        if (!existing && !included) return
        if (existing?.deleted_at === null && existing.include_in_overview === included) return
        const now = ctx.clock.now()
        await ctx.db.list_preferences.put({
          list_id: listId, user_id: userId, include_in_overview: included,
          created_at: existing?.created_at ?? now, deleted_at: null, ...ctx.stamp(),
        })
      })
    },

    listCloudConflicts: () => readCloudConflicts(ctx.db),
    resolveCloudConflict: (conflict, choice) => resolveCloudConflict(ctx.db, conflict, choice, ctx.clock.now()),

    async listReminderPresets() {
      const roh = await readMeta(ctx.db, META_REMINDER_PRESETS)
      if (roh === null) return []
      try {
        const werte: unknown = JSON.parse(roh)
        if (!Array.isArray(werte)) return []
        // Nur brauchbare Zahlen durchlassen: Eine von Hand verbogene Zeile darf
        // die Auswahl nicht unbrauchbar machen.
        return werte.filter(
          (wert): wert is number => typeof wert === 'number' && isPlausibleOffset(wert),
        )
      } catch {
        return []
      }
    },

    async setReminderPresets(minutes) {
      const sauber = minutes.filter(isPlausibleOffset).map((wert) => Math.round(wert))
      await writeMeta(ctx.db, META_REMINDER_PRESETS, JSON.stringify(sauber))
    },

    async listShareContacts() {
      return parseShareContacts(await readMeta(ctx.db, META_SHARE_CONTACTS))
    },

    async rememberShareContact(email, userId) {
      const adresse = normalizeShareEmail(email)
      if (adresse.length === 0 || userId.length === 0) return
      const bisher = parseShareContacts(await readMeta(ctx.db, META_SHARE_CONTACTS))
      const { updated_at } = ctx.stamp()
      const neu = withShareContact(bisher, adresse, userId, updated_at)
      await writeMeta(ctx.db, META_SHARE_CONTACTS, JSON.stringify(neu))
    },

    async mergeShareContacts(contacts, at) {
      if (contacts.length === 0) return
      const bisher = parseShareContacts(await readMeta(ctx.db, META_SHARE_CONTACTS))
      const neu = withCoMemberContacts(bisher, contacts, at)
      if (JSON.stringify(neu) === JSON.stringify(bisher)) return
      await writeMeta(ctx.db, META_SHARE_CONTACTS, JSON.stringify(neu))
    },
  }
}
