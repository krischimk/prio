/**
 * Domänenmodell der App.
 *
 * Es gibt bewusst zwei Varianten jeder Entität:
 *
 *  - `Local*`  – so liegt der Datensatz in Dexie/IndexedDB (inkl. `dirty`).
 *  - `Remote*` – so liegt der Datensatz in Supabase PostgreSQL (ohne `dirty`).
 *
 * Die Umwandlung passiert ausschließlich in `domain/mapping.ts`.
 */

/** ISO-8601-Zeitstempel in UTC, z. B. `2026-01-31T12:00:00.000Z`. */
export type IsoDateTime = string

/**
 * 0 = mit dem Server synchron, 1 = lokal geändert und noch nicht hochgeladen.
 * Als Zahl (statt boolean), damit Dexie den Wert indexieren kann.
 */
export type SyncFlag = 0 | 1

/** Pflichtfelder, die lokale und entfernte Variante jeder Entität teilen. */
export interface SyncableRow {
  updated_at: IsoDateTime
  deleted_at: IsoDateTime | null
}

/** Felder, die ausschließlich lokal existieren und nie hochgeladen werden. */
export interface LocalOnly {
  dirty: SyncFlag
}

export interface LocalList extends SyncableRow, LocalOnly {
  id: string
  name: string
  owner_id: string
  /** Wird `true`, sobald die Liste mindestens ein Mitglied hat. */
  is_shared: boolean
  /**
   * Kennung des Listensymbols, z. B. `std:haushalt` – `null` für kein Symbol.
   *
   * Gespeichert wird nur die Kennung, nicht das Bild: Die Darstellung bleibt
   * Sache der App und lässt sich ändern, ohne Daten umzuschreiben.
   */
  icon: string | null
  created_at: IsoDateTime
}

export interface LocalTask extends SyncableRow, LocalOnly {
  id: string
  list_id: string
  title: string
  description: string | null
  due_at: IsoDateTime | null
  completed: boolean
  /**
   * Zeitpunkt, zu dem die Aufgabe abgehakt wurde – `null`, solange sie offen
   * ist. Grundlage für „Aufgaben wiederherstellen“ in den Einstellungen.
   */
  completed_at: IsoDateTime | null
  /**
   * Vom Benutzer bestimmte Reihenfolge innerhalb der Liste (kleiner = weiter
   * oben). Neue Aufgaben bekommen die höchste Position und landen damit unten.
   *
   * Datensätze aus der Zeit vor dieser Funktion haben die Position 0. Bei
   * Gleichstand greifen die früheren Regeln (Erledigt-Status, Fälligkeit,
   * Erstellzeit) – so bleibt eine bestehende Liste nach dem Update stabil.
   */
  position: number
  created_at: IsoDateTime
}

/**
 * Mitgliedschaft in einer gemeinsamen Liste.
 *
 * Der Primärschlüssel ist das Paar (list_id, user_id) – bewusst ohne eigene ID,
 * damit zwei Geräte desselben Nutzers nicht versehentlich zwei Mitgliedschaften
 * für dieselbe Person erzeugen.
 *
 * Eine Mitgliedschaft bedeutet immer "Mitglied". Der Besitzer wird nicht über
 * diese Tabelle modelliert, sondern über `lists.owner_id`. Für Version 0.1 gibt
 * es daher keine Rollen-Spalte.
 */
export interface LocalListMember extends SyncableRow, LocalOnly {
  list_id: string
  user_id: string
  created_at: IsoDateTime
}

export interface LocalMeta {
  key: string
  value: string
}

/**
 * Lokal vorgemerkte Erinnerung für eine Aufgabe.
 *
 * Die Erinnerung selbst liegt beim Betriebssystem (Android AlarmManager); hier
 * steht nur, welche Aufgabe mit welcher Nummer wann geplant wurde. Nur so lässt
 * sich der Zustand später zuverlässig abgleichen und wieder aufräumen.
 *
 * `notificationId` ist eine kleine, fortlaufende Zahl: Android verlangt für
 * Benachrichtigungen eine 32-Bit-Ganzzahl, keine UUID.
 */
export interface LocalReminder {
  taskId: string
  notificationId: number
  /** Zeitpunkt, für den die Erinnerung geplant ist (ISO, UTC). */
  at: IsoDateTime
}

/** Zeile ohne `dirty` – die Form, die in Supabase liegt. */
export type RemoteList = Omit<LocalList, 'dirty'>
export type RemoteTask = Omit<LocalTask, 'dirty'>
export type RemoteListMember = Omit<LocalListMember, 'dirty'>

export type RemoteTable = 'lists' | 'list_members' | 'tasks'

export interface RemoteSnapshot {
  lists: RemoteList[]
  members: RemoteListMember[]
  tasks: RemoteTask[]
}

export interface PushPayload {
  lists: RemoteList[]
  members: RemoteListMember[]
  tasks: RemoteTask[]
}
