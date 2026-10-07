import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * UI-Konventionen (Architekturtest).
 *
 * Dieser Test liest Quelltext statt Verhalten zu prüfen. Das ist Absicht:
 *
 *   Die Regel „gleiche Information wird in beiden Ansichten gleich dargestellt“
 *   lässt sich nicht sinnvoll über Komponenten testen – dafür müsste man Pixel
 *   vergleichen. Wogegen man sich aber absichern kann, ist die Ursache: dass
 *   dieselbe Bedeutung an zwei Stellen eine andere Farbe bekommt.
 *
 * Geprüft wird deshalb nur, was eindeutig ist:
 *   1. Status- und Gefahrfarben stehen genau einmal (`src/ui/styles.ts`).
 *   2. Keine Hex-Farben in Komponenten.
 *   3. Datum und Uhrzeit werden nur über die gemeinsame Funktion formatiert.
 *
 * Was ausdrücklich NICHT geprüft wird: die Stufen der Tailwind-Skala
 * (`text-neutral-400` und so weiter). Derselbe Wert ergibt dieselben Pixel –
 * ein Verbot wäre reine Schikane.
 *
 * Siehe `AGENTS.md`, Abschnitt „Oberfläche“.
 */

// Vitest läuft mit dem Projektverzeichnis als Arbeitsverzeichnis; `import.meta.url`
// ist unter jsdom keine Datei-URL.
const PROJECT_ROOT = process.cwd()
const UI_DIR = join(PROJECT_ROOT, 'src', 'ui')
const STYLES_FILE = join(UI_DIR, 'styles.ts')
const DATETIME_FILE = join(UI_DIR, 'datetime.ts')
const TASK_COUNT_FILE = join(UI_DIR, 'taskCount.ts')

function collectSourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) return collectSourceFiles(full)
    return /\.tsx?$/.test(entry) ? [full] : []
  })
}

/** Findet alle Treffer eines Musters und beschreibt sie als `datei:zeile: text`. */
function findMatches(files: string[], pattern: RegExp): string[] {
  const treffer: string[] = []
  for (const file of files) {
    readFileSync(file, 'utf8')
      .split('\n')
      .forEach((line, index) => {
        // Gemeinsame Flags zurücksetzen, damit `g` bei jedem Aufruf frisch ist.
        const regex = new RegExp(pattern.source, pattern.flags)
        if (regex.test(line)) {
          treffer.push(`${relative(PROJECT_ROOT, file)}:${index + 1}: ${line.trim()}`)
        }
      })
  }
  return treffer
}

const sourceFiles = collectSourceFiles(UI_DIR)

describe('UI-Konventionen', () => {
  it('findet die Quelldateien', () => {
    // Schützt den Test davor, bei einem falschen Pfad stillschweigend
    // durchzulaufen.
    expect(sourceFiles.length).toBeGreaterThan(10)
  })

  it('definiert Status- und Gefahrfarben nur in styles.ts', () => {
    const componentFiles = sourceFiles.filter((file) => file !== STYLES_FILE)
    const treffer = findMatches(componentFiles, /(?:bg|text|border|accent|ring)-(?:emerald|amber|red)-\d{2,3}/)

    expect(
      treffer,
      'Diese Farben tragen eine Bedeutung (ok / ausstehend / Fehler / überfällig) und gehören als Token nach src/ui/styles.ts.',
    ).toEqual([])
  })

  it('enthält keine Hex-Farben in Komponenten', () => {
    const treffer = findMatches(
      sourceFiles.filter((file) => file !== STYLES_FILE),
      /#[0-9a-fA-F]{3,8}\b/,
    )

    expect(treffer, 'Farben gehören als Token nach src/ui/styles.ts oder als CSS-Variable in index.css.').toEqual([])
  })

  it('formatiert Datum und Uhrzeit nur an einer Stelle', () => {
    const treffer = findMatches(
      sourceFiles.filter((file) => file !== DATETIME_FILE),
      /\bformatDateTime\s*\(/,
    )

    expect(
      treffer,
      'Für Fälligkeiten gibt es formatDueLabel in src/ui/datetime.ts – damit beide Ansichten denselben Text zeigen.',
    ).toEqual([])
  })

  /**
   * Tailwind ordnet Padding-Klassen in der Reihenfolge des **Stylesheets**,
   * nicht des Klassenattributs. Ein an `input` angehängtes `px-2` verdrängt
   * das `px-3` deshalb nicht – die Angabe wirkt schlicht nicht.
   *
   * Genau daran ist einmal ein Feld gescheitert: Die Zahlen für Tage, Stunden
   * und Minuten blieben 39 Pixel schmal, und ab drei Ziffern zeigte das Feld
   * nur noch die letzten beiden. Bei einem **Eingabefeld** ist das ein Fehler,
   * weil der Inhalt nicht mehr lesbar ist; bei einem Knopf ändert dieselbe
   * wirkungslose Angabe nur die Außengröße. Geprüft wird deshalb nur das Feld.
   */
  it('ändert die Polsterung von Eingabefeldern nicht durch angehängte Klassen', () => {
    const treffer = findMatches(
      sourceFiles.filter((file) => file !== STYLES_FILE),
      /\$\{input\}\s+(?:p|px|py|pt|pb|pl|pr)-\d/,
    )

    expect(
      treffer,
      'Die angehängte Klasse verdrängt die aus `input` nicht. Eigenen Stil in src/ui/styles.ts anlegen (siehe numberInput).',
    ).toEqual([])
  })

  /**
   * Tailwind ordnet die Utilities in der Reihenfolge des **Stylesheets**, nicht
   * des Klassenattributs. Ein an eine fertige Knopfkonstante gehängtes `px-2`
   * verdrängt deren `px-3` deshalb nicht – im gebauten CSS steht `.px-3` hinter
   * `.px-2`, `.py-2` hinter `.py-1`.
   *
   * Genau daran sind 22 „kompakte“ Knöpfe gescheitert: Sie waren nie kompakt,
   * nur ihre Schrift war kleiner. Größe und Art werden deshalb **gewählt**
   * (`buttonClass('ghost', 'sm')`), nicht angehängt. `extra` bleibt für Layout
   * da – Breite, Außenabstand, Ausrichtung –, und das ist hier erlaubt.
   */
  it('hängt Knopfgrößen und -farben nicht an eine fertige Konstante', () => {
    const namen =
      'button|primaryButton|secondaryButton|ghostButton|ghostButtonMuted|dangerButton|iconButton|iconButtonMuted'
    const verboten =
      '(?:p|px|py|pt|pb|pl|pr)-[0-9.]|rounded(?:-[a-z0-9]+)?|text-(?:xs|sm|base|lg|xl|2xl)|bg-[a-z]+-[0-9]|text-(?:neutral|indigo|red|emerald|amber|white)-[0-9]|border-[a-z]+-[0-9]'
    const treffer = findMatches(
      sourceFiles.filter((file) => file !== STYLES_FILE),
      new RegExp('\\$\\{(?:' + namen + ')\\}\\s+[^`"\']*?(?:' + verboten + ')'),
    )

    expect(
      treffer,
      'Größe und Art kommen aus `buttonClass(variante, groesse)` – angehängte Klassen wirken nicht (siehe styles.ts).',
    ).toEqual([])
  })

  it('zählt offene Aufgaben nur an einer Stelle', () => {
    const treffer = findMatches(
      sourceFiles.filter((file) => file !== TASK_COUNT_FILE),
      /offene Aufgaben?/,
    )

    expect(
      treffer,
      'Beide Ansichten zeigen denselben Zähler. Text kommt aus formatOpenTasks in src/ui/taskCount.ts.',
    ).toEqual([])
  })
})
