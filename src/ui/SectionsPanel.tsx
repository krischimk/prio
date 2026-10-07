import { useState, type FormEvent } from 'react'
import { useWorkspace } from '../app/useWorkspace'
import { parseSections, SECTIONS_MAX, SECTION_NAME_MAX } from '../domain/sections'
import type { LocalList } from '../domain/types'
import { errorMessage, input, mutedText } from './styles'
import { LEER_BEREICHE } from './emptyTexts'
import { Button } from './components/Button'

/**
 * Bereiche einer Liste verwalten: anlegen, umbenennen, löschen.
 *
 * Dieselbe Komponente in beiden Ansichten – im Kopfbereich der breiten Ansicht
 * und in den Listeneinstellungen auf dem Telefon. Ein Bereich ist nichts
 * anderes als ein Name; die Zugehörigkeit einer Aufgabe stellt man in der
 * Aufgabe selbst ein (Formular) oder zieht sie auf dem Telefon hinein.
 */
export function SectionsPanel({ list }: { list: LocalList }) {
  const { repositories } = useWorkspace()
  const sections = parseSections(list.sections)
  const [name, setName] = useState('')
  const [umbenennen, setUmbenennen] = useState<string | null>(null)
  const [neuerName, setNeuerName] = useState('')
  const [fehler, setFehler] = useState<string | null>(null)
  // Solange gespeichert wird, ist der Knopf gesperrt: Zwei schnell
  // hintereinander ausgelöste Aufrufe lesen sonst denselben Listenstand und
  // der zweite überschreibt den ersten – ein Bereich ginge verloren.
  const [speichert, setSpeichert] = useState(false)

  const anlegen = async (event: FormEvent) => {
    event.preventDefault()
    const gewaehlt = name
    // Sofort leeren, nicht erst nach dem Speichern: Sonst trifft die Leerung
    // einen Namen, den man in der Zwischenzeit schon getippt hat – genau daran
    // scheiterte das Anlegen zweier Bereiche kurz hintereinander.
    setName('')

    setSpeichert(true)
    let id: string | null = null
    try {
      id = await repositories.addListSection(list.id, gewaehlt)
    } finally {
      setSpeichert(false)
    }
    if (id === null) {
      setFehler(
        sections.length >= SECTIONS_MAX
          ? `Mehr als ${SECTIONS_MAX} Bereiche gehen nicht.`
          : 'Der Name darf nicht leer sein.',
      )
      setName(gewaehlt)
      return
    }
    setFehler(null)
  }

  const umbenennenSpeichern = async (event: FormEvent, id: string) => {
    event.preventDefault()
    await repositories.renameListSection(list.id, id, neuerName)
    setUmbenennen(null)
  }

  return (
    <div className="space-y-2">
      <p className={`text-meta ${mutedText}`}>
        Bereiche ordnen Aufgaben innerhalb der Liste, etwa „Obst" und „Getränke". Aufgaben ohne
        Bereich stehen oben.
      </p>

      {sections.length === 0 ? (
        <p className={`text-meta ${mutedText}`}>{LEER_BEREICHE}</p>
      ) : (
        <ul className="space-y-1">
          {sections.map((section) => (
            <li key={section.id} className="flex flex-wrap items-center gap-2">
              {umbenennen === section.id ? (
                <form
                  onSubmit={(event) => {
                    void umbenennenSpeichern(event, section.id)
                  }}
                  className="flex flex-1 flex-wrap gap-2"
                  aria-label={`Bereich umbenennen: ${section.name}`}
                >
                  <input
                    value={neuerName}
                    onChange={(event) => setNeuerName(event.target.value)}
                    maxLength={SECTION_NAME_MAX}
                    required
                    aria-label="Neuer Name des Bereichs"
                    className={`${input} min-w-40 flex-1`}
                  />
                  <Button type="submit" variant="primary" size="sm">
                    Speichern
                  </Button>
                  <Button
                    variant="ghost" size="sm"
                    onClick={() => setUmbenennen(null)}
                  >
                    Abbrechen
                  </Button>
                </form>
              ) : (
                <>
                  <span className="min-w-0 flex-1 truncate text-body text-ink">
                    {section.name}
                  </span>
                  <Button
                    variant="ghost" size="sm"
                    onClick={() => {
                      setUmbenennen(section.id)
                      setNeuerName(section.name)
                    }}
                  >
                    Umbenennen
                  </Button>
                  <Button
                   
                    // Der Name steht im Knopf, damit klar ist, was verschwindet.
                    aria-label={`Bereich löschen: ${section.name}`}
                    variant="danger" size="sm"
                    onClick={() => {
                      void repositories.deleteListSection(list.id, section.id)
                    }}
                  >
                    Löschen
                  </Button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={anlegen} className="flex flex-wrap gap-2" aria-label="Bereich anlegen">
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Neuer Bereich"
          maxLength={SECTION_NAME_MAX}
          aria-label="Neuer Bereich"
          className={`${input} min-w-40 flex-1`}
        />
        <Button type="submit" variant="primary" disabled={speichert}>
          Bereich anlegen
        </Button>
      </form>

      {fehler !== null ? <p role="alert" className={errorMessage}>{fehler}</p> : null}
    </div>
  )
}
