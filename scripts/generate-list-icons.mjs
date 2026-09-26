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
/**
 * Die Auswahl in thematischen Gruppen.
 *
 * Die Gruppen werden in der Oberfläche als Überschriften gezeigt – deshalb
 * stehen sie hier und nicht nur als Kommentar. Reihenfolge der Gruppen und
 * der Symbole darin bestimmt die Anzeige.
 */
const GRUPPEN = [
  ['Alltag und Haushalt', [
    ['std:check', 'Erledigt', 'lucide', 'check'],
    ['std:star', 'Wichtig', 'mdi', 'star-outline'],
    ['std:heart', 'Favoriten', 'mdi', 'heart-outline'],
    ['std:flag', 'Merken', 'lucide', 'flag'],
    ['std:home', 'Haushalt', 'mdi', 'home-outline'],
    ['std:shopping', 'Einkauf', 'mdi', 'cart-outline'],
    ['std:money', 'Finanzen', 'mdi', 'cash'],
    ['std:hanger', 'Kleidung', 'mdi', 'hanger'],
    ['std:shirt', 'T-Shirt', 'lucide', 'shirt'],
    ['std:cleaning', 'Putzen', 'lucide', 'broom-sparkles'],
    ['std:garden', 'Garten', 'lucide', 'shovel'],
    ['std:plant', 'Pflanzen', 'lucide', 'plant-pot'],
  ]],
  ['Arbeit und Lernen', [
    ['std:work', 'Arbeit', 'mdi', 'briefcase-outline'],
    ['std:graduation', 'Studium', 'lucide', 'graduation-cap'],
    ['std:study', 'Lernen', 'mdi', 'book-open-variant-outline'],
    ['std:notebook', 'Notizbuch', 'mdi', 'notebook-outline'],
    ['std:pencil', 'Stift', 'lucide', 'pencil'],
    ['std:scroll', 'Schriftstück', 'mdi', 'feather'],
    ['std:checklist', 'Checkliste', 'mdi', 'checkbox-multiple-marked-outline'],
    ['std:deadlines', 'Fristen', 'mdi', 'clipboard-clock-outline'],
  ]],
  ['Computer', [
    ['std:code', 'Programmieren', 'lucide', 'code-xml'],
    ['std:terminal', 'Konsole', 'mdi', 'console'],
    ['std:server', 'Server', 'mdi', 'server-outline'],
    ['std:computer', 'Computer', 'mdi', 'monitor'],
    ['std:cloud', 'Cloud', 'mdi', 'cloud-outline'],
    ['std:tree', 'Baum', 'lucide', 'folder-tree'],
    ['std:graph', 'Graph', 'lucide', 'network'],
    ['std:math', 'Mathematik', 'mdi', 'calculator-variant-outline'],
  ]],
  ['Menschen und Termine', [
    ['std:calendar', 'Termine', 'mdi', 'calendar-outline'],
    ['std:people', 'Personen', 'lucide', 'user'],
    ['std:group', 'Gruppe', 'lucide', 'users'],
    ['std:medical', 'Gesundheit', 'mdi', 'hospital-box-outline'],
    ['std:megaphone', 'Ankündigung', 'mdi', 'bullhorn-outline'],
  ]],
  ['Kochen und Feiern', [
    ['std:chef', 'Kochen', 'lucide', 'chef-hat'],
    ['std:food', 'Essen', 'lucide', 'utensils'],
    ['std:birthday', 'Geburtstag', 'mdi', 'cake-variant-outline'],
    ['std:gift', 'Geschenk', 'lucide', 'gift'],
  ]],
  ['Freizeit und Natur', [
    ['std:sport', 'Sport', 'lucide', 'dumbbell'],
    ['std:climb', 'Klettern', 'mdi', 'carabiner'],
    ['std:travel', 'Reise', 'lucide', 'plane'],
    ['std:car', 'Auto', 'mdi', 'car-outline'],
    ['std:sailing', 'Segeln', 'mdi', 'sail-boat'],
    ['std:mountain', 'Berge', 'mdi', 'image-filter-hdr-outline'],
    ['std:stone', 'Fels', 'lucide', 'stone'],
  ]],
  ['Musik und Kultur', [
    ['std:music', 'Musik', 'lucide', 'music'],
    ['std:piano', 'Klavier', 'mdi', 'piano'],
    ['std:chess', 'Schach', 'lucide', 'chess-queen'],
    ['std:art', 'Kunst', 'mdi', 'palette-outline'],
    ['std:translate', 'Sprache', 'mdi', 'translate'],
    ['std:japan', 'Japan', 'tabler', 'torii'],
    ['std:sewing', 'Nähen', 'tabler', 'needle-thread'],
    ['std:ideas', 'Ideen', 'mdi', 'lightbulb-outline'],
  ]],
  ['Sonstiges', [
    ['std:suitcase', 'Koffer', 'mdi', 'bag-suitcase-outline'],
    ['std:flash', 'Blitz', 'lucide', 'zap'],
    ['std:refresh', 'Wiederholen', 'lucide', 'refresh-cw'],
    ['std:search', 'Suche', 'mdi', 'magnify'],
    ['std:send', 'Senden', 'lucide', 'send'],
    ['std:tools', 'Werkzeug', 'lucide', 'wrench'],
    ['std:hammer-sickle', 'Hammer und Sichel', 'mdi', 'hammer-sickle'],
    ['std:folder', 'Sonstiges', 'mdi', 'folder-outline'],
  ]],
]

/** Alle Einträge flach, jeweils mit ihrer Gruppe. */
const AUSWAHL = GRUPPEN.flatMap(([gruppe, eintraege]) =>
  eintraege.map(([id, label, sammlung, name]) => ({ id, label, sammlung, name, gruppe })),
)/** Liest Pfade, Zeichenart und Raster eines Symbols. */
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

const eintraege = AUSWAHL.map(({ id, label, sammlung, name, gruppe }) => {
  const { pfade, gefuellt, viewBox } = symbolLesen(sammlung, name)
  const liste = pfade.map((d) => `      '${d}',`).join('\n')
  // Das übliche Raster wird nicht wiederholt – es ist die Vorgabe der App.
  const raster = viewBox === '0 0 24 24' ? '' : `    viewBox: '${viewBox}',\n`

  return `  {
    id: '${id}',
    label: '${label}',
    source: '${sammlung}/${name}',
    group: '${gruppe}',
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
