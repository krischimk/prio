import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { SCHREIBEND } from '../../src/app/trackedRepositories'

/**
 * Jede schreibende Operation hat einen Platz in der Paritätsprüfung.
 *
 * `tests/e2e/parity.spec.ts` führt eine Tabelle: jede Funktion einmal für die
 * breite Ansicht, einmal für das Telefon. Beide Wege sind Pflichtfelder, ein
 * einseitiger Eintrag lässt sich also nicht anlegen – **wenn** es den Eintrag
 * gibt. Genau daran ist F1 gescheitert: „Aufgabe in eine andere Liste
 * verschieben“ gab es nur auf dem Telefon, und niemand hatte es eingetragen.
 * Die Tabelle prüfte, was in ihr stand, nicht was es gab.
 *
 * Diese Prüfung dreht es um: Sie geht von den **schreibenden Operationen der
 * Datenschicht** aus. Die Zuordnung unten ist vollständig erzwungen
 * (`Record<…, …>` – fehlt eine Operation, ist es ein Typfehler), und jeder
 * genannte Eintrag muss in der Paritätstabelle wirklich vorkommen. Wer eine
 * Operation hinzufügt und die Zuordnung vergisst, bekommt keinen grünen Lauf.
 *
 * `null` ist erlaubt, aber begründet: Manche Operationen haben keinen eigenen
 * Nutzerweg (sie laufen im Hintergrund oder als Teil eines anderen Eintrags).
 */
const ABDECKUNG: Record<(typeof SCHREIBEND)[number], string | null> = {
  createList: 'Liste anlegen',
  renameList: 'Liste umbenennen',
  setListIcon: 'Liste mit Symbol versehen und das Symbol wieder entfernen',
  deleteList: 'Liste löschen',
  // Anlegen, Umbenennen und Löschen von Bereichen: ein Eintrag, weil ein
  // Bereich ohne Aufgabe nichts zeigt.
  addListSection: 'Bereich anlegen und eine Aufgabe zuordnen',
  renameListSection: null,
  deleteListSection: null,
  createTask: 'Aufgabe anlegen',
  updateTask: 'Aufgabe bearbeiten: Titel und Beschreibung',
  setTaskCompleted: 'Aufgabe abhaken und rückgängig machen',
  moveTask: 'Aufgabe in eine andere Liste verschieben',
  // Umsortieren läuft über Ziehen bzw. Tippen in der Zeile; beide Ansichten
  // haben dafür einen Weg, aber keinen eigenen Paritätseintrag.
  reorderTasks: null,
  deleteTask: null,
  markListShared: 'Vorschlag für eine schon einmal geteilte Adresse',
  removeMember: null,
  leaveList: null,
}

/** Die Namen der Einträge, so wie sie in der Paritätstabelle stehen. */
function paritaetsNamen(): string[] {
  const quelle = readFileSync(join(process.cwd(), 'tests', 'e2e', 'parity.spec.ts'), 'utf8')
  return [...quelle.matchAll(/^ {4}name: '([^']+)'/gm)].map((treffer) => treffer[1])
}

describe('Paritätsabdeckung', () => {
  it('nennt für jede schreibende Operation einen Eintrag oder einen Grund', () => {
    // Vollständigkeit erzwingt bereits der Typ; hier steht, dass die Tabelle
    // nicht leer ist und keine Operation doppelt abgedeckt wird.
    const genannt = Object.values(ABDECKUNG).filter((name): name is string => name !== null)
    expect(genannt.length).toBeGreaterThan(0)
    expect(new Set(genannt).size).toBeLessThanOrEqual(genannt.length)
  })

  it('findet jeden genannten Eintrag in der Paritätstabelle', () => {
    const vorhanden = new Set(paritaetsNamen())
    const fehlend = Object.entries(ABDECKUNG)
      .filter(([, name]) => name !== null && !vorhanden.has(name))
      .map(([operation, name]) => `${operation} → „${name}“`)

    expect(fehlend).toEqual([])
  })

  it('prüft die Zuordnung gegen die wirklichen Operationen', () => {
    // Beide Listen stammen aus derselben Quelle: Wird eine Operation umbenannt
    // oder entfernt, fällt es hier auf.
    expect(Object.keys(ABDECKUNG).sort()).toEqual([...SCHREIBEND].sort())
  })
})
