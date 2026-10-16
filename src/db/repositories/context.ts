/**
 * Was alle Bereiche der Datenbank gemeinsam brauchen.
 *
 * Die vier Helfer standen vorher als verschachtelte Funktionen in
 * `createRepositories`. Jede Bereichsdatei bekäme sie sonst einzeln – und die
 * Frage „welche Liste gibt es denn?" wäre an vier Stellen zu beantworten.
 */
import type { Clock } from '../../domain/clock'
import { normalisiereAufgabe, normalisiereListe } from '../../domain/normalize'
import type { LocalList, LocalTask } from '../../domain/types'
import { completionExpired } from '../../domain/taskLifecycle'
import type { LocalDatabase } from '../localDb'
import { ValidationError } from '../validation'
import { conflictingTaskTitle } from '../../domain/taskTitles'

export interface Kontext {
  db: LocalDatabase
  clock: Clock
  mitAbschnittsplan(list: LocalList): LocalList
  stamp(): { updated_at: string; dirty: 1 }
  requireList(listId: string): Promise<LocalList>
  requireTask(taskId: string): Promise<LocalTask>
  requireUniqueTaskTitle(task: LocalTask): Promise<void>
}

export function createKontext(db: LocalDatabase, clock: Clock): Kontext {
function mitAbschnittsplan(list: LocalList): LocalList {
    return normalisiereListe(list)
  }

function stamp(): { updated_at: string; dirty: 1 } {
    return { updated_at: clock.now(), dirty: 1 }
  }

async function requireList(listId: string): Promise<LocalList> {
    const list = await db.lists.get(listId)
    if (!list || list.deleted_at !== null) {
      throw new ValidationError('not-found', 'Diese Liste existiert nicht mehr.')
    }
    return mitAbschnittsplan(list)
  }

async function requireTask(taskId: string): Promise<LocalTask> {
    const task = await db.tasks.get(taskId)
    if (!task || task.deleted_at !== null) {
      throw new ValidationError('not-found', 'Diese Aufgabe existiert nicht mehr.')
    }
    const normalized = normalisiereAufgabe(task)
    if (completionExpired(normalized, clock.nowMs())) throw new ValidationError('not-found', 'Diese Aufgabe ist endgültig abgelaufen.')
    return normalized
  }
  async function requireUniqueTaskTitle(task: LocalTask): Promise<void> {
    const list = await requireList(task.list_id)
    if (list.allow_duplicate_titles) return
    const rows = (await db.tasks.where('list_id').equals(list.id).toArray()).map(normalisiereAufgabe)
    if (conflictingTaskTitle(task, rows, clock.nowMs())) {
      throw new ValidationError('invalid', 'In dieser Liste gibt es bereits eine offene oder erledigte Aufgabe mit diesem Namen.')
    }
  }
  return { db, clock, mitAbschnittsplan, stamp, requireList, requireTask, requireUniqueTaskTitle }
}
