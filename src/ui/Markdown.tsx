import { parseInline, parseMarkdown } from './markdown'
import { mutedText } from './styles'

/**
 * Zeigt die Anmerkungen einer Veröffentlichung als das, was sie sind.
 *
 * Die Tag-Texte sind in Markdown geschrieben; hier werden Überschriften,
 * Aufzählungen, Fettungen und Code-Auszeichnungen zu Elementen. Der Text bleibt
 * unverändert – nichts wird umgeschrieben, nur ausgezeichnet.
 */
export function Markdown({ text, className = '' }: { text: string; className?: string }) {
  return (
    <div className={`space-y-2 text-xs ${className}`}>
      {parseMarkdown(text).map((block, index) => {
        switch (block.art) {
          case 'ueberschrift':
            return (
              <p
                key={index}
                className={`font-semibold ${block.stufe <= 2 ? 'text-neutral-200' : 'text-neutral-300'}`}
              >
                {block.text}
              </p>
            )
          case 'liste':
            return (
              <ul key={index} className="list-disc space-y-1 pl-4">
                {block.punkte.map((punkt, punktIndex) => (
                  <li key={punktIndex}>{parseInline(punkt).map(teilWiedergeben)}</li>
                ))}
              </ul>
            )
          case 'absatz':
            return <p key={index}>{parseInline(block.text).map(teilWiedergeben)}</p>
        }
      })}
    </div>
  )
}

function teilWiedergeben(teil: ReturnType<typeof parseInline>[number], index: number) {
  switch (teil.art) {
    case 'fett':
      return (
        <strong key={index} className="font-semibold text-neutral-200">
          {teil.text}
        </strong>
      )
    case 'code':
      return (
        <code key={index} className="rounded bg-neutral-800 px-1 py-0.5 font-mono text-[11px] text-neutral-200">
          {teil.text}
        </code>
      )
    case 'text':
      return <span key={index}>{teil.text}</span>
  }
}

/** Textfarbe der Anmerkungen – hier, damit beide Ansichten dieselbe nehmen. */
export const markdownText = mutedText
