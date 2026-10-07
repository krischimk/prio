import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
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
 *   1. Keine Palettenklassen in Komponenten – Farben sind Rollen aus
 *      `src/index.css` (`text-ink-muted`, `bg-surface`, `border-line`).
 *   2. Keine Hex-Farben in Komponenten.
 *   3. Status- und Gefahrfarben stehen genau einmal (`src/ui/styles.ts`).
 *   4. Datum und Uhrzeit werden nur über die gemeinsame Funktion formatiert.
 *   5. Knopfgrößen und -arten werden gewählt, nicht angehängt.
 *
 * Früher stand hier, die Stufen der Tailwind-Skala (`text-neutral-400`)
 * auszunehmen: „derselbe Wert ergibt dieselben Pixel“. Das galt, solange es
 * einen Modus gab. Mit Rollen ist derselbe Wert eben **nicht** mehr derselbe,
 * und genau daran hing der Umbau: rund 230 Stellen in 26 Dateien.
 *
 * Siehe `AGENTS.md`, Abschnitt „Oberfläche“.
 */

// Vitest läuft mit dem Projektverzeichnis als Arbeitsverzeichnis; `import.meta.url`
// ist unter jsdom keine Datei-URL.
const PROJECT_ROOT = process.cwd()
/**
 * Geprüft wird ganz `src`, nicht nur `src/ui`.
 *
 * `src/App.tsx` und `src/app/WorkspaceProvider.tsx` trugen eigene Farbklassen,
 * und der Test las sie nie – die Regel galt dort ungeprüft. Ein Verstoß in
 * `src/app` ist derselbe Verstoß.
 */
const SOURCE_DIR = join(PROJECT_ROOT, 'src')
const UI_DIR = join(SOURCE_DIR, 'ui')
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

const sourceFiles = collectSourceFiles(SOURCE_DIR)

describe('UI-Konventionen', () => {
  it('findet die Quelldateien', () => {
    // Schützt den Test davor, bei einem falschen Pfad stillschweigend
    // durchzulaufen.
    expect(sourceFiles.length).toBeGreaterThan(10)
  })

  it('nennt in Komponenten keine Palettenfarbe, sondern eine Rolle', () => {
    const treffer = findMatches(
      sourceFiles.filter((file) => file !== STYLES_FILE),
      /(?:bg|text|border|ring|outline|divide|placeholder|accent|fill|stroke|shadow|from|to|via)-(?:neutral|indigo|red|emerald|amber|white|black|slate|gray|zinc|stone)-?[0-9/]*/,
    )

    expect(
      treffer,
      'Farben sind Rollen aus src/index.css (bg-surface, text-ink-muted, border-line, text-danger …). Ein Palettenschritt in einer Komponente macht den zweiten Modus zum Umbau jeder Datei.',
    ).toEqual([])
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
  it('baut Knöpfe nur in den Bausteinen zusammen', () => {
    // `buttonClass` ist die Werkbank der Bausteine (`src/ui/components/`). In
    // einer Komponente heißt es `<Button variant="ghost" size="sm">`; die
    // Zeichenkette dort wieder zusammenzusetzen war genau der Fehler, der 22
    // „kompakte" Knöpfe ohne Wirkung erzeugt hat.
    const treffer = findMatches(
      sourceFiles.filter((file) => !file.includes(`${sep}components${sep}`) && file !== STYLES_FILE),
      /buttonClass\s*\(/,
    )

    expect(
      treffer,
      'In Komponenten den Baustein benutzen (src/ui/components/Button, IconButton); `buttonClass` gehört in die Bausteine.',
    ).toEqual([])
  })

  it('nutzt `layout` nur für Layout, nicht für Größe oder Farbe', () => {
    const treffer = findMatches(
      sourceFiles,
      /layout="[^"]*(?:(?:p|px|py|pt|pb|pl|pr)-[0-9.]|rounded(?:-[a-z0-9]+)?|text-(?:xs|sm|base|lg|xl)|bg-[a-z]+-[0-9]|text-[a-z]+-[0-9]|border-[a-z]+-[0-9])/,
    )

    expect(
      treffer,
      'Größe und Art kommen aus `variant`/`size`; `layout` ist für Breite, Außenabstand und Ausrichtung da.',
    ).toEqual([])
  })

  /**
   * `text-[11px]` skaliert nicht mit der Systemschrift – es ist ein Pixelwert.
   * Elf Pixel gab es an vier Stellen (Abschnittskopf, „Mehr", Code-Chip, mobiler
   * Aufgabentitel); sie gehen in `text-label` bzw. `text-title` auf.
   */
  it('nutzt für Schriftgrößen die Rollen statt willkürlicher Werte', () => {
    const treffer = findMatches(
      sourceFiles.filter((file) => file !== STYLES_FILE),
      /text-\[\d+(?:\.\d+)?(?:px|rem|em)\]/,
    )

    expect(
      treffer,
      'Schriftgrößen sind Rollen aus src/index.css (text-label, text-meta, text-body, text-title, text-heading, text-display).',
    ).toEqual([])
  })

  it('setzt wechselnde Zahlen über die gemeinsame Konstante in feste Breite', () => {
    // P19: Ein Zähler oder ein Datum springt, wenn die Ziffern unterschiedlich
    // breit sind. `tabular-nums` gehört deshalb in eine Konstante, nicht in
    // jede Komponente einzeln – sonst hat die Regel so viele Fassungen wie
    // Aufrufer.
    const treffer = findMatches(
      sourceFiles.filter((file) => file !== STYLES_FILE),
      /tabular-nums/,
    )

    expect(
      treffer,
      'Zahlen in fester Breite kommen aus `numeric` (src/ui/styles.ts), nicht als Klasse in die Komponente.',
    ).toEqual([])
    expect(readFileSync(STYLES_FILE, 'utf8')).toContain("export const numeric = 'tabular-nums'")
  })

  it('zählt offene Aufgaben nur an einer Stelle', () => {
    // Nur **Text in der Oberfläche** zählt, also ein Zeichenketten-Literal.
    // Ein Satz in einem Kommentar („eine offene Aufgabe verstummt …“) ist keine
    // zweite Formulierung und darf die Regel nicht auslösen.
    const treffer = findMatches(
      sourceFiles.filter((file) => file !== TASK_COUNT_FILE),
      /['"`][^'"`]*offene Aufgaben?[^'"`]*['"`]/,
    )

    expect(
      treffer,
      'Beide Ansichten zeigen denselben Zähler. Text kommt aus formatOpenTasks in src/ui/taskCount.ts.',
    ).toEqual([])
  })
})
