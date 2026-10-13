import { describe, expect, it } from 'vitest'
import { formatGermanDate, normalizeTime, parseGermanDate } from '../../src/ui/datetime'

describe('deutsche Datumseingabe', () => {
  it('liest Punktnotation und weist unmögliche Tage zurück', () => {
    expect(parseGermanDate('3.2.2027')).toBe('2027-02-03')
    expect(parseGermanDate('29.02.2028')).toBe('2028-02-29')
    for (const invalid of ['29.02.2027', '31.04.2026', '00.10.2026', '13.00.2026', '13.13.2026', '10/13/2026', '2026-10-13']) {
      expect(parseGermanDate(invalid), invalid).toBeNull()
    }
    expect(formatGermanDate('2027-02-03')).toBe('03.02.2027')
  })
  it('verwendet gültige 24-Stunden-Uhrzeiten', () => {
    expect(normalizeTime('9:05')).toBe('09:05')
    expect(normalizeTime('23:59')).toBe('23:59')
    expect(normalizeTime('00:00')).toBe('00:00')
    for (const invalid of ['24:00', '20:60', '8:3', '1 PM', '-1:00', '']) expect(normalizeTime(invalid)).toBeNull()
  })
})
