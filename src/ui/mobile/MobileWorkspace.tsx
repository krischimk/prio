import { useState } from 'react'
import { useAuth } from '../../auth/useAuth'
import { useWorkspace } from '../../app/useWorkspace'
import { useLists, useSelectedListId, useTasks } from '../../app/hooks'
import type { LocalTask } from '../../domain/types'
import { MobileAppBar } from './MobileAppBar'
import { MobileDrawer } from './MobileDrawer'
import { MobileTaskList } from './MobileTaskList'
import { MoveTaskSheet } from './MoveTaskSheet'
import { TaskDetailSheet } from './TaskDetailSheet'
import { PlusIcon } from './icons'

/**
 * Mobile Oberfläche der App.
 *
 * Aufbau bewusst wie bei einer Android-App:
 *   - feste Leiste oben mit Menü, Listenname und Sync-Zustand
 *   - scrollbare Aufgabenliste in der Mitte
 *   - runder "+"-Knopf unten mittig
 *   - Listen, Konto und Einstellungen im ausklappbaren Menü
 *
 * Tippen auf eine Aufgabe öffnet die Detailansicht – dort sind Bearbeiten,
 * Verschieben und Löschen gebündelt. In der Liste selbst gibt es dafür keine
 * Bedienelemente und keine Gesten.
 */
export function MobileWorkspace() {
  const { state } = useAuth()
  const { repositories } = useWorkspace()
  const lists = useLists()
  const [selectedListId, selectList] = useSelectedListId(lists)

  const [drawerOpen, setDrawerOpen] = useState(false)
  /** `null` = geschlossen, sonst die Aufgabe (`task: null` legt eine neue an). */
  const [detail, setDetail] = useState<{ task: LocalTask | null } | null>(null)
  const [movingTask, setMovingTask] = useState<LocalTask | null>(null)

  const tasks = useTasks(selectedListId)
  const selected = lists.find((list) => list.id === selectedListId) ?? null
  const userId = state.status === 'authenticated' ? state.user.id : ''
  const openCount = tasks.filter((task) => !task.completed).length

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <MobileAppBar listName={selected?.name ?? null} onOpenMenu={() => setDrawerOpen(true)} />

      <main className="app-bar-offset pb-28">
        {selected === null ? (
          <p className="px-6 py-12 text-center text-sm text-neutral-500">
            Öffne oben links das Menü und lege eine Liste an.
          </p>
        ) : (
          <>
            <div className="flex items-center justify-between px-4 pb-1 pt-3 text-xs text-neutral-500">
              <span>{openCount === 1 ? '1 offene Aufgabe' : `${openCount} offene Aufgaben`}</span>
              <span>{tasks.length} gesamt</span>
            </div>
            <MobileTaskList
              tasks={tasks}
              onOpenTask={(task) => setDetail({ task })}
              onReorder={(orderedTaskIds) => {
                void repositories.reorderTasks(selected.id, orderedTaskIds)
              }}
            />
          </>
        )}
      </main>

      {selected !== null ? (
        <div className="safe-bottom pointer-events-none fixed inset-x-0 bottom-0 z-20 flex justify-center">
          <button
            type="button"
            onClick={() => setDetail({ task: null })}
            aria-label="Neue Aufgabe"
            className="pointer-events-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-500 text-white shadow-lg shadow-black/40 active:bg-indigo-400"
          >
            <PlusIcon />
          </button>
        </div>
      ) : null}

      <MobileDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        lists={lists}
        selectedListId={selectedListId}
        onSelectList={selectList}
        currentUserId={userId}
      />

      {detail !== null && selected !== null ? (
        <TaskDetailSheet
          task={detail.task}
          listId={selected.id}
          lists={lists}
          onClose={() => setDetail(null)}
          onRequestMove={(task) => setMovingTask(task)}
        />
      ) : null}

      {movingTask !== null ? (
        <MoveTaskSheet task={movingTask} lists={lists} onClose={() => setMovingTask(null)} />
      ) : null}
    </div>
  )
}
