import type { ReactNode } from 'react'
import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
import type { Element, Root } from 'hast'
import { markdownHref } from './markdown'
import { link } from './styles'
import { remarkUnderline } from './remarkUnderline'

// react-markdown empfiehlt Sanitizing nach HTML-Plugins. Nur der vertrauenswürdige
// Platzhalter für unseren Einklappknopf kommt danach; Notiz-HTML setzt ihn nicht.
const sanitizeSchema = { ...defaultSchema, tagNames: [...defaultSchema.tagNames!, 'u'] }
const rehypePlugins: NonNullable<React.ComponentProps<typeof ReactMarkdown>['rehypePlugins']> = [rehypeRaw, [rehypeSanitize, sanitizeSchema]]
const remarkPlugins = [remarkGfm, remarkUnderline]
function appendTrailing() {
  return (tree: Root) => {
    let parent: Root | Element = tree
    while (true) {
      const last = parent.children.filter(child => child.type === 'element').at(-1)
      if (last?.type !== 'element' || !['p', 'li', 'ul', 'ol', 'blockquote', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(last.tagName)) break
      parent = last
    }
    parent.children.push({ type: 'element', tagName: 'span', properties: { 'dataPrioTrailing': true }, children: [] })
  }
}
function safeUrl(url: string, key: string) {
  if (key === 'src') return /^https?:\/\//i.test(url) ? markdownHref(url) ?? '' : ''
  // Fragmentlinks sind für Fußnoten nötig, alle externen Ziele bleiben begrenzt.
  return url.startsWith('#') ? url : markdownHref(url) ?? ''
}
const components: Components = {
  a: ({ href, children }) => href ? <a href={href} target={href.startsWith('#') ? undefined : '_blank'} rel="noopener noreferrer" className={link}
    onClick={event => event.stopPropagation()}>{children}</a> : <span>{children}</span>,
  img: ({ src, alt, title }) => typeof src === 'string' && src ? <img src={src} alt={alt ?? ''} title={title} loading="lazy" /> : <span>{alt}</span>,
  pre: ({ children }) => <pre className="note-code-block">{children}</pre>,
  table: ({ children }) => <div className="overflow-x-auto"><table>{children}</table></div>,
}

/** CommonMark + GFM: derselbe Renderer für Notizen und Patchnotes. */
export function Markdown({ text, className = '', preserveLineBreaks = false, trailing }: {
  text: string; className?: string; preserveLineBreaks?: boolean; trailing?: ReactNode
}) {
  return <div className={`note-markdown text-meta ${preserveLineBreaks ? 'note-line-breaks' : ''} ${className}`}>
    <ReactMarkdown remarkPlugins={remarkPlugins} rehypePlugins={trailing ? [...rehypePlugins, appendTrailing] : rehypePlugins}
      urlTransform={safeUrl} components={{ ...components, span: ({ node, children }) => node?.properties.dataPrioTrailing ? trailing : <span>{children}</span> }}>{text}</ReactMarkdown>
  </div>
}

export function InlineMarkdown({ text, links = true }: { text: string; links?: boolean }) {
  return <ReactMarkdown remarkPlugins={remarkPlugins} rehypePlugins={rehypePlugins} urlTransform={safeUrl}
    allowedElements={['p', 'strong', 'em', 'u', 'del', 'code', 'a', 'span', 'br']} unwrapDisallowed
    components={{ ...components, p: ({ children }) => <span>{children}</span>,
      a: links ? components.a : ({ children }) => <span>{children}</span> }}>{text}</ReactMarkdown>
}
