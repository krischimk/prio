import { Fragment, useRef } from 'react'
import { useWorkspace } from '../../app/useWorkspace'
import { useUndo } from '../useUndo'
import type { ListSection, LocalTask } from '../../domain/types'
import { flattenGroups, groupTasks } from '../../domain/sections'
import { focusRing, appBackground, layer } from '../styles'
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
    /*
     * Der Zielbereich kommt aus der Geometrie des Ziehens, nicht mehr aus dem
     * Nachbarn an der neuen Stelle. Nur so sind **leere** und **zugeklappte**
     * Bereiche erreichbar: Dort gibt es keine Nachbarzeile, an der sich der
     * Bereich ablesen ließe – wohl aber einen Kopf.
     */
    onReorder: (orderedTaskIds, draggedId, abschnittId) => {
      onReorder(orderedTaskIds, { [draggedId]: abschnittId })
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
                {/*
                  Auch die Aufgaben ohne Bereich bekommen einen Kopf - aber nur,
                  wenn es ueberhaupt Bereiche gibt. Ohne ihn liesse sich dorthin
                  nicht ziehen: Das Ziel eines Zuges ist immer ein Kopf, und eine
                  leere Gruppe hat keine Zeile, an der es sich ablesen liesse.
                  Ohne Bereiche bleibt die Liste flach und ohne Kopf.
                */}
                <SectionHeader
                  name={gruppe.section?.name ?? 'Ohne Bereich'}
                  anzahl={gruppe.tasks.length}
                  offen={offen}
                  onToggle={() => umschalten(gruppe.id)}
                  className="px-4 pt-3"
                  abschnittId={gruppe.section?.id}
                  hervorgehoben={drag.dropSectionIdAktiv && drag.dropSectionId === (gruppe.section?.id ?? null)}
                />
                {offen
                  ? gruppe.tasks.map((task) => {
                      index += 1
                      /*
                       * Die Linie gehoert an den Gruppenanfang, wenn das Ziel
                       * diese Gruppe ist, aber keine ihrer Zeilen: Etwa in
                       * einen leeren Bereich oder in die Aufgaben ohne Bereich.
                       */
                      const zeileInDieserGruppe = gruppe.tasks.some(
                        (eigene) => eigene.id === drag.dropBeforeId,
                      )
                      const anfang =
                        drag.dropSectionIdAktiv &&
                        drag.dropSectionId === (gruppe.section?.id ?? null) &&
                        !zeileInDieserGruppe
                      return (
                        <Fragment key={task.id}>
                          {anfang && task.id === gruppe.tasks[0]?.id ? <DropIndicator /> : null}
                          {drag.dropBeforeId === task.id ? <DropIndicator /> : null}
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
                {drag.dropBeforeId === task.id ? <DropIndicator /> : null}
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
      {drag.dropAtEnd ? <DropIndicator /> : null}
    </div>
  )
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
      data-id={task.id}
      /*
       * Der Bereich der Zeile gehört ins DOM: Das Ziehen liest den Zielbereich
       * aus der Geometrie, und dazu muss jede Zeile wissen, wohin sie gehört.
       */
      data-section-id={task.section_id ?? undefined}
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
          className={`${focusRing} min-w-0 text-left select-none`}
          data-testid="task-row"
        >
          <TaskFacts task={task} currentUserId={currentUserId} dichte="mobil" />
        </button>
      {task.description ? <TaskDescription text={task.description} className="mt-0.5" /> : null}
      </div>
    </li>
  )
}
