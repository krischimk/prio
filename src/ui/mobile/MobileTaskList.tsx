import { useEffect, useMemo, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { restrictToVerticalAxis } from '@dnd-kit/modifiers'
import type { DraggableAttributes } from '@dnd-kit/core'
import type { SyntheticListenerMap } from '@dnd-kit/core/dist/hooks/utilities/useSyntheticListeners'
import { CSS } from '@dnd-kit/utilities'
import { useWorkspace } from '../../app/useWorkspace'
import { useUndo } from '../useUndo'
import type { ListSection, LocalTask } from '../../domain/types'
import { groupTasks } from '../../domain/sections'
import { focusRing, appBackground, layer } from '../styles'
import { leerAufgaben } from '../emptyTexts'
import { TaskDescription } from '../TaskDescription'
import { TaskFacts } from '../TaskFacts'
import { SectionHeader } from '../SectionHeader'
import { useCollapsedSections } from '../collapsedSections'
import { OHNE_BEREICH, ordneUm } from './ordnen'

/**
 * Aufgabenliste der mobilen Ansicht.
 *
 * Bewusst ohne Bearbeiten- und Löschen-Knöpfe: Die Zeile selbst ist der Knopf
 * und öffnet die Detailansicht.
 *
 * **Umsortieren mit dnd-kit.** Die Zeile gedrückt halten (rund 0,4 s), dann
 * ziehen. Die Verdrängung der anderen Zeilen, die schwebende Kopie und das
 * Mitscrollen am Rand kommen aus der Bibliothek – sie macht das seit Jahren und
 * besser, als es von Hand nachzubauen wäre. Auslöser: Die selbstgebauten
 * Animationen waren fehlerhaft.
 *
 * Zwei Dinge bleiben unsere eigene Logik:
 * * **Die Gruppen.** Jeder Bereich ist ein eigener `SortableContext`, ein
 *   leerer Bereich ein eigenes Ablegeziel (`useDroppable`) – nur so lässt sich
 *   dorthin ziehen, wo keine Zeile ist.
 * * **Die Reihenfolge.** Beim Überfahren einer anderen Gruppe wird die Aufgabe
 *   dort eingefügt (`ordneUm`, rein und geprüft) – dieselbe Rechnung wie beim
 *   Loslassen, damit Anzeige und Ergebnis nicht auseinanderlaufen.
 *
 * Kurzes Wischen scrollt weiterhin die Liste: Der Langdruck ist eine
 * Aktivierungsbedingung des Sensors, kein eigener Zeitgeber.
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
  const mitBereichen = sections.length > 0
  // Zugeklappt wird je Liste gemerkt – nicht je Abschnitt, damit der Schlüssel
  // auch dann stimmt, wenn es (noch) keine Bereiche gibt.
  const { zugeklappt, umschalten } = useCollapsedSections(tasks[0]?.list_id ?? '')
  const [aktiv, setAktiv] = useState<string | null>(null)

  /** Der Gruppenschlüssel einer Aufgabe: ihr Bereich oder „ohne Bereich". */
  const gruppeVon = (task: LocalTask) =>
    mitBereichen ? (task.section_id ?? OHNE_BEREICH) : OHNE_BEREICH

  /** Die Gruppen in ihrer Reihenfolge – „ohne Bereich" zuerst. */
  const gruppen = useMemo(
    () => [OHNE_BEREICH, ...sections.map((abschnitt) => abschnitt.id)],
    [sections],
  )

  /*
   * Die Reihenfolge, an der dnd-kit arbeitet: flach, über alle Bereiche.
   * Sie folgt den Daten und wird beim Überfahren einer anderen Gruppe
   * vorübergehend umgestellt – das ist die Vorschau.
   */
  const ausDaten = tasks.map((task) => task.id).join('\u0000')
  const [reihenfolge, setReihenfolge] = useState<string[]>(() => tasks.map((task) => task.id))

  useEffect(() => {
    setReihenfolge((bisher) =>
      bisher.join('\u0000') === ausDaten ? bisher : tasks.map((task) => task.id),
    )
    // `ausDaten` ist die Kennung der Datenlage; die Aufgaben selbst ändern sich
    // mit ihr.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ausDaten])

  const nachId = useMemo(() => new Map(tasks.map((task) => [task.id, task])), [tasks])

  /** In welcher Gruppe liegt eine Kennung – Zeile oder Ablegeziel? */
  const gruppeVonId = (id: string): string => {
    if (id.startsWith('gruppe:')) return id.slice('gruppe:'.length)
    const task = nachId.get(id)
    return task ? gruppeVon(task) : OHNE_BEREICH
  }

  const angezeigt = reihenfolge
    .map((id) => nachId.get(id))
    .filter((task): task is LocalTask => task !== undefined)

  const aktivTask = aktiv === null ? null : (nachId.get(aktiv) ?? null)

  const sensoren = useSensors(
    // Maus: erst nach kurzem Halten ziehen – sonst wäre jeder Klick ein Zug.
    useSensor(PointerSensor, { activationConstraint: { delay: 400, tolerance: 6 } }),
    // Finger: dasselbe, damit ein Wischen die Liste scrollt.
    useSensor(TouchSensor, { activationConstraint: { delay: 400, tolerance: 6 } }),
    // Tastatur: Leertaste hebt auf, Pfeile verschieben, Leertaste legt ab.
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const onDragStart = (event: DragStartEvent) => setAktiv(String(event.active.id))

  /** Beim Überfahren einer anderen Gruppe dorthin umhängen (Vorschau). */
  const onDragOver = (event: DragOverEvent) => {
    const { active, over } = event
    if (!over) return
    const aktiveId = String(active.id)
    const zielGruppe = gruppeVonId(String(over.id))
    if (gruppeVonId(aktiveId) === zielGruppe) return

    setReihenfolge((bisher) =>
      ordneUm({
        eintraege: bisher.map((id) => ({ id })),
        gruppen,
        gruppeVon: (eintrag) => gruppeVonId(eintrag.id),
        gezogeneId: aktiveId,
        ziel: { gruppe: zielGruppe, index: 0 },
      }).map((eintrag) => eintrag.id),
    )
  }

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setAktiv(null)
    if (!over) {
      // Nichts getroffen: zurück auf die Datenlage.
      setReihenfolge(tasks.map((task) => task.id))
      return
    }

    const aktiveId = String(active.id)
    setReihenfolge((bisher) => {
      const neu = ordneUm({
        eintraege: bisher.map((id) => ({ id })),
        gruppen,
        gruppeVon: (eintrag) => gruppeVonId(eintrag.id),
        gezogeneId: aktiveId,
        ziel: {
          gruppe: gruppeVonId(String(over.id)),
          index: bisher.indexOf(String(over.id)),
        },
      }).map((eintrag) => eintrag.id)

      const gleich = neu.join('\u0000') === tasks.map((task) => task.id).join('\u0000')
      const bereichGleich = gruppeVonId(aktiveId) === (nachId.get(aktiveId)?.section_id ?? null)
      if (!gleich || !bereichGleich) {
        const zielGruppe = gruppeVonId(aktiveId)
        onReorder(neu, { [aktiveId]: zielGruppe === OHNE_BEREICH ? null : zielGruppe })
      }
      return neu
    })
  }

  if (tasks.length === 0) {
    return (
      <p className="px-4 py-10 text-center text-body text-ink-faint" data-testid="empty-tasks">
        {leerAufgaben('mobil')}
      </p>
    )
  }

  const nachGruppe = mitBereichen
    ? groupTasks(angezeigt, sections)
    : [{ id: OHNE_BEREICH, section: null, tasks: angezeigt }]

  return (
    <DndContext
      sensors={sensoren}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis]}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={() => {
        setAktiv(null)
        setReihenfolge(tasks.map((task) => task.id))
      }}
    >
      <div data-testid="task-list">
        {nachGruppe.map((gruppe) => {
          const offen = !zugeklappt.has(gruppe.id)
          return (
            <Gruppe
              key={gruppe.id}
              gruppeId={gruppe.id}
              name={gruppe.section?.name ?? 'Ohne Bereich'}
              anzahl={gruppe.tasks.length}
              offen={offen}
              onToggle={() => umschalten(gruppe.id)}
              abschnittId={gruppe.section?.id}
              aufgaben={offen ? gruppe.tasks : []}
              leer={gruppe.tasks.length === 0}
              currentUserId={currentUserId}
              onOpenTask={onOpenTask}
              istAktiv={aktiv}
            />
          )
        })}
      </div>

      {/*
        Die schwebende Kopie: dnd-kit bewegt sie selbst, ohne die Liste neu zu
        zeichnen. Sie nimmt keine Zeigerereignisse an.
      */}
      <DragOverlay>
        {aktivTask ? (
          <ul>
            <MobileTaskRow
              task={aktivTask}
              currentUserId={currentUserId}
              onOpenTask={onOpenTask}
              klon
            />
          </ul>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}

/** Eine Gruppe: Kopf, Ablegeziel für leere Bereiche und die Zeilen. */
function Gruppe({
  gruppeId,
  name,
  anzahl,
  offen,
  onToggle,
  abschnittId,
  aufgaben,
  leer,
  currentUserId,
  onOpenTask,
  istAktiv,
}: {
  gruppeId: string
  name: string
  anzahl: number
  offen: boolean
  onToggle: () => void
  abschnittId?: string
  aufgaben: LocalTask[]
  leer: boolean
  currentUserId: string
  onOpenTask: (task: LocalTask) => void
  istAktiv: string | null
}) {
  /*
   * Ein leeres Ziel je Gruppe: Nur so lässt sich in einen Bereich ziehen, in dem
   * keine Zeile steht – der ganze Bereich einschließlich des Raums unter dem
   * Kopf gehört dazu.
   */
  const { setNodeRef, isOver } = useDroppable({ id: `gruppe:${gruppeId}` })

  return (
    <div ref={setNodeRef}>
      <SectionHeader
        name={name}
        anzahl={anzahl}
        offen={offen}
        onToggle={onToggle}
        className="px-4 pt-3"
        abschnittId={abschnittId}
        gruppe={gruppeId}
        hervorgehoben={isOver}
      />
      {aufgaben.length > 0 ? (
        <SortableContext
          id={gruppeId}
          items={aufgaben.map((task) => task.id)}
          strategy={verticalListSortingStrategy}
        >
          <ul>
            {aufgaben.map((task) => (
              <SortableZeile
                key={task.id}
                task={task}
                currentUserId={currentUserId}
                onOpenTask={onOpenTask}
                istAktiv={istAktiv}
              />
            ))}
          </ul>
        </SortableContext>
      ) : null}
      {leer && aufgaben.length === 0 ? (
        // Der leere Bereich bleibt sichtbar, damit sichtbar ist, wohin man zieht.
        <div className="h-6" data-testid="gruppe-leer" aria-hidden="true" />
      ) : null}
    </div>
  )
}

/** Eine Zeile, die dnd-kit verschieben darf. */
function SortableZeile({
  task,
  currentUserId,
  onOpenTask,
  istAktiv,
}: {
  task: LocalTask
  currentUserId: string
  onOpenTask: (task: LocalTask) => void
  istAktiv: string | null
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  })

  return (
    <MobileTaskRow
      task={task}
      currentUserId={currentUserId}
      onOpenTask={onOpenTask}
      setNodeRef={setNodeRef}
      attributes={attributes}
      listeners={listeners}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      isDragging={isDragging}
      istAktiv={istAktiv}
    />
  )
}

function MobileTaskRow({
  task,
  currentUserId,
  onOpenTask,
  setNodeRef,
  attributes,
  listeners,
  style,
  isDragging = false,
  istAktiv = null,
  klon = false,
}: {
  task: LocalTask
  currentUserId: string
  onOpenTask: (task: LocalTask) => void
  setNodeRef?: (element: HTMLElement | null) => void
  attributes?: DraggableAttributes
  listeners?: SyntheticListenerMap
  style?: React.CSSProperties
  isDragging?: boolean
  istAktiv?: string | null
  /** Die schwebende Kopie: ohne Kennung, ohne Zieh-Griffe, ohne Zeigerereignisse. */
  klon?: boolean
}) {
  const { repositories } = useWorkspace()
  const { offerUndo } = useUndo()

  return (
    <li
      ref={klon ? undefined : setNodeRef}
      data-task-row={klon ? undefined : true}
      data-id={klon ? undefined : task.id}
      style={klon ? undefined : style}
      className={`flex items-start gap-3 border-b border-line-soft ${appBackground} px-4 py-3 ${
        klon ? layer.row + ' shadow-lg shadow-page/50' : isDragging || istAktiv === task.id ? 'opacity-25' : ''
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
        Die Zieh-Griffe und der Klick zum Öffnen liegen auf dem ganzen Bereich
        rechts vom Kästchen – nicht nur auf Titel und Angaben.
      */}
      <div
        /*
         * `attributes` bringt `role="button"` mit. Auf dieser Flaeche liegen
         * aber schon Knoepfe (Titel, „Mehr") – eine Rolle „Knopf" um Knoepfe
         * herum ist falsch und macht Vorlesern wie Tests die Zuordnung unklar.
         * Tastatur und Fokus bleiben erhalten (`tabIndex` kommt weiter aus den
         * Attributen), die Rolle nicht.
         */
        {...(klon ? {} : { ...attributes, role: undefined })}
        {...(klon ? {} : listeners)}
        /* Griff fuer die Tastaturpruefung: dnd-kit legt hier Rolle und
           Fokusierbarkeit ab. */
        data-testid={klon ? undefined : 'task-drag'}
        className="flex min-w-0 flex-1 flex-col text-left"
      >
        <button
          type="button"
          onClick={() => {
            if (isDragging) return
            onOpenTask(task)
          }}
          className={`${focusRing} min-w-0 text-left`}
          data-testid={klon ? undefined : 'task-row'}
        >
          <TaskFacts task={task} currentUserId={currentUserId} dichte="mobil" />
        </button>
        {task.description ? (
          <TaskDescription text={task.description} className="mt-0.5" />
        ) : null}
      </div>
    </li>
  )
}
