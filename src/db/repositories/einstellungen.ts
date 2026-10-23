import { isPlausibleOffset } from '../../domain/reminder'
import { readMeta, writeMeta } from '../metaStore'
import { normalizeShareEmail, parseShareContacts, withCoMemberContacts, withShareContact } from '../../domain/shareContacts'
import type { Kontext } from './context'
import type { Repositories } from './types'
import { readCloudConflicts, resolveCloudConflict } from '../cloudState'
import { normalisiereListenauswahl, normalisiereStartansicht } from '../../domain/normalize'
import { requireText, ValidationError } from '../validation'
import { placeNavigationList } from '../../domain/listNavigation'
import { parseDiscardedNotes } from '../../domain/discardedNotes'
import { parseCalendarPreferences, validDay, validTimeZone } from '../../domain/calendar'
import { sameData } from '../../domain/equality'

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
const META_DISCARDED_NOTES = 'discarded_notes'
export function einstellungen(ctx: Kontext): Pick<Repositories, 'rememberDiscardedNote' | 'listDiscardedNotes' | 'pruneDiscardedNotes' | 'listReminderPresets' | 'setReminderPresets' | 'listShareContacts' | 'rememberShareContact' | 'mergeShareContacts' | 'listCloudConflicts' | 'resolveCloudConflict' | 'listListPreferences' | 'setListInOverview' | 'setListSortMode' | 'placeList' | 'getUserPreferences' | 'updateUserPreferences' | 'setTaskExpanded'> {
  return {
    async rememberDiscardedNote(note) {
      await ctx.db.transaction('rw', ctx.db.meta, async () => {
        const notes = parseDiscardedNotes(await readMeta(ctx.db, META_DISCARDED_NOTES), ctx.clock.nowMs())
        const latest = notes.find(row => row.taskId === note.taskId && row.listId === note.listId)
        if (latest?.description === note.description) return
        notes.unshift({ ...note, id: crypto.randomUUID(), discardedAt: ctx.clock.now() })
        await writeMeta(ctx.db, META_DISCARDED_NOTES, JSON.stringify(notes))
      })
    },
    async listDiscardedNotes() {
      return parseDiscardedNotes(await readMeta(ctx.db, META_DISCARDED_NOTES), ctx.clock.nowMs())
    },
    async pruneDiscardedNotes() {
      return ctx.db.transaction('rw', ctx.db.meta, async () => {
        const raw = await readMeta(ctx.db, META_DISCARDED_NOTES)
        if (raw === null) return false
        const remaining = parseDiscardedNotes(raw, ctx.clock.nowMs())
        if (JSON.stringify(remaining) === raw) return false
        if (remaining.length === 0) await ctx.db.meta.delete(META_DISCARDED_NOTES)
        else await writeMeta(ctx.db, META_DISCARDED_NOTES, JSON.stringify(remaining))
        return true
      })
    },
    async setListSortMode(listId, userId, sortMode) {
      requireText(userId, 'Die Benutzerkennung')
      if (!['manual', 'priority', 'priority_flat'].includes(sortMode)) throw new ValidationError('invalid', 'Diese Sortierung ist nicht verfügbar.')
      await ctx.db.transaction('rw', ctx.db.lists, ctx.db.list_preferences, async () => {
        await ctx.requireList(listId)
        const existing = await ctx.db.list_preferences.get([listId, userId])
        if ((!existing || existing.deleted_at === null) && (existing?.sort_mode ?? 'manual') === sortMode) return
        await ctx.db.list_preferences.put({
          position: null, hidden: false, include_in_overview: false, ...existing,
          list_id: listId, user_id: userId, sort_mode: sortMode,
          created_at: existing?.created_at ?? ctx.clock.now(), deleted_at: null, ...ctx.stamp(),
        })
      })
    },
    async placeList(listId, userId, destination) {
      requireText(userId, 'Die Benutzerkennung')
      await ctx.db.transaction('rw', ctx.db.lists, ctx.db.list_preferences, async () => {
        await ctx.requireList(listId)
        const lists = (await ctx.db.lists.toArray()).filter(row => row.deleted_at === null)
        const preferences = (await ctx.db.list_preferences.where('user_id').equals(userId).toArray())
          .filter(row => row.deleted_at === null).map(normalisiereListenauswahl)
        const moves = placeNavigationList(lists, preferences, listId, destination)
        for (const move of moves) {
          const old = preferences.find(row => row.list_id === move.listId)
          if (old && old.position === move.position && old.hidden === move.hidden) continue
          await ctx.db.list_preferences.put({
            list_id: move.listId, user_id: userId, include_in_overview: old?.include_in_overview ?? false,
            position: move.position, hidden: move.hidden,
            sort_mode: old?.sort_mode ?? 'manual',
            created_at: old?.created_at ?? ctx.clock.now(), deleted_at: null, ...ctx.stamp(),
          })
        }
      })
    },
    async getUserPreferences(userId) {
      const row = await ctx.db.user_preferences.get(userId)
      return row && row.deleted_at === null ? normalisiereStartansicht(row) : undefined
    },

    async setTaskExpanded(userId, taskId, part, open) {
      requireText(userId, 'Die Benutzerkennung')
      await ctx.db.transaction('rw', ctx.db.tasks, ctx.db.user_preferences, async () => {
        await ctx.requireTask(taskId)
        const existing = await ctx.db.user_preferences.get(userId)
        const expansions = { ...(existing ? normalisiereStartansicht(existing).task_expansions : {}) }
        const bit = part === 'note' ? 1 : 2
        const previous = expansions[taskId] ?? 0
        const next = open ? previous | bit : previous & ~bit
        if (next === previous) return
        if (next) expansions[taskId] = next
        else delete expansions[taskId]
        await ctx.db.user_preferences.put({
          id: userId, default_list_id: null, overview_mode: 'by_list', detailed_ratings: false,
          created_at: ctx.clock.now(), ...existing, task_expansions: expansions, deleted_at: null, ...ctx.stamp(),
        })
      })
    },

    async updateUserPreferences(userId, patch) {
      requireText(userId, 'Die Benutzerkennung')
      if (patch.overviewMode !== undefined && !['by_list', 'newest', 'priority'].includes(patch.overviewMode)) throw new ValidationError('invalid', 'Diese Ansicht ist nicht verfügbar.')
      await ctx.db.transaction('rw', ctx.db.lists, ctx.db.user_preferences, async () => {
        if (patch.defaultListId) await ctx.requireList(patch.defaultListId)
        const existing = await ctx.db.user_preferences.get(userId)
        const default_list_id = patch.defaultListId !== undefined ? patch.defaultListId : existing?.default_list_id ?? null
        const overview_mode = patch.overviewMode ?? existing?.overview_mode ?? 'by_list'
        const detailed_ratings = patch.detailedRatings ?? existing?.detailed_ratings ?? false
        const previous = parseCalendarPreferences(existing?.calendar_preferences)
        const calendar_preferences = { ...previous, days: { ...previous.days } }
        if (patch.calendar) {
          const change = patch.calendar
          if (change.timeZone !== undefined) {
            if (!validTimeZone(change.timeZone)) throw new ValidationError('invalid', 'Diese Zeitzone ist ungültig.')
            calendar_preferences.timeZone = change.timeZone
          }
          if (change.open !== undefined) calendar_preferences.open = change.open
          if (change.repeats !== undefined) {
            if (!['active', 'all', 'none'].includes(change.repeats)) throw new ValidationError('invalid', 'Diese Kalenderansicht ist nicht verfügbar.')
            calendar_preferences.repeats = change.repeats
          }
          if (change.day) {
            if (!validDay(change.day.date) || !['normal', 'low', 'none'].includes(change.day.capacity)) throw new ValidationError('invalid', 'Bitte einen gültigen Tag und eine Zeitangabe wählen.')
            if (change.day.capacity === 'normal') delete calendar_preferences.days[change.day.date]
            else calendar_preferences.days[change.day.date] = change.day.capacity
          }
        }
        if ((!existing || existing.deleted_at === null) && default_list_id === (existing?.default_list_id ?? null) && overview_mode === (existing?.overview_mode ?? 'by_list') && detailed_ratings === (existing?.detailed_ratings ?? false) && sameData(calendar_preferences, previous)) return
        await ctx.db.user_preferences.put({ id: userId, default_list_id, overview_mode, detailed_ratings, calendar_preferences, task_expansions: existing?.task_expansions ?? {}, created_at: existing?.created_at ?? ctx.clock.now(), deleted_at: null, ...ctx.stamp() })
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
          position: null, hidden: false, sort_mode: 'manual', ...existing,
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
      if (userId.length === 0) return
      const bisher = parseShareContacts(await readMeta(ctx.db, META_SHARE_CONTACTS))
      const { updated_at } = ctx.stamp()
      const neu = withShareContact(bisher, adresse, userId, updated_at)
      await writeMeta(ctx.db, META_SHARE_CONTACTS, JSON.stringify(neu))
    },

    async mergeShareContacts(contacts, at) {
      if (contacts.length === 0) return false
      const bisher = parseShareContacts(await readMeta(ctx.db, META_SHARE_CONTACTS))
      const neu = withCoMemberContacts(bisher, contacts, at)
      if (JSON.stringify(neu) === JSON.stringify(bisher)) return false
      await writeMeta(ctx.db, META_SHARE_CONTACTS, JSON.stringify(neu))
      return true
    },
  }
}
