import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type MouseEvent } from 'react'
import { focusRing, mutedText } from './styles'
import { ChevronIcon } from './icons'
import { InlineMarkdown, Markdown } from './Markdown'
import { IconButton } from './components/IconButton'

/** Einzeilige Vorschau bis zum ersten Absatz; aufgeklappt vollständig lesbar. */
export function TaskDescription({ text, className = '', open, onToggle, busy = false }: {
  text: string; className?: string; open: boolean; onToggle: () => void; busy?: boolean
}) {
  const toggleId = useId()
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
  const toggle = (event: MouseEvent) => {
    event.stopPropagation()
    if (!busy && !event.defaultPrevented) onToggle()
  }
  const collapseButton = (top = false) => <button type="button" aria-label={top ? 'Notiz oben einklappen' : 'Notiz einklappen'} aria-expanded={true} disabled={busy}
    data-testid={top ? 'beschreibung-oben' : 'beschreibung-mehr'} onClick={toggle}
    className={`${focusRing} ml-1 inline-flex h-6 w-8 shrink-0 items-center justify-center rounded-control align-bottom hover:bg-raised active:bg-raised ${mutedText} ${top ? 'float-right' : ''}`}>
    <ChevronIcon offen={false} className="size-icon-meta -rotate-90" />
  </button>
  const preview = <span ref={textRef} data-testid="task-description" className={`min-w-0 max-w-full truncate text-meta ${mutedText}`}>
    <InlineMarkdown text={previewLine} links={false} />{multiline ? '…' : null}
  </span>
  return <div className={className}>
    {open ? <div data-testid="task-description" className={`flow-root break-words ${mutedText}`}>{collapseButton(true)}<Markdown text={text} preserveLineBreaks trailing={collapseButton()} /></div>
      : expand ? <div className="flex min-w-0 items-center justify-between gap-2">
        <label htmlFor={toggleId} data-task-control data-task-drag-surface className="flex min-w-0 cursor-pointer rounded-control hover:bg-raised active:bg-raised">{preview}</label>
        <IconButton id={toggleId} size="iconSm" layout="shrink-0" aria-label="Notiz aufklappen" aria-expanded={false}
          disabled={busy} data-task-control data-testid="beschreibung-mehr" onClick={toggle}>
          <ChevronIcon offen={false} className="size-icon-meta rotate-90" />
        </IconButton>
      </div> : <div className="flex w-fit max-w-full min-w-0 items-center">{preview}</div>}
  </div>
}
