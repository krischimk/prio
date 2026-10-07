import type { Repositories } from '../db/repositories'

/**
 * Legt einen Zähler über die Geschäftslogik, der nach jeder schreibenden
 * Operation hochgezählt wird.
 *
 * Damit braucht die Oberfläche keine eigene State-Bibliothek: Hooks lesen nach
 * jeder Änderung neu aus IndexedDB. Das ist für die kleinen Datenmengen eines
 * Prototyps völlig ausreichend – und es gibt nur eine Wahrheit (die lokale DB),
 * statt zusätzlich kopierten Zustand in React.
 *
 * Bewusst explizit statt per Proxy: So ist beim Lesen sofort klar, welche
 * Operationen als Änderung gelten.
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
 */
export function withChangeTracking(
  repositories: Repositories,
  onChange: () => void,
  onLocalOnlyChange: () => void,
): Repositories {
  const track =
    <A extends unknown[], R>(fn: (...args: A) => Promise<R>) =>
    async (...args: A): Promise<R> => {
      const result = await fn(...args)
      onChange()
      return result
    }

  const trackLocalOnly =
    <A extends unknown[], R>(fn: (...args: A) => Promise<R>) =>
    async (...args: A): Promise<R> => {
      const result = await fn(...args)
      onLocalOnlyChange()
      return result
    }

  return {
    createList: track(repositories.createList.bind(repositories)),
    renameList: track(repositories.renameList.bind(repositories)),
    setListIcon: track(repositories.setListIcon.bind(repositories)),
    addListSection: track(repositories.addListSection.bind(repositories)),
    renameListSection: track(repositories.renameListSection.bind(repositories)),
    deleteListSection: track(repositories.deleteListSection.bind(repositories)),
    deleteList: track(repositories.deleteList.bind(repositories)),
    createTask: track(repositories.createTask.bind(repositories)),
    updateTask: track(repositories.updateTask.bind(repositories)),
    setTaskCompleted: track(repositories.setTaskCompleted.bind(repositories)),
    moveTask: track(repositories.moveTask.bind(repositories)),
    reorderTasks: track(repositories.reorderTasks.bind(repositories)),
    deleteTask: track(repositories.deleteTask.bind(repositories)),
    markListShared: track(repositories.markListShared.bind(repositories)),
    removeMember: track(repositories.removeMember.bind(repositories)),
    leaveList: track(repositories.leaveList.bind(repositories)),
    // Eingabehilfen: nur lokal, ohne Abgleich (siehe oben).
    setReminderPresets: trackLocalOnly(repositories.setReminderPresets.bind(repositories)),
    rememberShareContact: trackLocalOnly(repositories.rememberShareContact.bind(repositories)),
    mergeShareContacts: trackLocalOnly(repositories.mergeShareContacts.bind(repositories)),

    // Reine Lesezugriffe – hier darf nichts gezählt werden.
    getList: repositories.getList.bind(repositories),
    listLists: repositories.listLists.bind(repositories),
    getTask: repositories.getTask.bind(repositories),
    listTasks: repositories.listTasks.bind(repositories),
    listRestorableTasks: repositories.listRestorableTasks.bind(repositories),
    listMembers: repositories.listMembers.bind(repositories),
    listReminderPresets: repositories.listReminderPresets.bind(repositories),
    listShareContacts: repositories.listShareContacts.bind(repositories),
  }
}
