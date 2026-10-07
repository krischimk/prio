import { Fragment, useRef } from 'react'
import { useWorkspace } from '../../app/useWorkspace'
import { useUndo } from '../useUndo'
import type { ListSection, LocalTask } from '../../domain/types'
import { flattenGroups, groupTasks } from '../../domain/sections'
import { appBackground, layer } from '../styles'
import { leerAufgaben } from '../emptyTexts'
import { TaskDescription } from '../TaskDescription'
import { TaskFacts } from '../TaskFacts'
import { SectionHeader } from '../SectionHeader'
import { useCollapsedSections } from '../collapsedSections'
import { useReorderDrag, type ReorderDrag } from './useReorderDrag'

/**
 * Aufgabenliste der mobilen Ansicht.
 *
 * Bewusst ohne Bearbeiten- und Löschen-Knöpfe: Die Zeile selbst ist der Knopf
 * und öffnet die Detailansicht. Dort gibt es auch das Verschieben in eine
 * andere Liste.
 *
 * Umsortieren: Die Zeile gedrückt halten (rund 0,4 s), dann ziehen. Während des
 * Ziehens zeigt eine Linie, wo die Aufgabe landen würde. Kurzes Wischen scrollt
 * weiterhin die Liste.
 */
export function MobileTaskList({
  tasks,
  sections,
  currentUserId,
  onOpenTask,
  onReorder,
}: {
  tasks: LocalTask[]
  /** Die Bereiche der Liste – leer heißt: eine flache Liste. */
  sections: ListSection[]
  onOpenTask: (task: LocalTask) => void
  /**
   * Die neue Reihenfolge **und** der Bereich, in den die gezogene Aufgabe
   * gehört: Beim Ziehen wechselt sie unter Umständen den Bereich.
   */
  onReorder: (orderedTaskIds: string[], sectionOf: Record<string, string | null>) => void
  currentUserId: string
}) {
  const listRef = useRef<HTMLDivElement>(null)
  const gruppen = groupTasks(tasks, sections)
  const flach = flattenGroups(gruppen)
  const mitBereichen = sections.length > 0
  // Zugeklappt wird je Liste gemerkt – nicht je Abschnitt, damit der Schlüssel
  // auch dann stimmt, wenn es (noch) keine Bereiche gibt.
  const { zugeklappt, umschalten } = useCollapsedSections(tasks[0]?.list_id ?? '')

  const drag = useReorderDrag({
    itemIds: flach.map((task) => task.id),
    onReorder: (orderedTaskIds, draggedId) => {
      onReorder(orderedTaskIds, zielAbschnitt(orderedTaskIds, flach, draggedId))
    },
    containerRef: listRef,
  })

  if (tasks.length === 0) {
    return (
      <p className="px-4 py-10 text-center text-body text-ink-faint" data-testid="empty-tasks">
        {leerAufgaben('mobil')}
      </p>
    )
  }

  let index = -1

  return (
    <div ref={listRef} data-testid="task-list">
      {mitBereichen
        ? gruppen.map((gruppe) => {
            const offen = !zugeklappt.has(gruppe.id)
            return (
              <div key={gruppe.id}>
                {gruppe.section === null ? null : (
                  <SectionHeader
                    name={gruppe.section.name}
                    anzahl={gruppe.tasks.length}
                    offen={offen}
                    onToggle={() => umschalten(gruppe.id)}
                    className="px-4 pt-3"
                  />
                )}
                {offen
                  ? gruppe.tasks.map((task) => {
                      index += 1
                      return (
                        <Fragment key={task.id}>
                          {drag.draggingId !== null && drag.dropIndex === index ? <DropIndicator /> : null}
                          <MobileTaskRow
                            task={task}
                            index={index}
                            drag={drag}
                            onOpen={onOpenTask}
                            isDragging={drag.draggingId === task.id}
                            currentUserId={currentUserId}
                          />
                        </Fragment>
                      )
                    })
                  : null}
              </div>
            )
          })
        : flach.map((task) => {
            index += 1
            return (
              <Fragment key={task.id}>
                {drag.draggingId !== null && drag.dropIndex === index ? <DropIndicator /> : null}
                <MobileTaskRow
                  task={task}
                  index={index}
                  drag={drag}
                  onOpen={onOpenTask}
                  isDragging={drag.draggingId === task.id}
                  currentUserId={currentUserId}
                />
              </Fragment>
            )
          })}
      {drag.draggingId !== null && drag.dropIndex === flach.length ? <DropIndicator /> : null}
    </div>
  )
}

/**
 * In welchen Bereich gehört die gezogene Aufgabe nach dem Ziehen?
 *
 * Ihr Ziel ergibt sich aus den Nachbarn an der neuen Stelle: Steht sie vor
 * einer Aufgabe, gilt deren Bereich; steht sie am Ende, der Bereich der
 * Aufgabe davor. Ohne Bereiche bleibt es `null`.
 *
 * Ein **leerer** Bereich lässt sich so nicht befüllen – es gibt keine
 * Nachbarzeile, an der er zu erkennen wäre. Die erste Aufgabe kommt deshalb
 * über das Formular hinein; danach geht Ziehen auch dorthin.
 */
function zielAbschnitt(
  orderedTaskIds: string[],
  flach: LocalTask[],
  draggedId: string | null,
): Record<string, string | null> {
  if (draggedId === null) return {}
  const bereichVon = new Map(flach.map((task) => [task.id, task.section_id]))
  const stelle = orderedTaskIds.indexOf(draggedId)
  if (stelle < 0) return {}

  const nachbar =
    orderedTaskIds[stelle + 1] ?? (stelle > 0 ? orderedTaskIds[stelle - 1] : undefined)
  const ziel = nachbar === undefined ? (bereichVon.get(draggedId) ?? null) : (bereichVon.get(nachbar) ?? null)
  return { [draggedId]: ziel }
}

function DropIndicator() {
  return <li aria-hidden="true" data-testid="drop-indicator" className="h-0.5 bg-brand" />
}

function MobileTaskRow({
  task,
  index,
  drag,
  onOpen,
  isDragging,
  currentUserId,
}: {
  task: LocalTask
  index: number
  drag: ReorderDrag
  onOpen: (task: LocalTask) => void
  isDragging: boolean
  currentUserId: string
}) {
  const { repositories } = useWorkspace()
  const { offerUndo } = useUndo()
  const handlers = drag.getRowHandlers(task.id, index)

  return (
    <li
      data-task-row
      className={`flex items-start gap-3 border-b border-line-soft ${appBackground} px-4 py-3 ${
        isDragging ? 'relative ' + layer.row + ' shadow-lg shadow-page/50' : ''
      }`}
      style={isDragging ? { transform: `translateY(${drag.offsetY}px)` } : undefined}
    >
      <input
        type="checkbox"
        className="mt-0.5 h-5 w-5 shrink-0 accent-brand"
        checked={task.completed}
        aria-label={`Aufgabe erledigen: ${task.title}`}
        onChange={(event) => {
          void repositories.setTaskCompleted(task.id, event.target.checked)
          if (event.target.checked) offerUndo(task)
        }}
      />

      {/*
        Ein Knopf kann keinen Knopf enthalten – deshalb liegt die Beschreibung
        unter dem Knopf „Aufgabe öffnen", in einem eigenen Bereich. Sonst würde
        der Schalter „Mehr" die Detailansicht mit öffnen.
      */}
      {/*
        Die Zieh-Griffe und der Klick zum Öffnen liegen auf dem ganzen Bereich
        rechts vom Kästchen – nicht nur auf Titel und Angaben. Mit Beschreibung
        war die Fläche sonst klein, und ein langer Druck daneben markierte Text
        statt die Aufgabe aufzunehmen.
      */}
      <div
        {...handlers}
        onClick={() => {
          // Nach einem Ziehen folgt trotzdem ein Klick – der darf die
          // Detailansicht nicht zusätzlich öffnen.
          if (drag.wasDragging()) return
          onOpen(task)
        }}
        className="flex min-w-0 flex-1 flex-col touch-manipulation select-none text-left"
      >
        <button
          type="button"
          onClick={() => {
            if (drag.wasDragging()) return
            onOpen(task)
          }}
          className="min-w-0 text-left select-none"
          data-testid="task-row"
        >
          <TaskFacts task={task} currentUserId={currentUserId} dichte="mobil" />
        </button>
      {task.description ? <TaskDescription text={task.description} className="mt-0.5" /> : null}
      </div>
    </li>
  )
}
