import type { PhrasingContent, Root, RootContent } from 'mdast'

/** Tiptaps ++Unterstreichung++ ergänzen, ohne Code oder HTML umzuschreiben.
 * Der Markdown-Parser hat Verschachtelung und Code bereits getrennt. */
export function remarkUnderline() {
  return (tree: Root) => {
    function walk(node: Root | RootContent) {
      if (!('children' in node)) return
      for (const child of node.children) walk(child)
      if (!['paragraph', 'heading', 'tableCell', 'emphasis', 'strong', 'delete', 'link'].includes(node.type)) return
      const parts = (node.children as PhrasingContent[]).flatMap<PhrasingContent>(child => child.type === 'text'
        ? child.value.split(/(\+\+)/).filter(Boolean).map(value => ({ type: 'text' as const, value })) : [child])
      const result: PhrasingContent[] = []
      for (let i = 0; i < parts.length; i++) {
        const item = parts[i]
        if (item.type === 'text' && item.value === '++') {
          const end = parts.findIndex((part, at) => at > i && part.type === 'text' && part.value === '++')
          if (end > i + 1) {
            result.push({ type: 'emphasis', data: { hName: 'u' }, children: parts.slice(i + 1, end) })
            i = end; continue
          }
        }
        result.push(item)
      }
      node.children = result
    }
    walk(tree)
  }
}
