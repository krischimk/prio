import { useRef } from 'react'
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
import { useFlip } from '../useFlip'
import { OHNE_BEREICH, useReorderDrag, type ReorderDrag } from './useReorderDrag'
import { ordneUm } from './ordnen'

/**
 * Aufgabenliste der mobilen Ansicht.
 *
 * Bewusst ohne Bearbeiten- und Löschen-Knöpfe: Die Zeile selbst ist der Knopf
 * und öffnet die Detailansicht. Dort gibt es auch das Verschieben in eine
 * andere Liste.
 *
 * Umsortieren: Die Zeile gedrückt halten (rund 0,4 s), dann ziehen. Während des
 * Ziehens nimmt die Liste **schon die Reihenfolge an, die beim Loslassen
 * entstünde** – kein Einfügestrich, sondern die sichtbare Endposition. Die
 * gezogene Aufgabe hängt als Kopie unter dem Finger, an ihrem Platz bleibt eine
 * blasse Lücke. Kurzes Wischen scrollt weiterhin die Liste.
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
  const mitBereichen = sections.length > 0
  // Zugeklappt wird je Liste gemerkt – nicht je Abschnitt, damit der Schlüssel
  // auch dann stimmt, wenn es (noch) keine Bereiche gibt.
  const { zugeklappt, umschalten } = useCollapsedSections(tasks[0]?.list_id ?? '')

  /** Der Gruppenschlüssel einer Aufgabe: ihr Bereich oder „ohne Bereich". */
  const gruppeVon = (task: LocalTask) =>
    mitBereichen ? (task.section_id ?? OHNE_BEREICH) : OHNE_BEREICH
  /** Die Gruppen in ihrer Reihenfolge – „ohne Bereich" zuerst. */
  const gruppenSchluessel = [
    OHNE_BEREICH,
    ...sections.map((abschnitt) => abschnitt.id),
  ]

  const drag = useReorderDrag({
    /*
     * Der Zielbereich und der Platz kommen aus der Geometrie des Ziehens:
     * welcher Kopf über dem Finger liegt und an wie vielen Zeilenmitten dieser
     * Gruppe er vorbei ist. Nur so sind leere Bereiche erreichbar – und der
     * ganze leere Raum unter einem Kopf gehört zu seinem Bereich.
     */
    onDrop: (draggedId, gruppe, index) => {
      const naechste = ordneUm({
        eintraege: tasks,
        gruppen: gruppenSchluessel,
        gruppeVon,
        gezogeneId: draggedId,
        ziel: { gruppe, index },
      })
      /*
       * Geschrieben wird, wenn sich **etwas** ändert: die Reihenfolge oder der
       * Bereich. Nur auf die Reihenfolge zu sehen war der Fehler beim Ziehen in
       * einen leeren Bereich – dort bleibt die flache Reihenfolge gleich, der
       * Bereich ändert sich aber.
       */
      const reihenfolgeGleich =
        naechste.map((task) => task.id).join('\u0000') ===
        tasks.map((task) => task.id).join('\u0000')
      const gezogene = tasks.find((task) => task.id === draggedId)
      const bereichGleich = gezogene !== undefined && gruppeVon(gezogene) === gruppe
      if (!reihenfolgeGleich || !bereichGleich) {
        onReorder(
          naechste.map((task) => task.id),
          { [draggedId]: gruppe === OHNE_BEREICH ? null : gruppe },
        )
      }
    },
    containerRef: listRef,
  })

  /*
   * Die Anzeige während des Ziehens: dieselbe Rechnung wie beim Loslassen,
   * nur ohne zu schreiben. Was man sieht, ist damit genau das Ergebnis.
   */
  const angezeigt =
    drag.draggingId === null || drag.ziel === null
      ? tasks
      : ordneUm({
          eintraege: tasks,
          gruppen: gruppenSchluessel,
          gruppeVon,
          gezogeneId: drag.draggingId,
          ziel: drag.ziel,
        })

  // Elemente gleiten an ihren neuen Platz, statt zu springen.
  useFlip(listRef, angezeigt.map((task) => task.id).join(','))

  if (tasks.length === 0) {
    return (
      <p className="px-4 py-10 text-center text-body text-ink-faint" data-testid="empty-tasks">
        {leerAufgaben('mobil')}
      </p>
    )
  }

  const gruppen = groupTasks(angezeigt, sections)
  const flach = flattenGroups(gruppen)
  const klonTask =
    drag.draggingId === null
      ? null
      : (tasks.find((task) => task.id === drag.draggingId) ?? null)
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
                  gruppe={gruppe.id}
                />
                {offen
                  ? gruppe.tasks.map((task) => {
                      index += 1
                      return (
                        <MobileTaskRow
                          key={task.id}
                          task={task}
                          drag={drag}
                          onOpen={onOpenTask}
                          isDragging={drag.draggingId === task.id}
                          gruppeId={gruppe.id}
                          currentUserId={currentUserId}
                        />
                      )
                    })
                  : null}
              </div>
            )
          })
        : flach.map((task) => {
            index += 1
            return (
              <MobileTaskRow
                key={task.id}
                task={task}
                drag={drag}
                onOpen={onOpenTask}
                isDragging={drag.draggingId === task.id}
                gruppeId={OHNE_BEREICH}
                currentUserId={currentUserId}
              />
            )
          })}
      {/*
        Die schwebende Kopie unter dem Finger. Sie liegt fest im Fenster, damit
        sie nicht mitscrollt, und nimmt keine Zeigerereignisse an – sonst
        blockierte sie die Zeile, die den Zug führt.
      */}
      {klonTask && drag.klon ? (
        <div
          aria-hidden="true"
          data-testid="drag-clone"
          className="pointer-events-none fixed z-50"
          style={{ left: drag.klon.left, top: drag.klon.top, width: drag.klon.width }}
        >
          <ul className="shadow-lg shadow-page/50">
            <MobileTaskRow
              task={klonTask}
              drag={drag}
              onOpen={onOpenTask}
              isDragging
              gruppeId={OHNE_BEREICH}
              currentUserId={currentUserId}
              klon
            />
          </ul>
        </div>
      ) : null}
    </div>
  )
}

function MobileTaskRow({
  task,
  drag,
  onOpen,
  isDragging,
  gruppeId,
  currentUserId,
  klon = false,
}: {
  task: LocalTask
  drag: ReorderDrag
  onOpen: (task: LocalTask) => void
  isDragging: boolean
  /** Der Gruppenschluessel – das Ziehen liest daraus die Zugehoerigkeit. */
  gruppeId: string
  currentUserId: string
  /** Die schwebende Kopie: ohne Zieh-Griffe, ohne Kennung, ohne Zeigerereignisse. */
  klon?: boolean
}) {
  const { repositories } = useWorkspace()
  const { offerUndo } = useUndo()
  const handlers = klon ? {} : drag.getRowHandlers(task.id)

  return (
    <li
      data-task-row={klon ? undefined : true}
      data-id={klon ? undefined : task.id}
      data-gruppe={klon ? undefined : gruppeId}
      data-flip-id={klon ? undefined : task.id}
      /*
       * Die gezogene Zeile bleibt blass an ihrem Platz stehen: Sie zeigt damit
       * die Lücke, in der die Aufgabe landen würde. Die schwebende Kopie unter
       * dem Finger zeigt sie selbst.
       */
      className={`flex items-start gap-3 border-b border-line-soft ${appBackground} px-4 py-3 ${
        klon ? layer.row + ' shadow-lg shadow-page/50' : isDragging ? 'opacity-25' : ''
      }`}
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
