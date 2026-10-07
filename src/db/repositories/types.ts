/**
 * Die Datenbankschnittstelle und ihre Eingaben.
 *
 * Aus `repositories.ts` herausgelöst, damit die Bereichsdateien nur das
 * importieren, was sie beschreiben.
 */
import type { TaskReminder } from '../../domain/reminder'
import type { LocalList, LocalListMember, LocalTask, ShareContact } from '../../domain/types'

export interface CreateTaskInput {
  listId: string
  /** Der Abschnitt der neuen Aufgabe; `null` oder weggelassen heißt „ohne". */
  sectionId?: string | null
  title: string
  description?: string | null
  dueAt?: string | null
  recurrence?: string | null
  /** Die Erinnerungen der Aufgabe. Fehlt das Feld, bleibt die bisherige Liste. */
  reminders?: TaskReminder[]
}

export interface UpdateTaskInput {
  title?: string
  /** Der Abschnitt der Aufgabe; `null` heißt „ohne Bereich". */
  sectionId?: string | null
  description?: string | null
  dueAt?: string | null
  recurrence?: string | null
  reminders?: TaskReminder[]
}

export interface Repositories {
  // Listen
  createList(name: string, ownerId: string): Promise<LocalList>
  renameList(listId: string, name: string): Promise<LocalList>
  /**
   * Setzt das Symbol der Liste.
   *
   * `null` entfernt es. Die Kennung wird nicht geprüft – eine unbekannte
   * Kennung zeigt die Oberfläche einfach als „kein Symbol“ an.
   */
  setListIcon(listId: string, icon: string | null): Promise<LocalList>
  deleteList(listId: string): Promise<void>
  getList(listId: string): Promise<LocalList | undefined>
  listLists(): Promise<LocalList[]>

  // Abschnitte einer Liste
  /**
   * Legt einen Abschnitt an und gibt seine Kennung zurück.
   *
   * `null`, wenn der Name leer ist oder die Liste schon `SECTIONS_MAX`
   * Abschnitte hat – die Oberfläche sagt das dann.
   */
  addListSection(listId: string, name: string): Promise<string | null>
  renameListSection(listId: string, sectionId: string, name: string): Promise<void>
  /**
   * Entfernt einen Abschnitt. Seine Aufgaben bleiben und fallen nach
   * „ohne Bereich" – die Verweise werden dabei aufgeräumt.
   */
  deleteListSection(listId: string, sectionId: string): Promise<void>

  // Aufgaben
  createTask(input: CreateTaskInput): Promise<LocalTask>
  updateTask(taskId: string, patch: UpdateTaskInput): Promise<LocalTask>
  setTaskCompleted(taskId: string, completed: boolean): Promise<LocalTask>
  /** Verschiebt eine Aufgabe in eine andere Liste (beide müssen zugänglich sein). */
  moveTask(taskId: string, targetListId: string): Promise<LocalTask>
  /**
   * Setzt die Reihenfolge innerhalb einer Liste neu.
   * `orderedTaskIds` enthält alle Aufgaben der Liste in der gewünschten
   * Reihenfolge von oben nach unten.
   */
  reorderTasks(
    listId: string,
    orderedTaskIds: string[],
    sectionOf?: Record<string, string | null>,
  ): Promise<void>
  deleteTask(taskId: string): Promise<void>
  getTask(taskId: string): Promise<LocalTask | undefined>
  /** Offene Aufgaben einer Liste, in der vom Benutzer bestimmten Reihenfolge. */
  listTasks(listId: string): Promise<LocalTask[]>
  /**
   * Abgehakte Aufgaben aller Listen, die noch wiederhergestellt werden können –
   * zuletzt abgehakte zuerst.
   *
   * Eine Regel für alle: `RESTORE_WINDOW_DAYS` Tage ab `completed_at`.
   * Wiederkehrende Aufgaben sind nicht ausgenommen – die abgehakte Fassung
   * bleibt auffindbar, während der Nachfolger offen in der Liste steht.
   */
  listRestorableTasks(): Promise<LocalTask[]>

  /**
   * Die selbst gemerkten Vorlaufzeiten für die Schnellauswahl, in der
   * Reihenfolge des Hinzufügens.
   *
   * Eine Eingabehilfe, keine Angabe über eine Aufgabe – deshalb liegt sie in
   * `meta` und wird nicht synchronisiert.
   */
  listReminderPresets(): Promise<number[]>
  setReminderPresets(minutes: number[]): Promise<void>

  /**
   * Die Adressen, mit denen schon einmal eine Liste geteilt wurde – zuletzt
   * verwendete zuerst.
   *
   * Wie die Vorlaufzeiten eine Eingabehilfe, deshalb in `meta` und ohne
   * Synchronisation. Gefüllt wird sie nur aus dem, was der Benutzer selbst
   * eingetragen hat.
   */
  listShareContacts(): Promise<ShareContact[]>
  /**
   * Merkt eine Adresse nach erfolgreichem Teilen.
   *
   * `userId` kommt aus der Antwort des Servers – nur dieses Paar wird gemerkt,
   * es wird nichts nachgeschlagen.
   */
  rememberShareContact(email: string, userId: string): Promise<void>
  /**
   * Ergänzt Adressen aus dem Serverbestand: Personen, mit denen eine
   * gemeinsame Liste besteht.
   *
   * Der Server gibt nur diesen Kreis heraus. Geschrieben wird nur, wenn sich
   * wirklich etwas ändert – der Abgleich läuft oft und soll die Oberfläche
   * nicht ohne Anlass neu zeichnen.
   */
  mergeShareContacts(
    contacts: ReadonlyArray<{ userId: string; email: string }>,
    at: string,
  ): Promise<void>

  // Mitgliedschaften
  listMembers(listId: string): Promise<LocalListMember[]>
  markListShared(listId: string): Promise<void>
  removeMember(listId: string, userId: string): Promise<void>
  /**
   * Eine geteilte Liste selbst verlassen.
   *
   * Setzt – wie das Entfernen durch den Besitzer – `deleted_at` auf die eigene
   * Mitgliedschaft. Der nächste Abgleich räumt die fremde Liste samt Aufgaben
   * lokal weg (siehe `applyRemoteMembers`).
   *
   * Server-seitig erlaubt das die Richtlinie `list_members_leave_self`.
   */
  leaveList(listId: string, userId: string): Promise<void>
}
