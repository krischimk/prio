import { useEffect, useRef, useState } from 'react'
import { EditorContent, useEditor, useEditorState, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { TableKit } from '@tiptap/extension-table'
import { TaskList, TaskItem } from '@tiptap/extension-list'
import Image from '@tiptap/extension-image'
import { Markdown as MarkdownExtension } from '@tiptap/markdown'
import { IconButton } from './components/IconButton'
import { Button } from './components/Button'
import { Sheet } from './components/Sheet'
import { BoldIcon, ItalicIcon, UnderlineIcon, BulletListIcon, NumberedListIcon, LinkIcon, RemoveFormattingIcon, MarkdownIcon } from './icons'
import { errorMessage, input, noteInput } from './styles'
import { markdownHref } from './markdown'

// Bilder werden nur über Web-Adressen geladen. Base64 und ausführbare Protokolle
// gehören weder in Markdown-Bilder noch in eingefügtes HTML.
const NoteImage = Image.extend({
  renderHTML({ node }) {
    const src = String(node.attrs.src ?? '')
    return /^https?:\/\//i.test(src) && markdownHref(src) ? ['img', { src, alt: node.attrs.alt ?? '', title: node.attrs.title }] : ['span', {}, node.attrs.alt ?? '']
  },
}).configure({ allowBase64: false })

/** Die Editorinstanz bleibt vom restlichen Aufgabenformular getrennt (Tiptap-Empfehlung). */
export function NoteEditor({ id, value, onChange, disabled = false }: { id: string; value: string; onChange: (text: string) => void; disabled?: boolean }) {
  const incoming = useRef(value)
  const pending = useRef<string[]>([])
  const [source, setSource] = useState(false)
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // CommonMark-Blöcke aktiv lassen: deaktivierte Nodes gehen beim Einlesen verloren.
        // CodeBlock ohne Syntax-Highlighting, Darstellung über gemeinsames CSS.
        link: { openOnClick: false, autolink: false, isAllowedUri: uri => markdownHref(uri) !== null },
      }),
      TableKit.configure({ table: { resizable: false } }),
      TaskList, TaskItem.configure({ nested: true, HTMLAttributes: { 'data-type': 'taskItem' } }), NoteImage,
      MarkdownExtension.configure({ markedOptions: { gfm: true, breaks: true } }),
    ],
    content: value,
    contentType: 'markdown',
    shouldRerenderOnTransaction: false,
    editable: !disabled,
    editorProps: {
      attributes: { id, role: 'textbox', 'aria-label': 'Notiz', 'aria-multiline': 'true', 'aria-readonly': String(disabled),
        'data-placeholder': 'Notiz hinzufügen', class: `${noteInput} note-editor` },
      handleKeyDown: (view, event) => {
        if (event.key === 'ArrowLeft' && !event.isComposing && !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey
          && view.state.selection.empty && view.state.doc.textBetween(0, view.state.selection.from, '\n', '\uFFFC') === '') {
          // Android darf die Bewegung am Dokumentanfang nicht an andere Knöpfe weitergeben.
          event.preventDefault()
          return true
        }
        return false
      },
    },
    onUpdate: ({ editor }) => {
      const markdown = editor.getMarkdown()
      pending.current.push(markdown)
      onChange(markdown)
    },
  })
  useEffect(() => {
    if (!editor || incoming.current === value) return
    incoming.current = value
    // Eine verspätete Bestätigung eigener Eingaben darf die inzwischen neuere
    // Auswahl nicht zurücksetzen. Nur echte externe Entwurfswechsel einspielen.
    const acknowledged = pending.current.indexOf(value)
    if (acknowledged >= 0) { pending.current.splice(0, acknowledged + 1); return }
    pending.current = []
    if (editor.getMarkdown() !== value) editor.commands.setContent(value, { contentType: 'markdown', emitUpdate: false })
  }, [editor, value])
  useEffect(() => { editor?.setEditable(!disabled, false) }, [editor, disabled])
  return <div className="min-w-0 flex-1 rounded-control border border-line-strong bg-surface" data-no-drawer-swipe>
    <div className="flex min-w-0 items-center border-b border-line-soft">
      <div className="min-w-0 flex-1">{editor ? <NoteToolbar editor={editor} disabled={disabled || source} /> : null}</div>
      <IconButton variant={source ? 'iconActive' : 'icon'} layout="shrink-0" aria-label="Markdown-Quelltext bearbeiten" aria-pressed={source} disabled={disabled}
        title={source ? 'Zur formatierten Bearbeitung wechseln.' : 'Markdown-Quelltext bearbeiten.'} onClick={() => setSource(value => !value)}><MarkdownIcon /></IconButton>
    </div>
    <div hidden={source}><EditorContent editor={editor} /></div>
    {source ? <textarea id={`${id}-source`} aria-label="Notiz (Markdown)" rows={8} className={`${noteInput} resize-y font-mono`} value={value}
      disabled={disabled} onChange={event => onChange(event.target.value)} onKeyDown={event => {
        if (event.key === 'ArrowLeft' && event.currentTarget.selectionStart === 0 && event.currentTarget.selectionEnd === 0) { event.preventDefault(); event.stopPropagation() }
      }} /> : null}
  </div>
}

function NoteToolbar({ editor, disabled }: { editor: Editor; disabled: boolean }) {
  const active = useEditorState({ editor, selector: ({ editor }) => ({
    bold: editor.isActive('bold'), italic: editor.isActive('italic'), underline: editor.isActive('underline'),
    bullets: editor.isActive('bulletList'), numbers: editor.isActive('orderedList'), link: editor.isActive('link'),
  }) })
  const [link, setLink] = useState<{ from: number; to: number; text: string; href: string } | null>(null)
  const [linkError, setLinkError] = useState<string | null>(null)
  const actions = [
    { label: 'Fett', hint: 'Fett ein- oder ausschalten. Strg+B.', Icon: BoldIcon, active: active.bold, run: () => editor.chain().focus(undefined, { scrollIntoView: false }).toggleBold().run() },
    { label: 'Kursiv', hint: 'Kursivschrift ein- oder ausschalten. Strg+I.', Icon: ItalicIcon, active: active.italic, run: () => editor.chain().focus(undefined, { scrollIntoView: false }).toggleItalic().run() },
    { label: 'Unterstreichen', hint: 'Unterstreichung ein- oder ausschalten. Strg+U.', Icon: UnderlineIcon, active: active.underline, run: () => editor.chain().focus(undefined, { scrollIntoView: false }).toggleUnderline().run() },
    { label: 'Nummerierte Liste', hint: 'Die ausgewählten Absätze nummerieren oder die Nummerierung entfernen.', Icon: NumberedListIcon, active: active.numbers, run: () => editor.chain().focus(undefined, { scrollIntoView: false }).toggleOrderedList().run() },
    { label: 'Aufzählung', hint: 'Die ausgewählten Absätze als Aufzählung formatieren oder die Aufzählung entfernen.', Icon: BulletListIcon, active: active.bullets, run: () => editor.chain().focus(undefined, { scrollIntoView: false }).toggleBulletList().run() },
    { label: 'Link einfügen', hint: 'Markierten Text verlinken oder einen bestehenden Link bearbeiten.', Icon: LinkIcon, active: active.link, run: () => {
      editor.chain().extendMarkRange('link').run()
      const { from, to } = editor.state.selection
      setLink({ from, to, text: editor.state.doc.textBetween(from, to, ' '), href: editor.getAttributes('link').href ?? 'https://' })
      setLinkError(null)
    } },
    { label: 'Formatierung entfernen', hint: 'Formatierung und Listenstruktur der ausgewählten Absätze entfernen.', Icon: RemoveFormattingIcon, active: false, run: () => editor.chain().focus(undefined, { scrollIntoView: false }).unsetAllMarks().clearNodes().run() },
  ]
  const saveLink = () => {
    if (!link) return
    const href = markdownHref(link.href.trim())
    if (!href) { setLinkError('Bitte eine vollständige Adresse mit https://, http:// oder mailto: eingeben.'); return }
    const original = editor.state.doc.textBetween(link.from, link.to, ' ')
    const chain = editor.chain().focus(undefined, { scrollIntoView: false })
    if (link.to > link.from && link.text === original) chain.setTextSelection({ from: link.from, to: link.to }).setLink({ href }).run()
    else chain.insertContentAt({ from: link.from, to: link.to }, { type: 'text', text: link.text || href, marks: [{ type: 'link', attrs: { href } }] }).run()
    setLink(null)
  }
  return <>
    <div role="group" aria-label="Notiz formatieren" className="flex overflow-x-auto">
      {actions.map(({ label, hint, Icon, active, run }) => <IconButton key={label} aria-label={label} title={hint} aria-pressed={active}
        variant={active ? 'iconActive' : 'icon'} disabled={disabled} layout="shrink-0"
        onPointerDown={event => event.preventDefault()} onClick={run}><Icon /></IconButton>)}
    </div>
    {link ? <Sheet title="Link einfügen" name="notiz-link" onClose={() => setLink(null)}>
      <div className="space-y-3 p-4" data-note-link-dialog onKeyDown={event => {
        if (event.key === 'Enter') { event.preventDefault(); event.stopPropagation(); saveLink() }
      }}>
        <label className="block text-meta text-ink-muted">Linktext<input className={input} value={link.text} onChange={event => setLink({ ...link, text: event.target.value })} /></label>
        <label className="block text-meta text-ink-muted">Link-Adresse<input autoFocus type="url" className={input} value={link.href}
          onChange={event => setLink({ ...link, href: event.target.value })} /></label>
        {linkError ? <p role="alert" className={errorMessage}>{linkError}</p> : null}
        <div className="flex flex-wrap gap-2"><Button onClick={saveLink}>Link übernehmen</Button>
          {active.link ? <Button variant="secondary" onClick={() => { editor.chain().focus().setTextSelection({ from: link.from, to: link.to }).unsetLink().run(); setLink(null) }}>Link entfernen</Button> : null}
          <Button variant="ghost" onClick={() => setLink(null)}>Abbrechen</Button></div>
      </div>
    </Sheet> : null}
  </>
}
