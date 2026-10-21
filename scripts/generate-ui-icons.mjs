#!/usr/bin/env node
/** UI-Auswahl aus den bereits verwendeten Sammlungen; Lizenztexte: THIRD-PARTY.md. */
import { readFileSync, writeFileSync } from 'node:fs'
import { svgAnalysieren } from './svgShapes.mjs'
const sources = {
  Effort: ['lucide-static/icons', 'weight'], Trash: ['lucide-static/icons', 'trash'],
  RemoveFormatting: ['lucide-static/icons', 'remove-formatting'], User: ['lucide-static/icons', 'user'],
  Calendar: ['lucide-static/icons', 'calendar'], Settings: ['lucide-static/icons', 'sliders-horizontal'],
  Eraser: ['lucide-static/icons', 'eraser'], Share: ['lucide-static/icons', 'share-2'], Edit: ['lucide-static/icons', 'pencil'],
  Tag: ['@mdi/svg/svg', 'tag-outline'], Checklist: ['@mdi/svg/svg', 'format-list-checks'],
  BulletList: ['@mdi/svg/svg', 'format-list-bulleted'], NumberedList: ['@mdi/svg/svg', 'format-list-numbered'],
  Markdown: ['@mdi/svg/svg', 'language-markdown-outline'],
  Theme: ['lucide-static/icons', 'sun-moon'],
  Link: ['@mdi/svg/svg', 'link-variant'], Restore: ['@mdi/svg/svg', 'history'], Sync: ['@mdi/svg/svg', 'sync'],
  EyeOff: ['@mdi/svg/svg', 'eye-off-outline'], IconChoice: ['@mdi/svg/svg', 'shape-plus-outline'],
}
const paths = Object.fromEntries(Object.entries(sources).map(([key, [directory, name]]) => {
  const svg = svgAnalysieren(readFileSync(new URL(`../node_modules/${directory}/${name}.svg`, import.meta.url), 'utf8'))
  if (!svg.pfade.length || svg.viewBox !== '0 0 24 24') throw new Error(`Unbrauchbares Symbol: ${name}`)
  return [key, { paths: svg.pfade, filled: svg.gefuellt }]
}))
writeFileSync(new URL('../src/ui/actionIconPaths.ts', import.meta.url), '// Erzeugt mit node scripts/generate-ui-icons.mjs; Quellen und Lizenzen in THIRD-PARTY.md.\nexport const actionIconPaths = ' + JSON.stringify(paths, null, 2) + ' as const\n')
