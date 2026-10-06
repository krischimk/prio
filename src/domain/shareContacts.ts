import type { ShareContact } from './types'

/**
 * Adressen, mit denen schon einmal eine Liste geteilt wurde.
 *
 * Sie sind eine **Eingabehilfe**, keine Angabe über eine Liste oder eine
 * Aufgabe: Wer eine Liste teilt, tippt sonst jedes Mal dieselbe Adresse. Die
 * Liste wird deshalb nur lokal geführt (in `meta`, wie die vorgemerkten
 * Vorlaufzeiten) und nicht synchronisiert – fremde E-Mail-Adressen haben in
 * der Cloud nichts zu suchen, solange sie dafür keinen Zweck erfüllen.
 *
 * Gepflegt wird sie ausschließlich aus dem, was der Benutzer selbst eingetragen
 * hat: Beim Teilen gibt der Server die Benutzer-ID zurück, und nur dieses Paar
 * wird gemerkt. Es gibt keinen Weg, aus der App heraus fremde Adressen
 * einzusammeln.
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
      .map((eintrag) => ({ ...eintrag, email: normalizeShareEmail(eintrag.email) }))
      .filter((eintrag) => eintrag.email.length > 0)
      .slice(0, SHARE_CONTACTS_MAX)
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
  if (adresse.length === 0 || userId.length === 0) return contacts

  const ohne = contacts.filter((eintrag) => eintrag.email !== adresse)
  return [{ email: adresse, user_id: userId, last_used_at: at }, ...ohne].slice(
    0,
    SHARE_CONTACTS_MAX,
  )
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
 * Ergänzt Adressen, die der Server kennt: Personen, mit denen eine gemeinsame
 * Liste besteht (siehe Migration `0012`).
 *
 * Bekannte Adressen bleiben, wo sie sind, und behalten ihr `last_used_at` –
 * sonst würde die Reihenfolge bei jedem Abgleich neu gewürfelt. Neu
 * hinzugekommene stehen vorn, weil sie gerade entdeckt wurden.
 */
export function withCoMemberContacts(
  contacts: ShareContact[],
  additions: ReadonlyArray<{ userId: string; email: string }>,
  at: string,
): ShareContact[] {
  const bekannt = new Set(contacts.map((eintrag) => eintrag.email))
  const neu: ShareContact[] = []

  for (const eintrag of additions) {
    const adresse = normalizeShareEmail(eintrag.email)
    if (adresse.length === 0 || eintrag.userId.length === 0) continue
    if (bekannt.has(adresse)) continue
    if (neu.some((vorhanden) => vorhanden.email === adresse)) continue
    bekannt.add(adresse)
    neu.push({ email: adresse, user_id: eintrag.userId, last_used_at: at })
  }

  if (neu.length === 0) return contacts
  neu.sort((a, b) => a.email.localeCompare(b.email))
  return [...neu, ...contacts].slice(0, SHARE_CONTACTS_MAX)
}
