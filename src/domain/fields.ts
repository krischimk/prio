import type { LocalList, LocalListMember, LocalTask } from './types'

/**
 * Die Felder jeder Entität – an **einer** Stelle.
 *
 * Ein neues Feld musste bisher an mehreren Orten nachgetragen werden: im Typ,
 * in der Umwandlung zum Server (`mapping`), in der Migration (SQL) und in der
 * Erwartung des Prüfskripts (`scripts/db-apply.mjs`). Vergaß man einen, fiel es
 * erst beim Bestandsnutzer auf – fehlte die Migration, scheiterte jeder Abgleich
 * mit `PGRST204`; fehlte das Feld in der Umwandlung, kam es nie beim Server an.
 *
 * Hier stehen die Namen als Daten. Zwei Prüfungen hängen daran:
 *
 *  1. **Zur Übersetzungszeit** (`FelderGenau`): Die Liste muss die Felder des
 *     Typs genau nennen – kein Feld zu viel, keines zu wenig. Wer dem Typ ein
 *     Feld hinzufügt und es hier vergisst, bekommt einen Typfehler.
 *  2. **Im Test** (`tests/unit/fieldCatalogue.test.ts`): Die Umwandlung zum
 *     Server benutzt genau diese Felder, und jedes davon kommt in den
 *     Migrationen vor.
 */

/** Zur Übersetzungszeit: Die Liste nennt die Felder des Typs genau. */
type FelderGenau<T, Liste extends readonly string[]> =
  Exclude<keyof T, Liste[number]> extends never
    ? Exclude<Liste[number], keyof T> extends never
      ? true
      : ['Feld unbekannt', Exclude<Liste[number], keyof T>]
    : ['Feld fehlt', Exclude<keyof T, Liste[number]>]

export const LISTEN_FELDER = [
  'id',
  'name',
  'owner_id',
  'is_shared',
  'icon',
  'sections',
  'created_at',
  'updated_at',
  'deleted_at',
  'dirty',
] as const satisfies readonly (keyof LocalList)[]

export const AUFGABEN_FELDER = [
  'id',
  'list_id',
  'title',
  'description',
  'due_at',
  'completed',
  'completed_at',
  'recurrence',
  'successor_id',
  'reminders',
  'section_id',
  'position',
  'created_at',
  'updated_at',
  'deleted_at',
  'dirty',
] as const satisfies readonly (keyof LocalTask)[]

export const MITGLIEDER_FELDER = [
  'list_id',
  'user_id',
  'created_at',
  'updated_at',
  'deleted_at',
  'dirty',
] as const satisfies readonly (keyof LocalListMember)[]

// Wenn eine dieser Zusicherungen fehlschlägt, nennt der Fehler das Feld.
const _listen: FelderGenau<LocalList, typeof LISTEN_FELDER> = true
const _aufgaben: FelderGenau<LocalTask, typeof AUFGABEN_FELDER> = true
const _mitglieder: FelderGenau<LocalListMember, typeof MITGLIEDER_FELDER> = true
void _listen
void _aufgaben
void _mitglieder

/** Nur lokal: Diese Felder verlassen das Gerät nie. */
export const NUR_LOKALE_FELDER = ['dirty'] as const
