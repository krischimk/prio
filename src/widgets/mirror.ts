import { App } from '@capacitor/app'
import type { LocalDatabase } from '../db/localDb'
import type { Repositories } from '../db/repositories'
import { readCloudState } from '../db/cloudState'
import { toRemoteList, toRemoteTask } from '../domain/mapping'
import type { RemoteList, RemoteTask } from '../domain/types'
import { projectWidget, type WidgetRows } from './model'
import { hasNativeWidgets, widgetBridge } from './native'

/** Ableitung aus Dexie; die Oberfläche behält genau ihre bisherige Datenquelle. */
export function createWidgetMirror(db: LocalDatabase, repositories: Repositories, userId: string) {
  let closed = false; let cached: WidgetRows | null = null
  let local: ReturnType<typeof projectWidget>['local'] = {}
  let publishing: Promise<void> | null = null; let repeat = false
  let resume: Awaited<ReturnType<typeof App.addListener>> | null = null
  const native = hasNativeWidgets()
  async function drain() {
    if (!native || closed) return
    const { lease } = await widgetBridge.acquire({ name: 'queue' })
    try {
      for (const command of (await widgetBridge.commands()).commands) {
        if (closed || command.userId !== userId) break
        const task = await repositories.getTask(command.taskId)
        if (task) {
          if (command.checklist) {
            if (task.checklist.some(item => item.id === command.checklist!.id && item.deleted_at === null))
              await repositories.setChecklistItemCompleted(task.id, command.checklist.id, command.checklist.completed, { id: command.id, at: command.at })
          } else await repositories.setTaskCompleted(task.id, true, { id: command.id, at: command.at })
        }
        // Erst nach der dauerhaften Dexie-Transaktion quittieren. Ein Absturz
        // dazwischen wiederholt denselben idempotenten Auftrag mit derselben Zeit.
        await widgetBridge.acknowledge({ id: command.id })
        cached = null
      }
    } finally { await widgetBridge.release({ lease }) }
  }
  async function capture() {
    const lists = await db.lists.toArray()
    const tasks = await db.tasks.where('[list_id+read_state]').anyOf(lists.map(list => [list.id, 'open'])).toArray()
    const [preferences, userPreferences] = await Promise.all([db.list_preferences.toArray(), db.user_preferences.toArray()])
    local = {}
    for (const task of tasks) {
      const list = lists.find(row => row.id === task.list_id)
      if (!list || (!task.dirty && !list.dirty)) continue
      const [taskState, listState] = await Promise.all([readCloudState(db, 'tasks', task.id), readCloudState(db, 'lists', list.id)])
      local[task.id] = { task: toRemoteTask(task), base: taskState.base as RemoteTask | null ?? null, list: toRemoteList(list), listBase: listState.base as RemoteList | null ?? null }
    }
    cached = { lists, tasks, preferences, userPreferences }
  }
  function publish(initial = false, invalidate = false): Promise<void> {
    if (!native || closed) return Promise.resolve()
    if (invalidate) cached = null
    if (publishing) { repeat = true; return publishing }
    publishing = (async () => {
      do {
        repeat = false
        if (!cached) await capture()
        const snapshot = projectWidget(cached!, userId, Date.now(), Intl.DateTimeFormat().resolvedOptions().timeZone)
        snapshot.local = local
        if (!closed) await widgetBridge.publish({ snapshot, initial })
      } while (repeat && !closed)
    })().catch(error => { console.warn('[prio] Widget wird später aufgefrischt.', error instanceof Error ? error.name : 'Fehler') }).finally(() => { publishing = null })
    return publishing
  }
  if (native) void App.addListener('resume', () => { void drain().then(() => publish(false, true)).catch(() => {}) })
    .then(listener => { if (closed) void listener.remove(); else resume = listener })
  return { drain, publish, close() { closed = true; void resume?.remove() } }
}
