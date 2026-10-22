/** Native Darstellung aus den Originalquellen; wird von jedem Gradle-Bau ausgeführt. */
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { build } from 'esbuild'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { svgAnalysieren } from './svgShapes.mjs'

const root = resolve(import.meta.dirname, '..')
async function source(file) {
  const result = await build({ entryPoints: [resolve(root, file)], bundle: true, write: false, platform: 'node', format: 'cjs', jsx: 'automatic', external: ['react', 'react/jsx-runtime'] })
  const module = { exports: {} }
  new Function('require', 'module', 'exports', result.outputFiles[0].text)(createRequire(import.meta.url), module, module.exports)
  return module.exports
}
export async function widgetResources() {
  const css = await readFile(resolve(root, 'src/index.css'), 'utf8')
  const declarations = text => Object.fromEntries([...text.matchAll(/--([\w-]+):\s*([^;]+);/g)].map(match => [match[1], match[2].trim()]))
  const base = declarations(css.slice(css.indexOf('@theme {'), css.indexOf('\n:root {')))
  const light = { ...base }
  // Der erste Block enthält die hellen Rollen; nachfolgende Selektoren überschreiben sie nicht.
  const lightBlock = css.slice(css.indexOf(":root[data-theme='light'] {")); Object.assign(light, declarations(lightBlock.slice(0, lightBlock.indexOf('\n}'))))
  const colorKeys = ['page', 'surface', 'raised', 'line', 'line-soft', 'line-strong', 'ink', 'ink-strong', 'ink-muted', 'ink-faint', 'brand', 'brand-soft', 'brand-ink', 'on-brand', 'danger', 'ok', 'warn', 'priority-start', 'priority-middle', 'priority-end', 'priority-gold', 'priority-silver', 'priority-bronze']
  const colors = values => Object.fromEntries(colorKeys.map(key => {
    const value = values[`color-${key}`]; if (!/^#[\da-f]{6}$/i.test(value ?? '')) throw new Error(`Widget-Farbrolle fehlt: ${key}`)
    return [key, value]
  }))
  const fonts = Object.fromEntries(['label', 'meta', 'body', 'title', 'section'].map(key => [key, parseFloat(base[`text-${key}`]) * 16]))
  const { LIST_ICONS_MDI } = await source('src/ui/listIconsMdi.ts')
  const { WIDGET_PROTOCOL } = await source('src/widgets/model.ts')
  const icons = await source('src/ui/icons.tsx')
  const all = LIST_ICONS_MDI.map(icon => [icon.id, { pfade: icon.paths, gefuellt: icon.filled === true, viewBox: icon.viewBox ?? '0 0 24 24' }])
  for (const name of ['Plus', 'Overview', 'Settings', 'Sync', 'Calendar', 'Checklist', 'Priority', 'BulletList', 'Bell']) {
    const component = icons[`${name}Icon`]; if (!component) throw new Error(`Widget-Symbol fehlt: ${name}`)
    all.push([name, svgAnalysieren(renderToStaticMarkup(createElement(component)))])
  }
  const files = new Map(); const iconNames = {}
  const escape = value => value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;')
  for (let i = 0; i < all.length; i++) {
    const [key, icon] = all[i]; const [, , width, height] = icon.viewBox.split(' ')
    const name = `prio_wi_${i}`; iconNames[key] = name
    files.set(`res/drawable/${name}.xml`, `<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="24dp" android:height="24dp" android:viewportWidth="${width}" android:viewportHeight="${height}">\n${icon.pfade.map(path => `<path android:pathData="${escape(path)}" android:fillColor="${icon.gefuellt ? '#FFFFFFFF' : '#00000000'}"${icon.gefuellt ? '' : ' android:strokeColor="#FFFFFFFF" android:strokeWidth="1.8" android:strokeLineCap="round" android:strokeLineJoin="round"'}/>`).join('\n')}\n</vector>`)
  }
  files.set('assets/widget-design.json', JSON.stringify({ dark: colors(base), light: colors(light), fonts, icons: iconNames }))
  files.set('kotlin/de/krischi/prio/widget/WidgetContract.kt', `package de.krischi.prio.widget\n// Erzeugt aus src/widgets/model.ts.\ninternal object WidgetContract { const val PROTOCOL = ${WIDGET_PROTOCOL} }\n`)
  files.set('res/values/widget_dimensions.xml', `<resources>${Object.entries(fonts).map(([role, size]) => `<dimen name="widget_text_${role}">${size}sp</dimen>`).join('')}</resources>`)
  for (const [qualifier, palette] of [['values', colors(base)], ['values-night', colors(base)]]) {
    files.set(`res/${qualifier}/widget_colors.xml`, `<resources>${Object.entries(palette).map(([role, color]) => `<color name="widget_${role.replaceAll('-', '_')}">${color}</color>`).join('')}</resources>`)
  }
  // Die Vorschaumetadaten folgen dem Gerätethema; die laufenden Widgets kennen
  // zusätzlich Prios ausdrücklich gewählte persönliche Darstellung.
  files.set('res/values/widget_colors.xml', `<resources>${Object.entries(colors(light)).map(([role, color]) => `<color name="widget_${role.replaceAll('-', '_')}">${color}</color>`).join('')}</resources>`)
  return files
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const target = resolve(root, process.argv[2] ?? 'android/app/build/generated/widget')
  for (const [path, body] of await widgetResources()) {
    const filename = resolve(target, path); await mkdir(resolve(filename, '..'), { recursive: true }); await writeFile(filename, body)
  }
}
