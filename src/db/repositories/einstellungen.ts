import { isPlausibleOffset } from '../../domain/reminder'
import { readMeta, writeMeta } from '../metaStore'
import { normalizeShareEmail, parseShareContacts, withCoMemberContacts, withShareContact } from '../../domain/shareContacts'
import type { Kontext } from './context'
import type { Repositories } from './types'

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
export function einstellungen(ctx: Kontext): Pick<Repositories, 'listReminderPresets' | 'setReminderPresets' | 'listShareContacts' | 'rememberShareContact' | 'mergeShareContacts'> {
  return {

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
