import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react'
import { focusRing, mutedText } from './styles'
import { ChevronIcon } from './icons'
import { InlineMarkdown, Markdown } from './Markdown'

/** Einzeilige Vorschau bis zum ersten Absatz; aufgeklappt vollständig lesbar. */
export function TaskDescription({ text, className = '', open, onToggle, busy = false }: {
  text: string; className?: string; open: boolean; onToggle: () => void; busy?: boolean
}) {
  const [clipped, setClipped] = useState(false)
  const textRef = useRef<HTMLSpanElement | null>(null)
  const measure = useCallback(() => {
    if (!open && textRef.current) setClipped(textRef.current.scrollWidth > textRef.current.clientWidth + 1)
  }, [open])
  useLayoutEffect(measure, [measure, text])
  useEffect(() => {
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [measure])
  const firstLine = text.split(/\r\n?|\n/, 1)[0]
  const previewLine = firstLine.replace(/^#{1,6}\s+/, '')
  const multiline = firstLine.length < text.length
  const expandable = multiline || clipped
  const expand = !open && expandable
  const toggle = (event: MouseEvent | KeyboardEvent) => {
    event.stopPropagation()
    if (!busy && !event.defaultPrevented) onToggle()
  }
  const collapse = <button type="button" aria-label="Notiz einklappen" aria-expanded={true} disabled={busy}
    data-testid="beschreibung-mehr" onClick={toggle}
    className={`${focusRing} ml-1 inline-flex size-6 shrink-0 items-center justify-center rounded-control align-bottom hover:bg-raised active:bg-raised ${mutedText}`}>
    <ChevronIcon offen={false} className="size-icon-meta -rotate-90" />
  </button>
  return <div className={`${className} ${open ? '' : `flex w-fit min-w-0 max-w-full items-center ${expand ? `${focusRing} cursor-pointer rounded-control hover:bg-raised active:bg-raised` : ''}`}`}
    role={expand ? 'button' : undefined} tabIndex={expand ? 0 : undefined}
    aria-label={expand ? 'Notiz aufklappen' : undefined} aria-expanded={expand ? false : undefined}
    aria-disabled={expand ? busy : undefined} data-task-control={expand ? true : undefined}
    data-testid={expand ? 'beschreibung-mehr' : undefined}
    onClick={expand ? toggle : undefined}
    onKeyDown={expand ? event => {
      if (event.key === 'Enter' || event.key === ' ') { toggle(event); event.preventDefault() }
    } : undefined}>
    {open ? <div data-testid="task-description" className={`break-words ${mutedText}`}><Markdown text={text} preserveLineBreaks trailing={collapse} /></div>
      : <span ref={textRef} data-testid="task-description" className={`min-w-0 truncate text-meta ${mutedText}`}>
        <InlineMarkdown text={previewLine} links={false} />{multiline ? '…' : null}
      </span>}
    {expand ? <ChevronIcon offen={false} className="ml-1 size-icon-meta shrink-0 rotate-90 text-ink-muted" /> : null}
  </div>
}
