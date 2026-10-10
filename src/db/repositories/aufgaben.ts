import Dexie from 'dexie'
import { timeOf } from '../../domain/clock'
import { applyTaskEdit, taskEditValues } from '../../domain/taskEdit'
import { sameData } from '../../domain/equality'
import { isRecurrence, nextOccurrence, successorId } from '../../domain/recurrence'
import { alignReminders } from '../../domain/reminder'
import { newId } from '../../domain/ids'
import { normalisiereAufgabe } from '../../domain/normalize'
import { parseSections } from '../../domain/sections'
import { compareRestorable, compareTasks, restoreCutoff } from '../../domain/ordering'
import { captureReopenContext, completionDeadline, completionExpired, reopenPlacement, successorSnapshot } from '../../domain/taskLifecycle'
import type { LocalTask } from '../../domain/types'
import { optionalText, requireText, ValidationError } from '../validation'
import type { Kontext } from './context'
import type { Repositories } from './types'

/**
 * Öffnet eine abgehakte Aufgabe wieder.
 *
 * Ein nachweislich unveränderter, noch offener Nachfolger wird weich
 * zurückgenommen. Bearbeitete, verschobene und bereits erledigte Nachfolger
 * bleiben erhalten. Ohne gesicherten Ausgangsstand ist unverändert nicht
 * nachweisbar; alte Abschlüsse nehmen deshalb keinen Nachfolger blind zurück.
 */
async function wiederOeffnen(ctx: Kontext, task: LocalTask, now: string): Promise<LocalTask> {
  const nachfolgerId = task.successor_id
  const geoeffnet: LocalTask = {
    ...task,
    completed: false,
    completed_at: null,
    completed_expires_at: null,
    reopen_context: null,
    successor_id: null,
    ...ctx.stamp(),
  }

  // Der Aufrufer hat Lesen und Wiederöffnen bereits in einer Transaktion.
  if (nachfolgerId) {
    const row = await ctx.db.tasks.get(nachfolgerId)
    const nachfolger = row ? normalisiereAufgabe(row) : undefined
    const original = task.reopen_context?.successor
    if (nachfolger && original && !nachfolger.completed && nachfolger.deleted_at === null && sameData(successorSnapshot(nachfolger), original)) {
      await ctx.db.tasks.put({ ...nachfolger, deleted_at: now, ...ctx.stamp() })
    }
  }
  const list = await ctx.requireList(task.list_id)
  const placement = reopenPlacement(task, list, (await ctx.db.tasks.where('list_id').equals(list.id).toArray()).map(normalisiereAufgabe))
  geoeffnet.section_id = placement.sectionId
  const previous = placement.peers[placement.index - 1]?.position
  const next = placement.peers[placement.index]?.position
  const position = previous !== undefined && next !== undefined ? previous + (next - previous) / 2 : previous !== undefined ? previous + 1 : next !== undefined ? next - 1 : 0
  if (Number.isFinite(position) && (previous === undefined || position > previous) && (next === undefined || position < next)) {
    geoeffnet.position = position
  } else {
    // Nur wenn kein darstellbarer Zwischenwert bleibt: in dieser Gruppe
    // neu nummerieren. Keine pauschale Neuordnung der gesamten Liste.
    const ordered = [...placement.peers]
    ordered.splice(placement.index, 0, geoeffnet)
    geoeffnet.position = placement.index + 1
    await ctx.db.tasks.bulkPut(ordered.filter(row => row.id !== task.id).map((row, index) => ({ ...row, position: index < placement.index ? index + 1 : index + 2, ...ctx.stamp() })))
  }
  await ctx.db.tasks.put(geoeffnet)

  return geoeffnet
}

export function aufgaben(ctx: Kontext): Pick<Repositories, 'createTask' | 'updateTask' | 'setTaskCompleted' | 'moveTask' | 'reorderTasks' | 'deleteTask' | 'getTask' | 'listTasks' | 'listCompletedTasks' | 'listRestorableTasks' | 'listDeletedTasks' | 'restoreTask'> {
  return {

    async createTask(input) {
      return ctx.db.transaction('rw', ctx.db.lists, ctx.db.tasks, async () => {
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
          completed_expires_at: null,
          expired_at: null,
          reopen_context: null,
          successor_id: null,
          position: kleinste - 1,
          created_at: now,
          updated_at: now,
          deleted_at: null,
          dirty: 1,
        }
        await ctx.db.tasks.add(task)
        return task
      })
    },

    async updateTask(taskId, patch, options) {
      return ctx.db.transaction('rw', ctx.db.tasks, async () => {
        const task = await ctx.requireTask(taskId)
        const values = applyTaskEdit(task, patch, ctx.clock.nowMs(), options?.base)
        if (sameData(values, taskEditValues(task))) return task
        const updated: LocalTask = { ...task, ...values, ...ctx.stamp() }
        await ctx.db.tasks.put(updated)
        return updated
      })
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
      return ctx.db.transaction('rw', ctx.db.lists, ctx.db.tasks, async () => {
        const task = await ctx.requireTask(taskId)
        const list = await ctx.requireList(task.list_id)
        const now = ctx.clock.now()
        if (task.completed === completed) return task

        if (!completed) {
          return wiederOeffnen(ctx, task, now)
        }

        const erledigt: LocalTask = {
          ...task,
          completed: true,
          completed_at: now,
          completed_expires_at: completionDeadline(now, list.keep_completed),
          reopen_context: captureReopenContext(task, list, (await ctx.db.tasks.where('list_id').equals(list.id).toArray()).map(normalisiereAufgabe)),
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
        // WebCrypto ist kurz, aber kein IndexedDB-Aufruf. waitFor hält die
        // Transaktion während des Hashs offen; Netzwerk gehört nicht hier hinein.
        const nachfolgerId = await Dexie.waitFor(successorId(task.id, naechsterTermin))

        const nachfolger: LocalTask = {
          ...task,
          id: nachfolgerId,
          due_at: naechsterTermin,
          completed: false,
          completed_at: null,
          completed_expires_at: null,
          expired_at: null,
          reopen_context: null,
          successor_id: null,
          created_at: now,
          updated_at: now,
          deleted_at: null,
          dirty: 1,
        }

        erledigt.successor_id = nachfolgerId

        const vorhanden = await ctx.db.tasks.get(nachfolgerId)
        if (!vorhanden) {
          await ctx.db.tasks.put(nachfolger)
        } else if (vorhanden.deleted_at !== null && !vorhanden.expired_at) {
          // Nach einem Rückgängig war er weich gelöscht – jetzt wieder beleben,
          // aber den ursprünglichen Anlegezeitpunkt behalten.
          await ctx.db.tasks.put({ ...nachfolger, created_at: vorhanden.created_at })
        }
        // Der tatsächlich angelegte Stand enthält ggf. die ältere Erstellzeit.
        erledigt.reopen_context!.successor = !vorhanden || (vorhanden.deleted_at !== null && !vorhanden.expired_at)
          ? successorSnapshot(normalisiereAufgabe((await ctx.db.tasks.get(nachfolgerId))!)) : null
        // Ist er offen und vorhanden, bleibt er unangetastet: Vielleicht wurde
        // er inzwischen bearbeitet.
        await ctx.db.tasks.put(erledigt)
        return erledigt
      })
    },

    /**
     * Verschieben ist ein normales Update: `list_id` gehört zur Zeile und wird
     * damit beim nächsten Sync mit übertragen. Der Server prüft über die
     * RLS-Policies, dass die Ziel-Liste überhaupt zugänglich ist.
     */
    /**
     * Verschiebt eine Aufgabe in eine andere Liste – und auf Wunsch in einen
     * ihrer Bereiche.
     *
     * Der Bereich wird beim Listenwechsel **immer** mitgeführt: Die Kennung aus
     * der alten Liste gilt dort nicht. Angegeben werden kann nur ein Bereich,
     * den die Zielliste wirklich hat; alles andere wird zu „ohne Bereich" –
     * sonst hinge die Aufgabe an einem Bereich, den es nicht gibt.
     */
    async moveTask(taskId, targetListId, zielAbschnitt) {
      return ctx.db.transaction('rw', ctx.db.lists, ctx.db.tasks, async () => {
        const task = await ctx.requireTask(taskId)
        const liste = await ctx.requireList(targetListId)
        const wechselt = task.list_id !== targetListId

        const gewuenscht =
          zielAbschnitt === undefined ? (wechselt ? null : task.section_id) : zielAbschnitt
        const bereiche = parseSections(liste.sections)
        const naechsterBereich =
          gewuenscht !== null && bereiche.some((bereich) => bereich.id === gewuenscht)
            ? gewuenscht
            : null

        if (!wechselt && naechsterBereich === task.section_id) return task

        const updated: LocalTask = {
          ...task,
          list_id: targetListId,
          section_id: naechsterBereich,
          completed_expires_at: wechselt && task.completed ? completionDeadline(ctx.clock.now(), liste.keep_completed) : task.completed_expires_at,
          ...ctx.stamp(),
        }
        await ctx.db.tasks.put(updated)
        return updated
      })
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
      return ctx.db.transaction('rw', ctx.db.lists, ctx.db.tasks, async () => {
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
      })
    },

    async deleteTask(taskId) {
      return ctx.db.transaction('rw', ctx.db.tasks, async () => {
        const task = await ctx.requireTask(taskId)
        const { updated_at } = ctx.stamp()
        await ctx.db.tasks.put({ ...task, deleted_at: updated_at, updated_at, dirty: 1 })
      })
    },

    async getTask(taskId) {
      const task = await ctx.db.tasks.get(taskId)
      const normalized = task ? normalisiereAufgabe(task) : undefined
      return normalized && normalized.deleted_at === null && !completionExpired(normalized, ctx.clock.nowMs()) ? normalized : undefined
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

    async listCompletedTasks(listId) {
      const list = await ctx.requireList(listId)
      if (!list.keep_completed) return []
      return (await ctx.db.tasks.where('list_id').equals(listId).toArray()).map(normalisiereAufgabe)
        .filter(task => task.completed && task.deleted_at === null && !completionExpired(task, ctx.clock.nowMs())).sort(compareRestorable)
    },

    async listDeletedTasks() {
      const grenze = restoreCutoff(timeOf(ctx.clock.now()))
      // Über den Index `deleted_at`: Nur gelöschte Zeilen stehen darin.
      const tasks = await ctx.db.tasks.where('deleted_at').aboveOrEqual(grenze).toArray()

      /*
       * Aufgaben, deren Liste selbst gelöscht ist, gehören hier **nicht** hin:
       * Sie kommen mit ihrer Liste zurück, und einzeln wiederhergestellt
       * landeten sie in einer gelöschten Liste – sichtbar passierte nichts.
       * In der Liste stehen sie außerdem als längst erledigt oder vor Tagen
       * gelöscht, was zusätzlich verwirrt.
       */
      const geloeschteListen = new Set(
        (await ctx.db.lists.where('deleted_at').aboveOrEqual(grenze).toArray()).map(
          (liste) => liste.id,
        ),
      )
      return tasks
        .map(normalisiereAufgabe)
        .filter((task) => !geloeschteListen.has(task.list_id) && !completionExpired(task, ctx.clock.nowMs()))
        .sort(compareRestorable)
    },

    /**
     * Holt eine gelöschte Aufgabe zurück.
     *
     * `deleted_at` wird geleert, `dirty` gesetzt: Der Server muss davon
     * erfahren, sonst bliebe sie dort gelöscht.
     */
    async restoreTask(taskId) {
      return ctx.db.transaction('rw', ctx.db.tasks, async () => {
        const task = await ctx.db.tasks.get(taskId)
        if (!task) throw new ValidationError('not-found', 'Diese Aufgabe existiert nicht mehr.')
        if (completionExpired(normalisiereAufgabe(task), ctx.clock.nowMs())) throw new ValidationError('not-found', 'Diese Aufgabe ist endgültig abgelaufen.')
        await ctx.db.tasks.put({ ...task, deleted_at: null, ...ctx.stamp() })
      })
    },

    async listRestorableTasks() {
      const lists = new Map((await ctx.db.lists.toArray()).map(list => [list.id, ctx.mitAbschnittsplan(list)]))
      return (await ctx.db.tasks.where('completed_at').above('').toArray()).map(normalisiereAufgabe)
        .filter(task => task.completed && task.deleted_at === null && !completionExpired(task, ctx.clock.nowMs()) && lists.get(task.list_id)?.deleted_at === null && !lists.get(task.list_id)?.keep_completed)
        // Zuletzt abgehakt zuerst. Die Zeitstempel liegen alle im selben
        // ISO-Format vor, der Vergleich ist deshalb stabil.
        .sort(compareRestorable)
    },
  }
}
