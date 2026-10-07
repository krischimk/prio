import { timeOf } from '../../domain/clock'
import { isRecurrence, nextOccurrence, successorId } from '../../domain/recurrence'
import { alignReminders } from '../../domain/reminder'
import { newId } from '../../domain/ids'
import { normalisiereAufgabe } from '../../domain/normalize'
import { compareRestorable, compareTasks, restoreCutoff } from '../../domain/ordering'
import type { LocalTask } from '../../domain/types'
import { optionalText, requireText } from '../validation'
import type { Kontext } from './context'
import type { Repositories } from './types'

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
async function wiederOeffnen(ctx: Kontext, task: LocalTask, now: string): Promise<LocalTask> {
  const nachfolgerId = task.successor_id
  const geoeffnet: LocalTask = {
    ...task,
    completed: false,
    completed_at: null,
    successor_id: null,
    ...ctx.stamp(),
  }

  await ctx.db.transaction('rw', ctx.db.tasks, async () => {
    if (nachfolgerId) {
      const nachfolger = await ctx.db.tasks.get(nachfolgerId)
      if (nachfolger && !nachfolger.completed && nachfolger.deleted_at === null) {
        await ctx.db.tasks.put({ ...nachfolger, deleted_at: now, ...ctx.stamp() })
      }
    }
    await ctx.db.tasks.put(geoeffnet)
  })

  return geoeffnet
}

export function aufgaben(ctx: Kontext): Pick<Repositories, 'createTask' | 'updateTask' | 'setTaskCompleted' | 'moveTask' | 'reorderTasks' | 'deleteTask' | 'getTask' | 'listTasks' | 'listRestorableTasks'> {
  return {

    async createTask(input) {
      await ctx.requireList(input.listId)
      const now = ctx.clock.now()
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
      const vorhandene = await ctx.db.tasks.where('list_id').equals(input.listId).toArray()
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
      await ctx.db.tasks.add(task)
      return task
    },

    async updateTask(taskId, patch) {
      const task = await ctx.requireTask(taskId)
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
          Date.parse(ctx.clock.now()),
        ),
        ...ctx.stamp(),
      }
      await ctx.db.tasks.put(updated)
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
      const task = await ctx.requireTask(taskId)
      const now = ctx.clock.now()

      if (!completed) {
        return wiederOeffnen(ctx, task, now)
      }

      const erledigt: LocalTask = {
        ...task,
        completed: true,
        completed_at: now,
        ...ctx.stamp(),
      }

      // Ohne Fälligkeit gibt es nichts fortzuschreiben.
      if (!isRecurrence(task.recurrence) || task.due_at === null) {
        await ctx.db.tasks.put(erledigt)
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

      await ctx.db.transaction('rw', ctx.db.tasks, async () => {
        const vorhanden = await ctx.db.tasks.get(nachfolgerId)
        if (!vorhanden) {
          await ctx.db.tasks.put(nachfolger)
        } else if (vorhanden.deleted_at !== null) {
          // Nach einem Rückgängig war er weich gelöscht – jetzt wieder beleben,
          // aber den ursprünglichen Anlegezeitpunkt behalten.
          await ctx.db.tasks.put({ ...nachfolger, created_at: vorhanden.created_at })
        }
        // Ist er offen und vorhanden, bleibt er unangetastet: Vielleicht wurde
        // er inzwischen bearbeitet.
        await ctx.db.tasks.put(erledigt)
      })
      return erledigt
    },

    /**
     * Verschieben ist ein normales Update: `list_id` gehört zur Zeile und wird
     * damit beim nächsten Sync mit übertragen. Der Server prüft über die
     * RLS-Policies, dass die Ziel-Liste überhaupt zugänglich ist.
     */
    async moveTask(taskId, targetListId) {
      const task = await ctx.requireTask(taskId)
      if (task.list_id === targetListId) return task
      await ctx.requireList(targetListId)
      const updated: LocalTask = { ...task, list_id: targetListId, ...ctx.stamp() }
      await ctx.db.tasks.put(updated)
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
      await ctx.requireList(listId)
      const tasks = await ctx.db.tasks.where('list_id').equals(listId).toArray()
      const byId = new Map(tasks.filter((task) => task.deleted_at === null).map((task) => [task.id, task]))

      const { updated_at } = ctx.stamp()
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
        await ctx.db.tasks.bulkPut(geaendert)
      }
    },

    async deleteTask(taskId) {
      const task = await ctx.requireTask(taskId)
      const { updated_at } = ctx.stamp()
      await ctx.db.tasks.put({ ...task, deleted_at: updated_at, updated_at, dirty: 1 })
    },

    async getTask(taskId) {
      const task = await ctx.db.tasks.get(taskId)
      return task && task.deleted_at === null ? normalisiereAufgabe(task) : undefined
    },

    async listTasks(listId) {
      const tasks = await ctx.db.tasks.where('list_id').equals(listId).toArray()
      // Abgehakte Aufgaben verschwinden aus der Liste; sie sind über die
      // Einstellungen noch eine Weile zu finden.
      return tasks
        .filter((task) => task.deleted_at === null && !task.completed)
        .map(normalisiereAufgabe)
        .sort(compareTasks)
    },

    async listRestorableTasks() {
      const grenze = restoreCutoff(timeOf(ctx.clock.now()))

      // Über den Index `completed_at`: Die Datenbank liefert nur die Aufgaben
      // seit der Grenze. Vorher las ein `toArray()` **alle** Aufgaben und
      // filterte danach in JavaScript.
      const tasks = await ctx.db.tasks.where('completed_at').aboveOrEqual(grenze).toArray()
      return tasks
        .filter((task) => task.deleted_at === null && task.completed)
        .map(normalisiereAufgabe)
        // Zuletzt abgehakt zuerst. Die Zeitstempel liegen alle im selben
        // ISO-Format vor, der Vergleich ist deshalb stabil.
        .sort(compareRestorable)
    },
  }
}
