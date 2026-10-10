import { useState } from 'react'
import { useWorkspace } from '../app/useWorkspace'
import { parseSections } from '../domain/sections'
import type { LocalList, LocalTask } from '../domain/types'
import { errorMessage, focusRing, mutedText } from './styles'
import { CheckIcon } from './icons'

import { Button } from './components/Button'
import { Sheet } from './components/Sheet'

/**
 * Auswahl der Ziel-Liste beim Verschieben einer Aufgabe – und, wenn die
 * Zielliste Bereiche hat, auch des Bereichs.
 *
 * Zwei Wege hinein: In der breiten Ansicht aus der Aufgabenzeile („Verschieben“),
 * auf dem Telefon aus der Detailansicht.
 *
 * Die Auswahl wirkt **erst mit „Verschieben“**. Vorher wechselte ein Tippen die
 * Liste sofort: Wer sich umentschied und über das Kreuz hinausging, hatte schon
 * verschoben – und in der Auswahl stand weiter die alte Liste als aktuell.
 *
 * Die aktuelle Liste steht **mit** in der Auswahl und ist benannt: Sonst wäre
 * nicht zu sehen, wo die Aufgabe gerade liegt. Angehakt ist dagegen die
 * **gewählte** Liste.
 */
export function MoveTaskSheet({
  task,
  lists,
  onClose,
  onMoved,
}: {
  task: LocalTask
  lists: LocalList[]
  onClose: () => void
  onMoved?: () => void
}) {
  const { repositories } = useWorkspace()
  const [zielListeId, setZielListeId] = useState(task.list_id)
  const [zielAbschnitt, setZielAbschnitt] = useState<string | null>(task.section_id)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const zielListe = lists.find((liste) => liste.id === zielListeId)
  const bereiche = parseSections(zielListe?.sections ?? [])
  const unveraendert = zielListeId === task.list_id && zielAbschnitt === task.section_id

  const waehlen = (liste: LocalList) => {
    setZielListeId(liste.id)
    // Der Bereich der alten Liste gilt in der neuen nicht.
    setZielAbschnitt(liste.id === task.list_id ? task.section_id : null)
  }

  const move = async () => {
    if (busy) return
    if (unveraendert) {
      onClose()
      return
    }
    setBusy(true)
    setError(null)
    try {
      await repositories.moveTask(task.id, zielListeId, zielAbschnitt)
      onMoved?.()
      onClose()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Verschieben fehlgeschlagen.')
      setBusy(false)
    }
  }

  return (
    <Sheet
      name="aufgabe-verschieben"
      label="Aufgabe verschieben"
      title="Verschieben nach"
      subtitle={task.title}
      closeLabel="Verschieben abbrechen"
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          <Button variant="primary" layout="flex-1" disabled={busy} onClick={() => void move()}>
            Verschieben
          </Button>
          <Button variant="ghost" layout="flex-1" onClick={onClose}>
            Abbrechen
          </Button>
        </div>
      }
    >
      {error ? (
        <p role="alert" className={`px-4 py-3 text-body ${errorMessage}`}>
          {error}
        </p>
      ) : null}

      <ul className="pb-2" data-testid="move-targets">
        {lists.map((liste) => {
          const aktuell = liste.id === task.list_id
          const gewaehlt = liste.id === zielListeId
          return (
            <li key={liste.id}>
              <button
                type="button"
                onClick={() => waehlen(liste)}
                disabled={busy}
                aria-current={gewaehlt ? 'true' : undefined}
                className={`${focusRing} flex w-full items-center justify-between gap-2 border-t border-line px-4 py-3 text-left text-body active:bg-raised disabled:opacity-50 ${
                  gewaehlt ? 'text-ink' : 'text-ink-soft'
                }`}
              >
                <span className="truncate">{liste.name}</span>
                {aktuell ? <span className={`text-meta ${mutedText}`}>aktuelle Liste</span> : null}
                {gewaehlt ? <CheckIcon className="h-4 w-4 shrink-0 text-brand-soft" /> : null}
              </button>
            </li>
          )
        })}
      </ul>

      {bereiche.length > 0 ? (
        <div className="border-t border-line px-4 py-3">
          <label className="block text-meta text-ink-soft" htmlFor="move-section">
            Bereich
          </label>
          <select
            id="move-section"
            className={`${focusRing} mt-1 w-full rounded-control border border-line bg-raised px-3 py-2 text-body text-ink`}
            value={zielAbschnitt ?? ''}
            disabled={busy}
            onChange={(event) => setZielAbschnitt(event.target.value === '' ? null : event.target.value)}
          >
            <option value="">Ohne Bereich</option>
            {bereiche.map((bereich) => (
              <option key={bereich.id} value={bereich.id}>
                {bereich.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}
    </Sheet>
  )
}
