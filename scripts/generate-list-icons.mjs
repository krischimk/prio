#!/usr/bin/env node
/**
 * Erzeugt `src/ui/listIconsMdi.ts` aus mehreren Symbolsammlungen.
 *
 * Nicht zu verwechseln mit `generate-icons.mjs` – das erzeugt die PWA-Icons.
 *
 * Warum fremde Symbole: Von Hand gezeichnete Symbole für Motive wie Bagger,
 * Schachfigur oder Violine werden auf 24 Pixeln zu Klecksen. Die Sammlungen
 * liefern sie in gleichbleibender Qualität.
 *
 * Warum die Datei trotzdem im Repository liegt: Zur Laufzeit soll die App
 * keine Fremdquelle kennen. Erzeugt wird einmal, gepflegt wird das Ergebnis.
 * Die Pakete sind deshalb nur Entwicklungabhängigkeiten.
 *
 * Aufruf: npm run icons:generate
 *
 * Lizenzen: MIT, ISC und Apache-2.0 – alle verlangen nur den Lizenztext, keine
 * sichtbare Namensnennung. Die Texte liegen in THIRD-PARTY.md; beim Ändern der
 * Liste dort nichts vergessen.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { svgAnalysieren } from './svgShapes.mjs'

const WURZEL = join(dirname(fileURLToPath(import.meta.url)), '..')
const ZIEL = join(WURZEL, 'src/ui/listIconsMdi.ts')

/** Wo die Symbole der einzelnen Sammlungen liegen. */
const SAMMLUNGEN = {
  mdi: { paket: '@mdi/svg', ordner: 'svg' },
  lucide: { paket: 'lucide-static', ordner: 'icons' },
  tabler: { paket: '@tabler/icons', ordner: 'icons/outline' },
}

/**
 * Die Auswahl: Kennung, Beschriftung, Sammlung, Name in der Sammlung.
 *
 * Die Reihenfolge bestimmt die Anzeige in der Auswahl.
 */
const AUSWAHL = [
  // Haushalt und Alltag
  ['std:suitcase', 'Koffer', 'mdi', 'bag-suitcase-outline'],
  ['std:computer', 'Computer', 'mdi', 'monitor'],
  ['std:graduation', 'Studium', 'mdi', 'school-outline'],
  ['std:gift', 'Geschenk', 'mdi', 'gift-outline'],
  ['std:code', 'Programmieren', 'mdi', 'code-tags'],
  ['std:terminal', 'Konsole', 'mdi', 'console'],
  ['std:tools', 'Werkzeug', 'mdi', 'wrench-outline'],
  ['std:pencil', 'Stift', 'mdi', 'pencil-outline'],
  ['std:search', 'Suche', 'mdi', 'magnify'],
  ['std:medical', 'Gesundheit', 'mdi', 'hospital-box-outline'],
  ['std:refresh', 'Wiederholen', 'mdi', 'reload'],
  ['std:server', 'Server', 'mdi', 'server-outline'],
  ['std:notebook', 'Notizbuch', 'mdi', 'notebook-outline'],
  ['std:car', 'Auto', 'mdi', 'car-outline'],
  ['std:shirt', 'T-Shirt', 'mdi', 'tshirt-crew-outline'],
  ['std:hanger', 'Kleidung', 'mdi', 'hanger'],
  ['std:money', 'Finanzen', 'mdi', 'cash'],
  ['std:megaphone', 'Ankündigung', 'mdi', 'bullhorn-outline'],
  ['std:checklist', 'Checkliste', 'mdi', 'checkbox-multiple-marked-outline'],
  ['std:group', 'Gruppe', 'mdi', 'account-multiple-outline'],
  ['std:birthday', 'Geburtstag', 'mdi', 'cake-variant-outline'],

  // Freizeit und Natur
  ['std:strings', 'Streichinstrument', 'mdi', 'violin'],
  ['std:piano', 'Klavier', 'mdi', 'piano'],
  ['std:chess', 'Schach', 'lucide', 'chess-queen'],
  ['std:sailing', 'Segeln', 'mdi', 'sail-boat'],
  ['std:plant', 'Pflanzen', 'lucide', 'plant-pot'],
  ['std:garden', 'Garten', 'lucide', 'shovel'],
  ['std:climb', 'Klettern', 'mdi', 'carabiner'],
  ['std:stone', 'Fels', 'lucide', 'stone'],
  ['std:mountain', 'Berge', 'mdi', 'image-filter-hdr-outline'],

  // Handwerk und Tätigkeiten
  ['std:sewing', 'Nähen', 'tabler', 'needle-thread'],
  ['std:cleaning', 'Putzen', 'lucide', 'broom-sparkles'],
  ['std:art', 'Kunst', 'mdi', 'palette-outline'],
  ['std:math', 'Mathematik', 'mdi', 'calculator-variant-outline'],
  ['std:chef', 'Kochen', 'mdi', 'chef-hat'],
  ['std:tree', 'Baum', 'mdi', 'file-tree-outline'],
  ['std:hammer-sickle', 'Hammer und Sichel', 'mdi', 'hammer-sickle'],
  ['std:scroll', 'Schriftstück', 'mdi', 'feather'],
  ['std:graph', 'Graph', 'mdi', 'graph-outline'],

  // Unterwegs und Austausch
  ['std:send', 'Senden', 'lucide', 'send'],
  ['std:translate', 'Sprache', 'mdi', 'translate'],
]

/** Liest Pfade, Zeichenart und Raster eines Symbols. */
function symbolLesen(sammlung, name) {
  const { paket, ordner } = SAMMLUNGEN[sammlung]
  const datei = join(WURZEL, 'node_modules', paket, ordner, `${name}.svg`)

  let inhalt
  try {
    inhalt = readFileSync(datei, 'utf8')
  } catch {
    throw new Error(`Nicht gefunden: ${paket}/${ordner}/${name}.svg`)
  }

  const { pfade, gefuellt, viewBox } = svgAnalysieren(inhalt)
  if (pfade.length === 0) throw new Error(`Keine zeichenbare Form in ${name}.svg`)
  return { pfade, gefuellt, viewBox }
}

const eintraege = AUSWAHL.map(([id, label, sammlung, name]) => {
  const { pfade, gefuellt, viewBox } = symbolLesen(sammlung, name)
  const liste = pfade.map((d) => `      '${d}',`).join('\n')
  // Das übliche Raster wird nicht wiederholt – es ist die Vorgabe der App.
  const raster = viewBox === '0 0 24 24' ? '' : `    viewBox: '${viewBox}',\n`

  return `  {
    id: '${id}',
    label: '${label}',
    source: '${sammlung}/${name}',
${gefuellt ? '    filled: true,\n' : ''}${raster}    paths: [
${liste}
    ],
  },`
}).join('\n')

const inhalt = `import type { ListIconDefinition } from './listIcons'

/**
 * Listensymbole aus fremden Sammlungen.
 *
 * **Erzeugte Datei – nicht von Hand bearbeiten.** Quelle ist
 * \`scripts/generate-list-icons.mjs\` (npm run icons:generate). Die Lizenztexte
 * liegen in THIRD-PARTY.md.
 *
 * Warum fremde Symbole: Von Hand gezeichnete Symbole für Motive wie
 * Schachfigur, Violine oder Bagger werden auf 24 Pixeln zu Klecksen. Hier
 * kommen sie in gleichbleibender Qualität – und weil das Ergebnis im Repository
 * liegt, kennt die App zur Laufzeit keine Fremdquelle.
 *
 * Je Symbol ist vermerkt, ob es als Strich oder als Fläche zu zeichnen ist und
 * auf welchem Raster es liegt: Lucide und Tabler zeichnen Striche, Material
 * Design Icons Flächen, und nicht jede Sammlung zeichnet auf 24×24.
 */
export const LIST_ICONS_MDI: ListIconDefinition[] = [
${eintraege}
]
`

writeFileSync(ZIEL, inhalt)
console.log(`${AUSWAHL.length} Symbole nach ${ZIEL} geschrieben.`)
