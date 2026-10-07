import { systemClock, type Clock } from '../../domain/clock'
import type { LocalDatabase } from '../localDb'
import { createKontext } from './context'
import { aufgaben } from './aufgaben'
import { einstellungen } from './einstellungen'
import { listen } from './listen'
import { mitglieder } from './mitglieder'
import type { Repositories } from './types'

export type { CreateTaskInput, Repositories, UpdateTaskInput } from './types'

/**
 * Die Datenbankschicht: alles, was die App aus Dexie liest und schreibt.
 *
 * Vorher stand das in **einer** Datei mit 27 Methoden (871 Zeilen) – Listen,
 * Aufgaben, Mitglieder und lokale Eingabehilfen in einem Objekt. Wer eine
 * Aufgabenregel änderte, scrollte an allem anderen vorbei, und die Datei
 * wuchs mit jeder Funktion. Jetzt ein Bereich je Datei; hier steht nur noch
 * die Zusammensetzung.
 */
export function createRepositories(db: LocalDatabase, clock: Clock = systemClock): Repositories {
  const ctx = createKontext(db, clock)
  return {
    ...listen(ctx),
    ...aufgaben(ctx),
    ...mitglieder(ctx),
    ...einstellungen(ctx),
  }
}
