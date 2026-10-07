import type { Repositories } from '../db/repositories'

/**
 * Ein Zähler über der Geschäftslogik: Nach jeder schreibenden Operation wird
 * gemeldet, damit die Oberfläche neu liest und der Abgleich anläuft.
 *
 * Damit braucht die Oberfläche keine eigene State-Bibliothek: Hooks lesen nach
 * jeder Änderung neu aus IndexedDB. Es gibt nur eine Wahrheit (die lokale DB),
 * statt zusätzlich kopierten Zustand in React.
 *
 * Zwei Sorten von Änderung, und der Unterschied ist wichtig:
 *
 *  - `onChange` – es kann etwas zum Hochladen geben. Der Aufrufer stößt danach
 *    einen Abgleich an.
 *  - `onLocalOnlyChange` – nur lokale Eingabehilfen (vorgemerkte Vorlaufzeiten,
 *    schon geteilte Adressen). Sie werden nie synchronisiert, ein Abgleich
 *    brächte nichts. Zählt man sie wie Datenänderungen, löst jeder Abgleich
 *    einen weiteren aus – der Abgleich läuft dann in einer Schleife.
 *
 * Beide werden auch dann gerufen, wenn die Operation nichts geschrieben hat:
 * Der Zähler ist eine Aufforderung zum Neuladen, kein Änderungsprotokoll.
 *
 * **Die Einordnung ist eine Tabelle, keine Aufzählung.** Vorher stand jede
 * Methode einzeln im Rückgabeobjekt, und die Zuordnung war nirgends geprüft:
 * Eine neue schreibende Methode, die in der Lese-Gruppe landete, fiel erst
 * dadurch auf, dass ihre Daten nie hochgeladen wurden. Jetzt gibt es drei
 * Listen, und `tests/unit/trackedRepositories.test.ts` prüft, dass sie genau
 * die Methoden der Datenbank abdecken – eine neue Methode ohne Einordnung lässt
 * den Test scheitern.
 */

/** Schreibende Operationen: lösen Abgleich und Neuladen aus. */
export const SCHREIBEND = [
  'createList',
  'renameList',
  'setListIcon',
  'addListSection',
  'renameListSection',
  'deleteListSection',
  'deleteList',
  'createTask',
  'updateTask',
  'setTaskCompleted',
  'moveTask',
  'reorderTasks',
  'deleteTask',
  'markListShared',
  'removeMember',
  'leaveList',
] as const satisfies readonly (keyof Repositories)[]

/** Lokale Eingabehilfen: nur neu laden, nie abgleichen. */
export const NUR_LOKAL = [
  'setReminderPresets',
  'rememberShareContact',
  'mergeShareContacts',
] as const satisfies readonly (keyof Repositories)[]

/** Reine Lesezugriffe – hier darf nichts gezählt werden. */
export const LESEND = [
  'getList',
  'listLists',
  'getTask',
  'listTasks',
  'listRestorableTasks',
  'listMembers',
  'listReminderPresets',
  'listShareContacts',
] as const satisfies readonly (keyof Repositories)[]

type BeliebigeMethode = (...args: never[]) => Promise<unknown>

export function withChangeTracking(
  repositories: Repositories,
  onChange: () => void,
  onLocalOnlyChange: () => void,
): Repositories {
  const umhuellt: Repositories = { ...repositories }

  const melden = (name: keyof Repositories, meldung: () => void) => {
    const original = repositories[name] as unknown as BeliebigeMethode
    const ersatz = (async (...args: unknown[]) => {
      const ergebnis = await original(...(args as never[]))
      meldung()
      return ergebnis
    }) as unknown as Repositories[typeof name]
    // Die Zuweisung über einen Index lässt TypeScript nicht auf die
    // Schnittmenge aller Methodensignaturen prüfen; die Zuordnung selbst prüft
    // der Test.
    ;(umhuellt as unknown as Record<string, unknown>)[name] = ersatz
  }

  for (const name of SCHREIBEND) melden(name, onChange)
  for (const name of NUR_LOKAL) melden(name, onLocalOnlyChange)

  return umhuellt
}
