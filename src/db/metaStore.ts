import type { LocalDatabase } from './localDb'

/**
 * Der neutrale Schlüssel-Wert-Speicher der lokalen Datenbank.
 *
 * Er lag bisher in `src/sync/syncStore.ts` – dadurch hingen `db` und
 * `reminders` an der Sync-Schicht, obwohl ihre Werte (vorgemerkte
 * Vorlaufzeiten, Erinnerungs-Zähler) mit dem Abgleich nichts zu tun haben. Die
 * Schichtrichtung war damit verkehrt herum.
 *
 * Hier stehen nur die Zugriffe. **Welche** Schlüssel es gibt, weiß jeweils der,
 * der sie schreibt und liest.
 */
export async function readMeta(db: LocalDatabase, key: string): Promise<string | null> {
  const row = await db.meta.get(key)
  return row ? row.value : null
}

export async function writeMeta(db: LocalDatabase, key: string, value: string): Promise<void> {
  await db.meta.put({ key, value })
}
