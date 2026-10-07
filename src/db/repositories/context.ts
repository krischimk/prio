/**
 * Was alle Bereiche der Datenbank gemeinsam brauchen.
 *
 * Die vier Helfer standen vorher als verschachtelte Funktionen in
 * `createRepositories`. Jede Bereichsdatei bekäme sie sonst einzeln – und die
 * Frage „welche Liste gibt es denn?" wäre an vier Stellen zu beantworten.
 */
import type { Clock } from '../../domain/clock'
import { normalisiereListe } from '../../domain/normalize'
import type { LocalList, LocalTask } from '../../domain/types'
import type { LocalDatabase } from '../localDb'
import { ValidationError } from '../validation'

export interface Kontext {
  db: LocalDatabase
  clock: Clock
  mitAbschnittsplan(list: LocalList): LocalList
  stamp(): { updated_at: string; dirty: 1 }
  requireList(listId: string): Promise<LocalList>
  requireTask(taskId: string): Promise<LocalTask>
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
    return list
  }

async function requireTask(taskId: string): Promise<LocalTask> {
    const task = await db.tasks.get(taskId)
    if (!task || task.deleted_at !== null) {
      throw new ValidationError('not-found', 'Diese Aufgabe existiert nicht mehr.')
    }
    return task
  }
  return { db, clock, mitAbschnittsplan, stamp, requireList, requireTask }
}
