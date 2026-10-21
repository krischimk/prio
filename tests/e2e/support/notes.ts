import { expect, test, type Locator, type Page } from '@playwright/test'
import * as desktop from './helpers'
import * as phone from './mobile'
import { outerTask } from './checklists'
import type { Editor } from '@tiptap/react'

export async function selectNoteText(field: Locator, text: string) {
  await field.evaluate((element, text) => {
    const content = element.textContent ?? ''
    const start = content.indexOf(text)
    if (start < 0) throw new Error(`Textauswahl fehlt: ${text}`)
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
    const range = document.createRange()
    let offset = 0, begun = false
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const size = node.textContent!.length
      if (!begun && start < offset + size) { range.setStart(node, start - offset); begun = true }
      if (begun && start + text.length <= offset + size) { range.setEnd(node, start + text.length - offset); break }
      offset += size
    }
    ;(element as HTMLElement).focus({ preventScroll: true })
    const editor = (element as HTMLElement & { editor: Editor }).editor
    editor.commands.setTextSelection({ from: editor.view.posAtDOM(range.startContainer, range.startOffset), to: editor.view.posAtDOM(range.endContainer, range.endOffset) })
  }, text)
}

async function endOfNote(field: Locator) {
  await field.evaluate(element => {
    const editor = (element as HTMLElement & { editor: Editor }).editor
    editor.commands.setTextSelection(editor.state.doc.content.size - 1)
    editor.view.focus()
  })
}

export async function noteFormattingParity(page: Page, mobile: boolean) {
  await (mobile ? phone.register : desktop.register)(page, desktop.uniqueEmail('markdown-note'))
  await (mobile ? phone.createList : desktop.createList)(page, 'Notizen')
  await (mobile ? phone.createTask : desktop.createTask)(page, 'Formatierte Notiz')
  const editor = await desktop.openTaskEditor(page, 'Formatierte Notiz')
  const field = editor.getByRole('textbox', { name: 'Notiz', exact: true })
  await field.fill('')
  await field.pressSequentially('## Überschrift')
  await expect(field.locator('h2')).toHaveText('Überschrift')
  await field.press('Enter')
  await page.keyboard.type('Fett Kursiv Linie')
  for (const [text, action] of [['Fett', 'Fett'], ['Kursiv', 'Kursiv'], ['Linie', 'Unterstreichen']]) {
    await selectNoteText(field, text)
    await editor.getByRole('button', { name: action, exact: true }).click()
    await expect(field).toBeFocused()
  }
  await expect(field.locator('strong')).toHaveText('Fett')
  await expect(field.locator('em')).toHaveText('Kursiv')
  await expect(field.locator('u')).toHaveText('Linie')
  await endOfNote(field); await field.press('Enter')
  await page.keyboard.type('Apfel'); await field.press('Enter'); await page.keyboard.type('Birne')
  await selectNoteText(field, 'ApfelBirne')
  await editor.getByRole('button', { name: 'Aufzählung', exact: true }).click()
  await expect(field.locator('ul li')).toHaveText(['Apfel', 'Birne'])
  await editor.getByRole('button', { name: 'Nummerierte Liste', exact: true }).click()
  await expect(field.locator('ol li')).toHaveText(['Apfel', 'Birne'])
  await endOfNote(field)
  await page.keyboard.type('Web')
  await selectNoteText(field, 'Web')
  await editor.getByRole('button', { name: 'Link einfügen', exact: true }).click()
  const link = page.getByRole('dialog', { name: 'Link einfügen', exact: true })
  await link.getByLabel('Link-Adresse', { exact: true }).fill('https://example.org')
  await link.getByRole('button', { name: 'Link übernehmen', exact: true }).click()
  await expect(link).toBeHidden()
  await expect(field.getByRole('link', { name: 'Web', exact: true })).toHaveAttribute('href', 'https://example.org/')
  await page.screenshot({ path: test.info().outputPath('notiz-werkzeuge.png'), animations: 'disabled' })
  await field.press('Control+Enter')
  await expect(editor).toBeHidden()
  const row = outerTask(page, 'Formatierte Notiz')
  await expect(row.getByTestId('task-description')).toContainText('Überschrift')
  await row.getByRole('button', { name: 'Notiz aufklappen', exact: true }).click()
  await expect(row.locator('strong')).toHaveText('Fett')
  await expect(row.locator('em')).toHaveText('Kursiv')
  await expect(row.locator('u')).toHaveText('Linie')
  await expect(row.locator('ol li')).toHaveText(['Apfel', 'Birne'])
  await expect(row.getByRole('link', { name: 'Web', exact: true })).toHaveAttribute('href', 'https://example.org/')
  await page.screenshot({ path: test.info().outputPath('notiz-formatiert.png'), animations: 'disabled' })
  if (mobile) {
    await page.setViewportSize({ width: 740, height: 360 })
    await page.screenshot({ path: test.info().outputPath('notiz-formatiert-quer.png'), animations: 'disabled' })
    await page.setViewportSize({ width: 390, height: 844 })
  }
  await page.context().route('https://example.org/', route => route.fulfill({ contentType: 'text/html', body: '<title>Notizlink</title>' }))
  const popup = page.waitForEvent('popup')
  await row.getByRole('link', { name: 'Web', exact: true }).click()
  await (await popup).close()
  await expect(editor).toBeHidden()
  await desktop.openTaskEditor(page, 'Formatierte Notiz')
  await expect(field.locator('h2')).toHaveText('Überschrift')
  await field.selectText()
  await editor.getByRole('button', { name: 'Formatierung entfernen', exact: true }).click()
  await expect(field.locator('strong, em, u, a, ol, h2')).toHaveCount(0)
  await field.press('Control+Enter')
  await expect(editor).toBeHidden()
  await expect(row.locator('strong, em, u, a, ol')).toHaveCount(0)
}

export async function markdownSourceParity(page: Page, mobile: boolean) {
  const markdown = '# Audiogeräte\n\nMit\n```python\nimport sounddevice as sd\nprint(sd.query_devices())\n```\nprüfst du die Geräte. `device=<Nummer>`\n\n> Ein ~~alter~~ Hinweis\n\n1. Hauptpunkt\n   - Unterpunkt\n\n- [x] Getestet\n- [ ] Offen\n\n| Gerät | Kanal |\n| --- | --- |\n| Mikrofon | 1 |'
  await (mobile ? phone.register : desktop.register)(page, desktop.uniqueEmail('markdown-full'))
  await (mobile ? phone.createList : desktop.createList)(page, 'Markdown')
  await (mobile ? phone.createTask : desktop.createTask)(page, 'Audio prüfen')
  const editor = await desktop.openTaskEditor(page, 'Audio prüfen')
  const toggle = editor.getByRole('button', { name: 'Markdown-Quelltext bearbeiten', exact: true })
  const source = editor.getByRole('textbox', { name: 'Notiz (Markdown)', exact: true })
  const rich = editor.getByRole('textbox', { name: 'Notiz', exact: true })
  await toggle.click()
  await source.fill(markdown)
  await toggle.click()
  await expect(rich.locator('pre code')).toHaveText('import sounddevice as sd\nprint(sd.query_devices())')
  await expect(rich.locator('blockquote s')).toHaveText('alter')
  await expect(rich.locator('ol ul li')).toHaveText('Unterpunkt')
  await expect(rich.locator('table')).toContainText('Mikrofon')
  await expect(rich.locator('input[type="checkbox"]')).toHaveCount(2)
  await page.screenshot({ path: test.info().outputPath('markdown-editor.png'), animations: 'disabled' })
  // Ein tatsächlicher Rich-Text-Edit muss alle eingelesenen Blöcke erhalten.
  await endOfNote(rich)
  await rich.press('ArrowDown')
  await rich.press('End')
  await page.keyboard.type(' Zusatz')
  await toggle.click()
  await expect(source).toHaveValue(/print\(sd\.query_devices\(\)\)/)
  await expect(source).toHaveValue(/Mikrofon/)
  await expect(source).toHaveValue(/\[x\] Getestet/)
  await source.press('Control+Enter')
  await expect(editor).toBeHidden()
  const row = outerTask(page, 'Audio prüfen')
  await row.getByRole('button', { name: 'Notiz aufklappen', exact: true }).click()
  await expect(row.locator('pre code')).toHaveText('import sounddevice as sd\nprint(sd.query_devices())\n')
  await expect(row.locator('blockquote del')).toHaveText('alter')
  await expect(row.locator('ol ul li')).toHaveText('Unterpunkt')
  await expect(row.locator('table')).toContainText('Mikrofon')
  await page.screenshot({ path: test.info().outputPath('markdown-liste.png'), animations: 'disabled' })
  if (mobile) {
    await page.setViewportSize({ width: 740, height: 360 })
    await page.screenshot({ path: test.info().outputPath('markdown-quer.png'), animations: 'disabled' })
    await page.setViewportSize({ width: 390, height: 844 })
  }
  await desktop.openTaskEditor(page, 'Audio prüfen')
  await expect(rich.locator('pre code')).toContainText('print(sd.query_devices())')
  await toggle.click()
  await expect(source).toHaveValue(/Zusatz/)
  await editor.getByRole('button', { name: 'Schließen', exact: true }).click()
}
