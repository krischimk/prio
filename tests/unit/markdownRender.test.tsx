import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Markdown } from '../../src/ui/Markdown'

/** Was der Nutzer liest: keine Sternchen, keine Rauten. */
describe('Anmerkungen anzeigen', () => {
  it('zeigt Python und HTML in Codeblöcken wörtlich, ohne daraus Elemente oder Formatierung zu machen', () => {
    const { container } = render(<Markdown text={'Mit\n```python\nimport sounddevice as sd\nprint(sd.query_devices())\n<script>alert("**Text**")</script>\n```\nDanach `device=<Nummer>`.'} preserveLineBreaks />)
    expect(container.querySelector('pre code')).toHaveTextContent('import sounddevice as sd')
    expect(container.querySelector('pre code')).toHaveTextContent('print(sd.query_devices())')
    expect(container.querySelector('pre code')).toHaveTextContent('<script>alert("**Text**")</script>')
    expect(container.querySelector('script')).toBeNull()
    expect(container.querySelector('pre strong')).toBeNull()
    expect(screen.getByText('device=<Nummer>')).toBeVisible()
  })
  it('rendert CommonMark und GFM mit verschachtelten Listen, Zitaten, Tabellen und Fußnoten', () => {
    const { container } = render(<Markdown text={'# Titel\n\n> Zitat mit ~~alt~~ und <u>Linie</u>\n\n1. Erstens\n   - Unterpunkt\n\n- [x] Fertig\n- [ ] Offen\n\n| Name | Wert |\n| --- | --- |\n| A | **B** |\n\nHinweis[^1]\n\n[^1]: Fußnote'} trailing={<button>Einklappen</button>} />)
    expect(container.querySelector('h1')).toHaveTextContent('Titel')
    expect(container.querySelector('blockquote del')).toHaveTextContent('alt')
    expect(container.querySelector('blockquote u')).toHaveTextContent('Linie')
    expect(container.querySelector('ol ul li')).toHaveTextContent('Unterpunkt')
    expect(container.querySelectorAll('input[disabled]')).toHaveLength(2)
    expect(container.querySelector('input[checked]')).not.toBeNull()
    expect(container.querySelector('td strong')).toHaveTextContent('B')
    expect(container.querySelector('section[data-footnotes]')).toHaveTextContent('Fußnote')
    expect(screen.getByRole('button', { name: 'Einklappen' })).toBeVisible()
  })
  it('zeigt bestehende Tiptap-Unterstreichungen auch verschachtelt, aber nicht in Code', () => {
    const { container } = render(<Markdown text={'++Linie **fett**++ und `++Code++`'} />)
    expect(container.querySelector('u')).toHaveTextContent('Linie fett')
    expect(container.querySelector('u strong')).toHaveTextContent('fett')
    expect(container.querySelector('code')).toHaveTextContent('++Code++')
  })
  it('bereinigt HTML und gefährliche URLs, lässt sichere Links und Unterstreichung zu', () => {
    const { container } = render(<Markdown text={'<script>alert(1)</script>\n\n<iframe src="https://evil.test"></iframe>\n\n<img src="x" onerror="alert(1)">\n\n<a href="javascript:alert(1)">Unsicher</a> <u>Linie</u>\n\n[Sicher](https://example.org)'} />)
    expect(container.querySelector('script, iframe, [onerror], [href^="javascript:"]')).toBeNull()
    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('u')).toHaveTextContent('Linie')
    expect(screen.getByRole('link', { name: 'Sicher' })).toHaveAttribute('rel', 'noopener noreferrer')
  })
  it('zeigt Auszeichnungen als Text, nicht als Zeichen', () => {
    const { container } = render(
      <Markdown text={'## Neu\n* **Fett** und `Code`\n* Zweiter Punkt'} />,
    )

    expect(screen.getByText('Neu')).toBeVisible()
    expect(screen.getByText('Fett')).toBeVisible()
    expect(screen.getByText('Code')).toBeVisible()
    expect(screen.getByText('Zweiter Punkt')).toBeVisible()

    const sichtbar = container.textContent ?? ''
    expect(sichtbar).not.toContain('**')
    expect(sichtbar).not.toContain('`')
    expect(sichtbar).not.toContain('##')
  })
})
