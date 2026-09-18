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
 */
export function withChangeTracking(repositories: Repositories, onChange: () => void): Repositories {
  const track =
    <A extends unknown[], R>(fn: (...args: A) => Promise<R>) =>
    async (...args: A): Promise<R> => {
      const result = await fn(...args)
      onChange()
      return result
    }

  return {
    createList: track(repositories.createList.bind(repositories)),
    renameList: track(repositories.renameList.bind(repositories)),
    deleteList: track(repositories.deleteList.bind(repositories)),
    createTask: track(repositories.createTask.bind(repositories)),
    updateTask: track(repositories.updateTask.bind(repositories)),
    setTaskCompleted: track(repositories.setTaskCompleted.bind(repositories)),
    moveTask: track(repositories.moveTask.bind(repositories)),
    reorderTasks: track(repositories.reorderTasks.bind(repositories)),
    deleteTask: track(repositories.deleteTask.bind(repositories)),
    markListShared: track(repositories.markListShared.bind(repositories)),
    removeMember: track(repositories.removeMember.bind(repositories)),

    // Reine Lesezugriffe – hier darf nichts gezählt werden.
    getList: repositories.getList.bind(repositories),
    listLists: repositories.listLists.bind(repositories),
    getTask: repositories.getTask.bind(repositories),
    listTasks: repositories.listTasks.bind(repositories),
    listMembers: repositories.listMembers.bind(repositories),
  }
}
