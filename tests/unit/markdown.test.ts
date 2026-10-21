import { expect, it } from 'vitest'
import { markdownHref } from '../../src/ui/markdown'

it('erlaubt vollständige Web- und Mailadressen, keine ausführbaren oder relativen Ziele', () => {
  expect(markdownHref('https://example.org')).toBe('https://example.org/')
  expect(markdownHref('mailto:test@example.org')).toBe('mailto:test@example.org')
  for (const value of ['javascript:alert(1)', 'data:text/html,test', 'file:///tmp/test', '/relativ', 'kein Link']) expect(markdownHref(value)).toBeNull()
})
