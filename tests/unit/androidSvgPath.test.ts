import { expect, it } from 'vitest'
import { androidSvgPath } from '../../scripts/androidSvgPath.mjs'

it('separates compact SVG arc flags and decimal coordinates for Android without changing geometry', () => {
  expect(androidSvgPath('M15.914 4a1.5 1.5 0 00-2.474-1.561')).toBe('M 15.914 4 a 1.5 1.5 0 0 0 -2.474 -1.561')
  expect(androidSvgPath('M0,0a5 5 0 0110 10z')).toBe('M 0 0 a 5 5 0 0 1 10 10 z')
  expect(androidSvgPath('M.5.5L1e-2-2')).toBe('M .5 .5 L 1e-2 -2')
  expect(() => androidSvgPath('M0 0a5 5 0 01')).toThrow('Unvollständiger')
  expect(() => androidSvgPath('M0 0a5 5 0 21 1 1')).toThrow('Ungültige')
})
