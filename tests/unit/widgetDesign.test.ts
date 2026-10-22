// @vitest-environment node
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { LIST_ICONS } from '../../src/ui/listIcons'
import { androidSvgPath } from '../../scripts/androidSvgPath.mjs'

describe('App und Widget behalten gemeinsame Designquellen', () => {
  it('generates both palettes, typography and every current list symbol at build time', () => {
    const folder = mkdtempSync(join(tmpdir(), 'prio-widget-design-'))
    try {
      execFileSync(process.execPath, ['scripts/generate-widget-resources.mjs', folder])
      const design = JSON.parse(readFileSync(join(folder, 'assets/widget-design.json'), 'utf8'))
      const css = readFileSync('src/index.css', 'utf8')
      const light = css.slice(css.indexOf(":root[data-theme='light'] {"))
      for (const theme of ['dark', 'light']) for (const [role, color] of Object.entries(design[theme])) {
        const block = theme === 'dark' ? css.slice(0, css.indexOf('\n:root {')) : light.slice(0, light.indexOf('\n}'))
        expect(block.match(new RegExp(`--color-${role}:\\s*([^;]+)`))?.[1] ?? design.dark[role]).toBe(color)
      }
      expect(design.dark.page).not.toBe(design.light.page)
      expect(design.fonts.body).toBe(parseFloat(css.match(/--text-body:\s*([\d.]+)rem/)![1]) * 16)
      for (const icon of LIST_ICONS) {
        const vector = readFileSync(join(folder, `res/drawable/${design.icons[icon.id]}.xml`), 'utf8')
        for (const path of icon.paths) expect(vector).toContain(androidSvgPath(path))
      }
      const gradle = readFileSync('android/app/build.gradle', 'utf8')
      expect(gradle).toContain("dependsOn 'generateWidgetResources'")
      expect(gradle).toContain("generated/widget/res")
      for (const name of ['WidgetView', 'PrioWidget', 'WidgetConfigurationActivity']) {
        const source = readFileSync(`android/app/src/main/java/de/krischi/prio/widget/${name}.kt`, 'utf8')
        expect(source).not.toMatch(/#[\da-f]{6}|Color\.(BLACK|WHITE|GRAY)/i)
      }
    } finally { rmSync(folder, { recursive: true, force: true }) }
  })
})
