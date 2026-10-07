import { systemClock, timeOf, type Clock } from '../domain/clock'
import { isRecurrence, nextOccurrence, successorId } from '../domain/recurrence'
import {
  parseSections,
  withNewSection,
  withRenamedSection,
  withoutSection,
} from '../domain/sections'
import { alignReminders, isPlausibleOffset, type TaskReminder } from '../domain/reminder'
import { newId } from '../domain/ids'
import {
  normalisiereAufgabe,
  normalisiereListe,
  normalisiereMitglied,
} from '../domain/normalize'
import {
  compareListsByName,
  compareMembersById,
  compareRestorable,
  compareTasks,
  restoreCutoff,
} from '../domain/ordering'
import type { LocalList, LocalListMember, LocalTask, ShareContact } from '../domain/types'
import type { LocalDatabase } from './localDb'
import { optionalText, requireText, ValidationError } from './validation'
import { readMeta, writeMeta } from './metaStore'
import {
  normalizeShareEmail,
  parseShareContacts,
  withCoMemberContacts,
  withShareContact,
} from '../domain/shareContacts'

/**
 * Geschäftslogik für Listen, Aufgaben und Mitgliedschaften.
 *
 * Grundregel: Jede schreibende Operation
 *   1. vergibt einen neuen `updated_at`-Zeitstempel,
 *   2. setzt `dirty = 1` und
 *   3. wartet NICHT auf den Server.
 *
 * Löschen ist immer ein Soft Delete (`deleted_at`), damit die Löschung später
 * synchronisiert werden kann. Es wird nie eine Zeile lokal entfernt, solange
 * sie noch nicht auf dem Server angekommen ist.
 */

/**
 * Wie lange eine abgehakte Aufgabe unter „Aufgaben wiederherstellen“ auftaucht.
 *
 * Bewusste Entscheidung: Die Aufgabe verschwindet nach dem Abhaken sofort aus
 * der Liste, bleibt aber eine Woche lang auffindbar. Danach ist sie nur noch
 * über die Synchronisation erreichbar (sie ist nicht gelöscht, nur verborgen).
 */
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

/**
 * Sortierung der Aufgabenliste.
 *
 * Zuerst die vom Benutzer bestimmte Reihenfolge (`position`). Nur bei
 * Gleichstand – also bei Datensätzen aus der Zeit vor dieser Funktion –
 * greifen die früheren Regeln.
 *
 * Bewusste Entscheidung: Eine erledigte Aufgabe bleibt an ihrem Platz, statt
 * ans Ende zu rutschen. Sonst springt die Zeile beim Abhaken unter dem Finger
 * weg.
 */
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

export function createRepositories(db: LocalDatabase, clock: Clock = systemClock): Repositories {
  /** Baut die Felder, die bei jeder lokalen Änderung gesetzt werden. */
  /**
   * Ergänzt den Abschnittsplan, wenn er fehlt.
   *
   * Zeilen aus einer Fassung vor Migration 0013 haben das Feld nicht, und Dexie
   * füllt es nicht nach. Ohne diese Ergänzung stürzt die Ansicht beim Gruppieren
   * ab – genau das war der schwarze Bildschirm nach dem Update auf 0.18.0.
   * Geschrieben wird dabei nichts: Der Wert entsteht beim nächsten echten
   * Schreiben von selbst.
   */
  /**
   * Der Leserand für Listen.
   *
   * Heißt weiterhin so, weil die Abschnitte das Feld waren, das ihn nötig
   * machte – jetzt läuft die ganze Zeile durch `normalisiereListe`.
   */
  function mitAbschnittsplan(list: LocalList): LocalList {
    return normalisiereListe(list)
  }

  function stamp(): { updated_at: string; dirty: 1 } {
    return { updated_at: clock.now(), dirty: 1 }
  }
/**
 * Öffnet eine abgehakte Aufgabe wieder.
 *
 * Hat sie einen Nachfolger, wird der **zurückgenommen** – sonst stünde die
 * Aufgabe doppelt in der Liste: einmal offen, einmal als Nachfolger. Der
 * Nachfolger wird weich gelöscht, weil er bereits hochgeladen sein kann.
 *
 * Ein bereits erledigter Nachfolger bleibt unangetastet: Wer ihn schon abgehakt
 * hat, will ihn nicht durch ein Rückgängig der Vorgängerin verlieren.
 */
async function wiederOeffnen(db: LocalDatabase, task: LocalTask, now: string): Promise<LocalTask> {
  const nachfolgerId = task.successor_id
  const geoeffnet: LocalTask = {
    ...task,
    completed: false,
    completed_at: null,
    successor_id: null,
    ...stamp(),
  }

  await db.transaction('rw', db.tasks, async () => {
    if (nachfolgerId) {
      const nachfolger = await db.tasks.get(nachfolgerId)
      if (nachfolger && !nachfolger.completed && nachfolger.deleted_at === null) {
        await db.tasks.put({ ...nachfolger, deleted_at: now, ...stamp() })
      }
    }
    await db.tasks.put(geoeffnet)
  })

  return geoeffnet
}


  async function requireList(listId: string): Promise<LocalList> {
    const list = await db.lists.get(listId)
    if (!list || list.deleted_at !== null) {
      throw new ValidationError('not-found', 'Diese Liste existiert nicht mehr.')
    }
    return list
  }

  async function requireTask(taskId: string): Promise<LocalTask> {
    const task = await db.tasks.get(taskId)
    if (!task || task.deleted_at !== null) {
      throw new ValidationError('not-found', 'Diese Aufgabe existiert nicht mehr.')
    }
    return task
  }

  return {
    async createList(name, ownerId) {
      const now = clock.now()
      const list: LocalList = {
        // Noch keine Abschnitte – der Plan ist von Anfang an da, nicht erst
        // nach dem ersten Anlegen.
        sections: [],
        id: newId(),
        name: requireText(name, 'Der Listenname'),
        owner_id: ownerId,
        is_shared: false,
        icon: null,
        created_at: now,
        updated_at: now,
        deleted_at: null,
        dirty: 1,
      }
      await db.lists.add(list)
      return list
    },

    async setListIcon(listId, icon) {
      const list = await requireList(listId)
      const updated: LocalList = { ...list, icon, ...stamp() }
      await db.lists.put(updated)
      return updated
    },

    async renameList(listId, name) {
      const list = await requireList(listId)
      const updated: LocalList = { ...list, name: requireText(name, 'Der Listenname'), ...stamp() }
      await db.lists.put(updated)
      return updated
    },

    /**
     * Soft Delete inklusive Kaskade auf die Aufgaben der Liste.
     *
     * Ohne Kaskade blieben Aufgaben als unsichtbare Waisen zurück, die bei
     * jedem Sync mit hochgeladen würden. Verweise auf Mitgliedschaften werden
     * nicht angefasst: Ohne die Liste sind sie über die Server-Policies
     * ohnehin nicht mehr erreichbar.
     */
    async addListSection(listId, name) {
      const list = await requireList(listId)
      const neu = withNewSection(parseSections(list.sections), name)
      if (neu === null) return null
      await db.lists.put({ ...list, sections: neu.sections, ...stamp() })
      return neu.id
    },

    async renameListSection(listId, sectionId, name) {
      const list = await requireList(listId)
      const sections = withRenamedSection(parseSections(list.sections), sectionId, name)
      if (sections === parseSections(list.sections)) return
      await db.lists.put({ ...list, sections, ...stamp() })
    },

    async deleteListSection(listId, sectionId) {
      const list = await requireList(listId)
      const sections = withoutSection(parseSections(list.sections), sectionId)
      const { updated_at } = stamp()

      // Zwei Schreibungen, ein Vorgang: Der Abschnitt verschwindet aus dem Plan,
      // und seine Aufgaben fallen nach „ohne Bereich". Bliebe der Verweis
      // stehen, zeigte er ins Leere – angezeigt würde die Aufgabe wie „ohne
      // Bereich", aber die Daten wären irreführend.
      await db.transaction('rw', db.lists, db.tasks, async () => {
        await db.lists.put({ ...list, sections, updated_at, dirty: 1 })

        const aufgaben = await db.tasks.where('list_id').equals(listId).toArray()
        const betroffen: LocalTask[] = aufgaben
          .filter((task) => task.deleted_at === null && task.section_id === sectionId)
          .map((task) => ({ ...task, section_id: null, updated_at, dirty: 1 }))
        if (betroffen.length > 0) {
          await db.tasks.bulkPut(betroffen)
        }
      })
    },

    async deleteList(listId) {
      const list = await requireList(listId)
      await db.transaction('rw', db.lists, db.tasks, async () => {
        const { updated_at } = stamp()
        await db.lists.put({ ...list, deleted_at: updated_at, updated_at, dirty: 1 })
        const tasks = await db.tasks.where('list_id').equals(listId).toArray()
        const open = tasks.filter((task) => task.deleted_at === null)
        if (open.length > 0) {
          await db.tasks.bulkPut(
            open.map((task) => ({ ...task, deleted_at: updated_at, updated_at, dirty: 1 })),
          )
        }
      })
    },

    async getList(listId) {
      const list = await db.lists.get(listId)
      return list && list.deleted_at === null ? mitAbschnittsplan(list) : undefined
    },

    async listLists() {
      const lists = await db.lists.toArray()
      return lists
        .filter((list) => list.deleted_at === null)
        .map(mitAbschnittsplan)
        .sort(compareListsByName)
    },

    async createTask(input) {
      await requireList(input.listId)
      const now = clock.now()
      // Neue Aufgaben landen oben: Position = kleinste vorhandene − 1.
      //
      // Die Positionen dürfen dabei negativ werden. Das Hochzählen aller
      // vorhandenen Zeilen wäre die Alternative – sie würde bei jeder neuen
      // Aufgabe jede Zeile als geändert markieren und damit den halben Bestand
      // hochladen.
      //
      // `Number.isFinite` ist hier entscheidend: Aufgaben aus der Zeit vor der
      // Reihenfolge-Funktion haben kein `position`. `Math.min(Infinity, undefined)`
      // ergäbe `NaN`, und `NaN` wird beim Senden zu `null` – die Spalte ist aber
      // `not null`. Genau daran scheiterte der Sync schon einmal.
      const vorhandene = await db.tasks.where('list_id').equals(input.listId).toArray()
      const positionen = vorhandene
        .filter((task) => task.deleted_at === null && Number.isFinite(task.position))
        .map((task) => task.position)
      // Ohne Bestand beginnt es bei 0 (die erste Aufgabe), sonst bei 0 als
      // Obergrenze: Aufgaben aus der Zeit vor der Reihenfolge-Funktion stehen
      // auf 0 und müssen von der neuen Aufgabe überholt werden.
      const startwert = vorhandene.length === 0 ? 1 : 0
      const kleinste = Math.min(startwert, ...positionen)
      const task: LocalTask = {
        id: newId(),
        list_id: input.listId,
        section_id: input.sectionId ?? null,
        title: requireText(input.title, 'Der Titel'),
        description: optionalText(input.description),
        // `undefined` heißt „nicht mitgeschickt" – siehe `ReminderTarget`.
        ...alignReminders(
          null,
          {
            due_at: optionalText(input.dueAt),
            recurrence: input.recurrence ?? null,
            reminders: input.reminders,
          },
          Date.parse(now),
        ),
        completed: false,
        completed_at: null,
        successor_id: null,
        position: kleinste - 1,
        created_at: now,
        updated_at: now,
        deleted_at: null,
        dirty: 1,
      }
      await db.tasks.add(task)
      return task
    },

    async updateTask(taskId, patch) {
      const task = await requireTask(taskId)
      const updated: LocalTask = {
        ...task,
        title: patch.title === undefined ? task.title : requireText(patch.title, 'Der Titel'),
        description:
          patch.description === undefined ? task.description : optionalText(patch.description),
        section_id: patch.sectionId === undefined ? task.section_id : patch.sectionId,
        // Fälligkeit, Wiederholung und Erinnerung hängen zusammen und werden
        // deshalb gemeinsam ausgerichtet – siehe `alignReminder`.
        ...alignReminders(
          task,
          {
            due_at: patch.dueAt === undefined ? task.due_at : optionalText(patch.dueAt),
            recurrence: patch.recurrence === undefined ? task.recurrence : patch.recurrence,
            // Bewusst nicht auf den gespeicherten Wert zurückgefallen: Nur so
            // kann `alignReminders` „nicht mitgeschickt" von „keine Erinnerung"
            // unterscheiden und die Liste beim Formwechsel umrechnen.
            reminders: patch.reminders,
          },
          Date.parse(clock.now()),
        ),
        ...stamp(),
      }
      await db.tasks.put(updated)
      return updated
    },

    /**
     * Abhaken setzt den Zeitpunkt, Wiederöffnen löscht ihn wieder. Nur so weiß
     * die Wiederherstellen-Liste, wie lange eine Aufgabe noch dorthin gehört.
     *
     * Bei einer **wiederkehrenden** Aufgabe entsteht dabei der Nachfolger mit
     * dem nächsten Termin. Beides geschieht in einer Transaktion – eine
     * abgehakte Aufgabe ohne Nachfolger wäre sonst möglich, und die Aufgabe
     * wäre für immer verschwunden.
     */
    async setTaskCompleted(taskId, completed) {
      const task = await requireTask(taskId)
      const now = clock.now()

      if (!completed) {
        return wiederOeffnen(db, task, now)
      }

      const erledigt: LocalTask = {
        ...task,
        completed: true,
        completed_at: now,
        ...stamp(),
      }

      // Ohne Fälligkeit gibt es nichts fortzuschreiben.
      if (!isRecurrence(task.recurrence) || task.due_at === null) {
        await db.tasks.put(erledigt)
        return erledigt
      }

      const naechsterTermin = nextOccurrence(task.due_at, task.recurrence, now)
      // Berechnete Kennung: Auf zwei Geräten entsteht dieselbe, und der Abgleich
      // verschmilzt sie, statt zwei Nachfolger entstehen zu lassen.
      const nachfolgerId = await successorId(task.id, naechsterTermin)

      const nachfolger: LocalTask = {
        ...task,
        id: nachfolgerId,
        due_at: naechsterTermin,
        completed: false,
        completed_at: null,
        successor_id: null,
        created_at: now,
        updated_at: now,
        deleted_at: null,
        dirty: 1,
      }

      erledigt.successor_id = nachfolgerId

      await db.transaction('rw', db.tasks, async () => {
        const vorhanden = await db.tasks.get(nachfolgerId)
        if (!vorhanden) {
          await db.tasks.put(nachfolger)
        } else if (vorhanden.deleted_at !== null) {
          // Nach einem Rückgängig war er weich gelöscht – jetzt wieder beleben,
          // aber den ursprünglichen Anlegezeitpunkt behalten.
          await db.tasks.put({ ...nachfolger, created_at: vorhanden.created_at })
        }
        // Ist er offen und vorhanden, bleibt er unangetastet: Vielleicht wurde
        // er inzwischen bearbeitet.
        await db.tasks.put(erledigt)
      })
      return erledigt
    },

    /**
     * Verschieben ist ein normales Update: `list_id` gehört zur Zeile und wird
     * damit beim nächsten Sync mit übertragen. Der Server prüft über die
     * RLS-Policies, dass die Ziel-Liste überhaupt zugänglich ist.
     */
    async moveTask(taskId, targetListId) {
      const task = await requireTask(taskId)
      if (task.list_id === targetListId) return task
      await requireList(targetListId)
      const updated: LocalTask = { ...task, list_id: targetListId, ...stamp() }
      await db.tasks.put(updated)
      return updated
    },

    /**
     * Reihenfolge neu setzen.
     *
     * Es werden nur die Aufgaben geschrieben, deren Position sich tatsächlich
     * ändert – die übrigen bleiben unberührt und werden folglich auch nicht
     * erneut hochgeladen. Die Positionen laufen danach lückenlos von 1 bis n;
     * damit kann keine Genauigkeit verloren gehen.
     */
    async reorderTasks(listId, orderedTaskIds, sectionOf = {}) {
      await requireList(listId)
      const tasks = await db.tasks.where('list_id').equals(listId).toArray()
      const byId = new Map(tasks.filter((task) => task.deleted_at === null).map((task) => [task.id, task]))

      const { updated_at } = stamp()
      const geaendert: LocalTask[] = []
      orderedTaskIds.forEach((taskId, index) => {
        const task = byId.get(taskId)
        if (!task) return
        const position = index + 1
        // Der Zielabschnitt kommt beim Ziehen mit: Eine Aufgabe wechselt dabei
        // unter Umständen den Bereich, und beides gehört in dieselbe Schreibung.
        const section_id = Object.prototype.hasOwnProperty.call(sectionOf, taskId)
          ? sectionOf[taskId]
          : task.section_id
        if (task.position === position && task.section_id === section_id) return
        geaendert.push({ ...task, position, section_id, updated_at, dirty: 1 })
      })

      if (geaendert.length > 0) {
        await db.tasks.bulkPut(geaendert)
      }
    },

    async deleteTask(taskId) {
      const task = await requireTask(taskId)
      const { updated_at } = stamp()
      await db.tasks.put({ ...task, deleted_at: updated_at, updated_at, dirty: 1 })
    },

    async getTask(taskId) {
      const task = await db.tasks.get(taskId)
      return task && task.deleted_at === null ? normalisiereAufgabe(task) : undefined
    },

    async listTasks(listId) {
      const tasks = await db.tasks.where('list_id').equals(listId).toArray()
      // Abgehakte Aufgaben verschwinden aus der Liste; sie sind über die
      // Einstellungen noch eine Weile zu finden.
      return tasks
        .filter((task) => task.deleted_at === null && !task.completed)
        .map(normalisiereAufgabe)
        .sort(compareTasks)
    },

    async listRestorableTasks() {
      const grenze = restoreCutoff(timeOf(clock.now()))

      // Über den Index `completed_at`: Die Datenbank liefert nur die Aufgaben
      // seit der Grenze. Vorher las ein `toArray()` **alle** Aufgaben und
      // filterte danach in JavaScript.
      const tasks = await db.tasks.where('completed_at').aboveOrEqual(grenze).toArray()
      return tasks
        .filter((task) => task.deleted_at === null && task.completed)
        .map(normalisiereAufgabe)
        // Zuletzt abgehakt zuerst. Die Zeitstempel liegen alle im selben
        // ISO-Format vor, der Vergleich ist deshalb stabil.
        .sort(compareRestorable)
    },

    async listReminderPresets() {
      const roh = await readMeta(db, META_REMINDER_PRESETS)
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
      await writeMeta(db, META_REMINDER_PRESETS, JSON.stringify(sauber))
    },

    async listShareContacts() {
      return parseShareContacts(await readMeta(db, META_SHARE_CONTACTS))
    },

    async rememberShareContact(email, userId) {
      const adresse = normalizeShareEmail(email)
      if (adresse.length === 0 || userId.length === 0) return
      const bisher = parseShareContacts(await readMeta(db, META_SHARE_CONTACTS))
      const { updated_at } = stamp()
      const neu = withShareContact(bisher, adresse, userId, updated_at)
      await writeMeta(db, META_SHARE_CONTACTS, JSON.stringify(neu))
    },

    async mergeShareContacts(contacts, at) {
      if (contacts.length === 0) return
      const bisher = parseShareContacts(await readMeta(db, META_SHARE_CONTACTS))
      const neu = withCoMemberContacts(bisher, contacts, at)
      if (JSON.stringify(neu) === JSON.stringify(bisher)) return
      await writeMeta(db, META_SHARE_CONTACTS, JSON.stringify(neu))
    },

    async listMembers(listId) {
      const members = await db.list_members.where('list_id').equals(listId).toArray()
      return members
        .filter((member) => member.deleted_at === null)
        .map(normalisiereMitglied)
        .sort(compareMembersById)
    },

    async markListShared(listId) {
      const list = await requireList(listId)
      if (list.is_shared) return
      await db.lists.put({ ...list, is_shared: true, ...stamp() })
    },

    /**
     * Entfernt ein Mitglied lokal und markiert die Zeile als schmutzig.
     *
     * Das funktioniert auch offline, weil der Besitzer die Mitgliedszeile
     * bereits heruntergeladen hat. Der Server lehnt die Änderung ab, wenn der
     * Aufrufer nicht Besitzer der Liste ist (RLS).
     */
    async leaveList(listId, userId) {
      const existing = await db.list_members.get([listId, userId])
      if (!existing) {
        throw new ValidationError('empty', 'Diese Mitgliedschaft ist lokal nicht bekannt.')
      }
      if (existing.deleted_at !== null) return

      const { updated_at } = stamp()
      const updated: LocalListMember = {
        ...existing,
        deleted_at: updated_at,
        updated_at,
        dirty: 1,
      }
      await db.list_members.put(updated)
    },

    async removeMember(listId, userId) {
      const existing = await db.list_members.get([listId, userId])
      if (!existing) {
        throw new ValidationError('empty', 'Dieses Mitglied ist lokal nicht bekannt.')
      }
      const { updated_at } = stamp()
      const updated: LocalListMember = {
        ...existing,
        deleted_at: updated_at,
        updated_at,
        dirty: 1,
      }
      await db.list_members.put(updated)
    },
  }
}
