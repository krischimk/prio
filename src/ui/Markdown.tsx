import type { ReactNode } from 'react'
import { parseInline, parseMarkdown } from './markdown'
import { link, mutedText } from './styles'

/** Gemeinsame, HTML-freie Darstellung für Patchnotes und Notizen. */
export function Markdown({ text, className = '', preserveLineBreaks = false, trailing }: {
  text: string; className?: string; preserveLineBreaks?: boolean; trailing?: ReactNode
}) {
  const blocks = parseMarkdown(text, preserveLineBreaks)
  return <div className={`space-y-2 text-meta ${className}`}>
    {blocks.map((block, index) => {
      const end = index === blocks.length - 1 ? trailing : null
      switch (block.art) {
        case 'ueberschrift': {
          const Heading = `h${block.stufe}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'
          return <Heading key={index} className={`font-semibold text-ink-soft ${block.stufe === 1 ? 'text-title' : block.stufe === 2 ? 'text-body' : 'text-meta'}`}><InlineMarkdown text={block.text} />{end}</Heading>
        }
        case 'liste': {
          const List = block.ordered ? 'ol' : 'ul'
          return <List key={index} start={block.ordered ? block.start : undefined} className={`${block.ordered ? 'list-decimal' : 'list-disc'} space-y-1 pl-4`}>
            {block.punkte.map((point, pointIndex) => <li key={pointIndex}><InlineMarkdown text={point} />{pointIndex === block.punkte.length - 1 ? end : null}</li>)}
          </List>
        }
        case 'absatz': return <p key={index} className={preserveLineBreaks ? 'whitespace-pre-wrap' : undefined}><InlineMarkdown text={block.text} />{end}</p>
      }
    })}
    {!blocks.length ? trailing : null}
  </div>
}

export function InlineMarkdown({ text, links = true }: { text: string; links?: boolean }) {
  return <>{renderInline(text, links)}</>
}

function renderInline(text: string, links: boolean, depth = 0): ReactNode {
  if (depth > 16) return text
  return parseInline(text).map((part, index) => {
    const content = () => renderInline(part.text, links, depth + 1)
    switch (part.art) {
      case 'fett': return <strong key={index} className="font-semibold text-ink-soft">{content()}</strong>
      case 'kursiv': return <em key={index}>{content()}</em>
      case 'unterstrichen': return <u key={index}>{content()}</u>
      case 'code': return <code key={index} className="rounded-control bg-raised px-1 py-0.5 font-mono text-label text-ink-soft">{part.text}</code>
      case 'link': return links ? <a key={index} href={part.href} target="_blank" rel="noopener noreferrer" className={link}
        onClick={event => event.stopPropagation()}>{renderInline(part.text, false, depth + 1)}</a> : <span key={index}>{content()}</span>
      case 'text': return <span key={index}>{part.text}</span>
    }
  })
}

export const markdownText = mutedText
