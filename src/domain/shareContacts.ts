import type { ShareContact } from './types'
import { normalizeUsername, validUsername } from './username'

/**
 * Adressen, mit denen schon einmal eine Liste geteilt wurde.
 *
 * Sie sind eine **Eingabehilfe**, keine Angabe über eine Liste oder eine
 * Aufgabe: Wer eine Liste teilt, tippt sonst jedes Mal dieselbe Adresse. Die
 * Liste wird deshalb nur lokal geführt (in `meta`, wie die vorgemerkten
 * Vorlaufzeiten) und nicht synchronisiert – fremde E-Mail-Adressen haben in
 * der Cloud nichts zu suchen, solange sie dafür keinen Zweck erfüllen.
 *
 * E-Mail-Adressen stammen aus eigenen Eingaben. Der Server ergänzt für
 * gemeinsame Listen nur Benutzernamen und Kennungen, keine privaten Adressen.
 */

/** So viele Adressen werden behalten – die zuletzt verwendeten. */
export const SHARE_CONTACTS_MAX = 20

/** So viele Vorschläge zeigt das Formular höchstens an. */
export const SHARE_SUGGESTIONS_MAX = 5

/** Adressen werden vergleichbar abgelegt: ohne Leerzeichen, kleingeschrieben. */
export function normalizeShareEmail(email: string): string {
  return email.trim().toLowerCase()
}

/**
 * Liest die gemerkten Adressen aus dem gespeicherten JSON.
 *
 * Defensiv wie bei den Vorlaufzeiten: Eine von Hand verbogene Zeile darf das
 * Teilen nicht unbrauchbar machen – unbrauchbare Einträge fallen weg.
 */
export function parseShareContacts(raw: string | null): ShareContact[] {
  if (raw === null) return []
  try {
    const werte: unknown = JSON.parse(raw)
    if (!Array.isArray(werte)) return []
    return werte
      .filter(
        (eintrag): eintrag is ShareContact =>
          typeof eintrag === 'object' &&
          eintrag !== null &&
          typeof (eintrag as ShareContact).email === 'string' &&
          typeof (eintrag as ShareContact).user_id === 'string' &&
          typeof (eintrag as ShareContact).last_used_at === 'string',
      )
      .map((eintrag) => {
        const username = typeof eintrag.username === 'string' ? normalizeUsername(eintrag.username) : null
        return { email: normalizeShareEmail(eintrag.email), user_id: eintrag.user_id, last_used_at: eintrag.last_used_at,
          ...(eintrag.username !== undefined ? { username: username && validUsername(username) ? username : null } : {}) }
      })
      .filter((eintrag) => eintrag.user_id.length > 0 && (eintrag.email.length > 0 || !!eintrag.username))

  } catch {
    return []
  }
}

/**
 * Merkt eine Adresse, mit der gerade geteilt wurde – zuletzt verwendete zuerst.
 *
 * Eine bekannte Adresse wird nicht doppelt geführt, sondern rückt nach vorn;
 * ihre Benutzer-ID wird dabei aufgefrischt.
 */
export function withShareContact(
  contacts: ShareContact[],
  email: string,
  userId: string,
  at: string,
): ShareContact[] {
  const adresse = normalizeShareEmail(email)
  const username = contacts.find(contact => contact.user_id === userId)?.username
  if ((!adresse && !username) || userId.length === 0) return contacts

  const ohne = contacts.filter((eintrag) => eintrag.user_id !== userId && (!adresse || eintrag.email !== adresse))
  const next = [{ email: adresse, user_id: userId, last_used_at: at, ...(username !== undefined ? { username } : {}) }, ...ohne]
  // Namen aktueller Mitwirkender dienen auch der Anzeige, nicht nur Vorschlägen.
  return next.filter((contact, index) => index < SHARE_CONTACTS_MAX || contact.username !== undefined)
}

/**
 * Die Vorschläge für das Teilen-Formular: zuletzt verwendete zuerst, ohne
 * Adressen, die in dieser Liste schon Mitglied sind.
 *
 * Die Zuordnung läuft über die Benutzer-ID, weil das die einzige Kennung ist,
 * die lokal auch für Mitglieder vorliegt.
 */
export function suggestShareContacts(
  contacts: ShareContact[],
  memberUserIds: string[],
  limit = SHARE_SUGGESTIONS_MAX,
): ShareContact[] {
  const mitglieder = new Set(memberUserIds)
  return contacts.filter((eintrag) => !mitglieder.has(eintrag.user_id)).slice(0, limit)
}

/**
 * Ergänzt Benutzernamen gemeinsamer Listen. Der Server liefert keine privaten
 * E-Mail-Adressen mehr; ein leerer Adresswert entfernt auch alte Cloud-Kopien.
 *
 * Bekannte Adressen bleiben, wo sie sind, und behalten ihr `last_used_at` –
 * sonst würde die Reihenfolge bei jedem Abgleich neu gewürfelt. Neu
 * hinzugekommene stehen vorn, weil sie gerade entdeckt wurden.
 */
export function withCoMemberContacts(
  contacts: ShareContact[],
  additions: ReadonlyArray<{ userId: string; email: string; username?: string | null }>,
  at: string,
): ShareContact[] {
  const byUser = new Map(additions.map(contact => [contact.userId, contact]))
  const existing = contacts.map(contact => {
    const current = byUser.get(contact.user_id)
    return current && current.username !== undefined
      ? { ...contact, email: normalizeShareEmail(current.email), username: current.username } : contact
  })
  const known = new Set(existing.map(contact => contact.user_id))
  const emails = new Set(existing.map(contact => contact.email).filter(Boolean))
  const added = additions.filter(contact => {
    const email = normalizeShareEmail(contact.email)
    const username = typeof contact.username === 'string' ? normalizeUsername(contact.username) : ''
    if (!contact.userId || (!email && !validUsername(username)) || known.has(contact.userId) || (email && emails.has(email))) return false
    known.add(contact.userId); if (email) emails.add(email)
    return true
  })
    .map(contact => ({ email: normalizeShareEmail(contact.email), user_id: contact.userId, last_used_at: at,
      ...(contact.username !== undefined ? { username: contact.username } : {}) }))
    .sort((a, b) => (a.username || a.email).localeCompare(b.username || b.email))
  // Aktuelle Mitwirkende bleiben vollständig lesbar; die Vorschlagsliste selbst
  // begrenzt weiterhin, wie viele Einträge auf einmal angeboten werden.
  return added.length === 0 && existing.every((contact, index) => contact.username === contacts[index].username && contact.email === contacts[index].email) ? contacts : [...added, ...existing]
}
