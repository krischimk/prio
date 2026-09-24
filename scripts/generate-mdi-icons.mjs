#!/usr/bin/env node
/**
 * Erzeugt `src/ui/listIconsMdi.ts` aus dem Paket `@mdi/svg`.
 *
 * Warum ein Skript und keine Handarbeit: Von Hand gezeichnete Symbole für
 * Motive wie „Bagger" oder „Schachfigur" werden auf 24 Pixeln zu Klecksen.
 * Material Design Icons liefert sie in gleichbleibender Qualität.
 *
 * Warum die Datei trotzdem im Repository liegt: Zur Laufzeit soll die App
 * keine Fremdquelle kennen. Erzeugt wird einmal, gepflegt wird das Ergebnis.
 * `@mdi/svg` ist deshalb nur eine Entwicklungabhängigkeit.
 *
 * Aufruf: npm run icons:generate
 *
 * Lizenz: Material Design Icons stehen unter Apache-2.0. Der Lizenztext liegt
 * in THIRD-PARTY.md; beim Ändern der Liste dort nichts vergessen.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const WURZEL = join(dirname(fileURLToPath(import.meta.url)), '..')
const QUELLE = join(WURZEL, 'node_modules/@mdi/svg/svg')
const ZIEL = join(WURZEL, 'src/ui/listIconsMdi.ts')

/** Kennung, Beschriftung, Name im MDI-Paket – in dieser Reihenfolge. */
const AUSWAHL = [
  ['std:suitcase', 'Koffer', 'bag-suitcase-outline'],
  ['std:computer', 'Computer', 'monitor'],
  ['std:graduation', 'Studium', 'school-outline'],
  ['std:gift', 'Geschenk', 'gift-outline'],
  ['std:code', 'Programmieren', 'code-tags'],
  ['std:terminal', 'Konsole', 'console'],
  ['std:tools', 'Werkzeug', 'wrench-outline'],
  ['std:pencil', 'Stift', 'pencil-outline'],
  ['std:search', 'Suche', 'magnify'],
  // Ein Kasten mit Kreuz ist als „Gesundheit“ klarer als eine Arzttasche.
  ['std:medical', 'Gesundheit', 'hospital-box-outline'],
  ['std:refresh', 'Wiederholen', 'reload'],
  ['std:shovel', 'Garten', 'shovel'],
  ['std:server', 'Server', 'server'],
  ['std:notebook', 'Notizbuch', 'notebook-outline'],
  ['std:send', 'Senden', 'send-outline'],
  ['std:car', 'Auto', 'car-outline'],
  ['std:cleaning', 'Putzen', 'spray-bottle'],
  ['std:strings', 'Streichinstrument', 'violin'],
  ['std:piano', 'Klavier', 'piano'],
  ['std:needle', 'Nähen', 'needle'],
  ['std:hanger', 'Kleidung', 'hanger'],
  ['std:money', 'Finanzen', 'cash'],
  ['std:megaphone', 'Ankündigung', 'bullhorn-outline'],
  ['std:chess', 'Schach', 'chess-knight'],
  ['std:sailing', 'Segeln', 'sail-boat'],
  ['std:translate', 'Sprache', 'translate'],
  ['std:graph', 'Graph', 'graph-outline'],
  ['std:excavator', 'Bagger', 'excavator'],
  ['std:math', 'Mathematik', 'calculator-variant-outline'],
  ['std:chef', 'Kochen', 'chef-hat'],
  ['std:tree', 'Baum', 'file-tree-outline'],
  ['std:hammer-sickle', 'Hammer und Sichel', 'hammer-sickle'],
  ['std:plant', 'Pflanzen', 'sprout'],
  ['std:scroll', 'Schriftstück', 'script-text-outline'],
]

/** Liest die Pfade einer MDI-Datei. Sie enthält genau ein `<path>`. */
function pfadeLesen(name) {
  const datei = join(QUELLE, `${name}.svg`)
  let inhalt
  try {
    inhalt = readFileSync(datei, 'utf8')
  } catch {
    throw new Error(`Nicht gefunden: ${name}.svg – gibt es dieses Symbol noch?`)
  }
  const pfade = [...inhalt.matchAll(/\sd="([^"]+)"/g)].map((treffer) => treffer[1])
  if (pfade.length === 0) throw new Error(`Kein Pfad in ${name}.svg`)
  return pfade
}

const eintraege = AUSWAHL.map(([id, label, name]) => {
  const pfade = pfadeLesen(name)
  const liste = pfade.map((d) => `      '${d}',`).join('\n')
  return `  {
    id: '${id}',
    label: '${label}',
    source: '${name}',
    // MDI zeichnet Flächen, nicht Striche.
    filled: true,
    paths: [
${liste}
    ],
  },`
}).join('\n')

const inhalt = `import type { ListIconDefinition } from './listIcons'

/**
 * Listensymbole aus Material Design Icons (Pictogrammers).
 *
 * **Erzeugte Datei – nicht von Hand bearbeiten.** Quelle ist
 * \`scripts/generate-mdi-icons.mjs\` (npm run icons:generate). Die Lizenz
 * (Apache-2.0) liegt in THIRD-PARTY.md.
 *
 * Warum überhaupt fremde Symbole: Motive wie Bagger, Schachfigur oder Violine
 * werden von Hand auf 24 Pixeln zu Klecksen. Hier kommen sie in
 * gleichbleibender Qualität – und weil das Ergebnis im Repository liegt, kennt
 * die App zur Laufzeit keine Fremdquelle.
 *
 * Diese Symbole werden gefüllt gezeichnet, die handgezeichneten gestrichen.
 */
export const LIST_ICONS_MDI: ListIconDefinition[] = [
${eintraege}
]
`

writeFileSync(ZIEL, inhalt)
console.log(`${AUSWAHL.length} Symbole nach ${ZIEL} geschrieben.`)
