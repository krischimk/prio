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

import type { TaskReminder } from './reminder'

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

/**
 * Eine Adresse, mit der schon einmal eine Liste geteilt wurde.
 *
 * Nur lokal – eine Eingabehilfe für das nächste Teilen, kein Datensatz, der
 * synchronisiert wird. Siehe `domain/shareContacts.ts`.
 */
export interface ShareContact {
  /** Kleingeschrieben und ohne Leerzeichen – so wird verglichen. */
  email: string
  /** Benutzer-ID aus der Antwort des Servers. */
  user_id: string
  last_used_at: IsoDateTime
}

/**
 * Ein Abschnitt innerhalb einer Liste („Obst", „Getränke").
 *
 * Nur Kennung und Name: Die Stelle in der Reihenfolge steckt in der Reihenfolge
 * des Arrays, die Zugehörigkeit einer Aufgabe in `LocalTask.section_id`.
 */
export interface ListSection {
  id: string
  name: string
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
  /**
   * Die Abschnitte der Liste in Anzeigereihenfolge.
   *
   * Zugeklappt oder offen ist dagegen **nicht** Teil der Liste: Das ist eine
   * Ansichtssache je Gerät und wird nicht abgeglichen.
   */
  sections: ListSection[]
  /** Gemeinsame Listenregel; nur der Besitzer stellt sie ein, zunächst aus. */
  keep_completed: boolean
  /** Letzte Einführung/Abschaltung der Aufbewahrung; vom Server bestätigt. */
  completion_retention_started_at: IsoDateTime | null
  created_at: IsoDateTime
}

export interface LocalTask extends SyncableRow, LocalOnly {
  id: string
  list_id: string
  /**
   * Der Abschnitt der Aufgabe innerhalb ihrer Liste; `null` heißt „ohne
   * Bereich". Ein Verweis auf einen nicht (mehr) vorhandenen Abschnitt wird
   * wie „ohne Bereich" angezeigt.
   */
  section_id: string | null
  title: string
  description: string | null
  due_at: IsoDateTime | null
  completed: boolean
  /**
   * Zeitpunkt, zu dem die Aufgabe abgehakt wurde – `null`, solange sie offen
   * ist. Grundlage für „Aufgaben wiederherstellen“ in den Einstellungen.
   */
  completed_at: IsoDateTime | null
  /** Bestätigte Löschfrist; null bei dauerhafter Aufbewahrung. */
  completed_expires_at: IsoDateTime | null
  /** Endgültiger Ablauf, vom Server gesetzt; kein Papierkorb. */
  expired_at: IsoDateTime | null
  reopen_context: TaskReopenContext | null
  /**
   * Wiederholung der Aufgabe: `daily`, `weekly`, `monthly` oder `yearly`.
   *
   * `null` heißt „keine Wiederholung". Unbekannte Werte behandelt die App
   * genauso – eine neue Wiederholungsart soll keine Datenbankänderung brauchen.
   */
  recurrence: string | null
  /**
   * Die beim Abhaken entstandene Nachfolgeaufgabe.
   *
   * Daran hängt eine Regel: „Rückgängig" – und ebenso das Wiederherstellen aus
   * den Einstellungen – weiß dadurch, was mit zurückgenommen werden muss.
   * Für das Wiederherstellen-Fenster selbst spielt das Feld keine Rolle: Dort
   * gilt für jede abgehakte Aufgabe dasselbe siebentägige Fenster.
   */
  successor_id: string | null
  /**
   * Die Erinnerungen der Aufgabe – leer heißt keine.
   *
   * Bewusst getrennt von `due_at`: Eine Fälligkeit setzt keine Erinnerung, und
   * der gewählte Moment bleibt der gewählte Moment, auch wenn sich die
   * Fälligkeit später verschiebt.
   *
   * Die Form folgt der Wiederholung – bei einer wiederkehrenden Aufgabe stehen
   * hier Vorläufe, bei einer einmaligen absolute Zeitpunkte. Die Regeln stehen
   * in `src/domain/reminder.ts`.
   */
  reminders: TaskReminder[]
  /**
   * Vom Benutzer bestimmte Reihenfolge innerhalb der Liste (kleiner = weiter
   * oben). Neue Aufgaben bekommen die kleinste Position − 1 und landen damit
   * **oben**; die Werte werden dabei negativ, was gleichbedeutend ist.
   * Beim Umsortieren zählt die Oberfläche wieder von 1 an durch.
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

export interface TaskReopenContext {
  list_id: string
  section_id: string | null
  previous_id: string | null
  next_id: string | null
  successor: Omit<LocalTask, 'dirty' | 'reopen_context'> | null
}

/** Persönliche, synchronisierte Auswahl für eine einzelne Liste. */
export interface LocalListPreference extends SyncableRow, LocalOnly {
  list_id: string
  user_id: string
  include_in_overview: boolean
  created_at: IsoDateTime
}
export type RemoteListPreference = Omit<LocalListPreference, 'dirty'>

export type OverviewMode = 'by_list' | 'newest'

/** Persönliche Startansicht; die Standardliste wird ausdrücklich gesetzt. */
export interface LocalUserPreference extends SyncableRow, LocalOnly {
  id: string
  default_list_id: string | null
  overview_mode: OverviewMode
  created_at: IsoDateTime
}
export type RemoteUserPreference = Omit<LocalUserPreference, 'dirty'>

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
/**
 * Eine tatsächlich beim Betriebssystem geplante Benachrichtigung.
 *
 * Reine Buchhaltung des Geräts – nicht synchronisiert. Eine Aufgabe kann
 * mehrere Zeilen haben; zusammengehalten wird eine Zeile über **Aufgabe und
 * Zeitpunkt**. Damit bringt das Löschen einer Erinnerung die Nummern der
 * übrigen nicht durcheinander.
 */
export interface LocalReminder {
  taskId: string
  notificationId: number
  /** Zeitpunkt, für den die Erinnerung geplant ist (ISO, UTC). */
  at: IsoDateTime
}

/** Zeile ohne `dirty` – die Form, die in Supabase liegt. */
/**
 * Eine Listenzeile, wie sie vom Server kommt.
 *
 * `sections` steht hier ausdrücklich optional: Die Spalte gibt es erst seit
 * Migration 0013. Eine ältere Datenbank schickt sie nicht, und ein Feld, das
 * angeblich immer da ist, würde beim Lesen zu einer Lüge – genau dafür steht
 * `parseSections` bereit.
 */
export type RemoteList = Omit<LocalList, 'dirty' | 'sections' | 'keep_completed' | 'completion_retention_started_at'> & {
  sections?: ListSection[] | null
  keep_completed?: boolean
  completion_retention_started_at?: IsoDateTime | null
}

/** Eine Aufgabenzeile vom Server; `section_id` fehlt vor Migration 0013. */
export type RemoteTask = Omit<LocalTask, 'dirty' | 'section_id' | 'completed_expires_at' | 'expired_at' | 'reopen_context'> & {
  section_id?: string | null
  completed_expires_at?: IsoDateTime | null
  expired_at?: IsoDateTime | null
  reopen_context?: TaskReopenContext | null
}
export type RemoteListMember = Omit<LocalListMember, 'dirty'>

export type RemoteTable = 'lists' | 'list_members' | 'tasks' | 'list_preferences' | 'user_preferences'

export interface RemoteSnapshot {
  lists: RemoteList[]
  members: RemoteListMember[]
  tasks: RemoteTask[]
  /** Fehlt bei älteren Transporten; keine Auswahl bedeutet keine Aufnahme. */
  preferences?: RemoteListPreference[]
  userPreferences?: RemoteUserPreference[]
}

export interface PushPayload {
  lists: RemoteList[]
  members: RemoteListMember[]
  tasks: RemoteTask[]
  preferences?: RemoteListPreference[]
  userPreferences?: RemoteUserPreference[]
}
