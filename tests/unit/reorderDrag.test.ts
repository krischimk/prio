import { describe, expect, it } from 'vitest'
import { ordneUm } from '../../src/ui/mobile/ordnen'

describe('ordneUm', () => {
  const eintraege = [
    { id: 'A', gruppe: 'ohne' },
    { id: 'B', gruppe: 'ohne' },
    { id: 'C', gruppe: 'obst' },
    { id: 'D', gruppe: 'leer' },
  ]
  const gruppen = ['ohne', 'obst', 'leer']

  const ordne = (ziel: { gruppe: string; index: number }, gezogeneId = 'B') =>
    ordneUm({
      eintraege,
      gruppen,
      gruppeVon: (eintrag) => eintrag.gruppe,
      gezogeneId,
      ziel,
    }).map((eintrag) => eintrag.id)

  it('laesst die Reihenfolge unveraendert, wenn das Ziel die eigene Stelle ist', () => {
    expect(ordne({ gruppe: 'ohne', index: 1 })).toEqual(['A', 'B', 'C', 'D'])
  })

  it('schiebt innerhalb der Gruppe', () => {
    expect(ordne({ gruppe: 'ohne', index: 0 })).toEqual(['B', 'A', 'C', 'D'])
  })

  it('setzt in eine andere Gruppe', () => {
    expect(ordne({ gruppe: 'obst', index: 0 })).toEqual(['A', 'B', 'C', 'D'])
    expect(ordne({ gruppe: 'obst', index: 1 })).toEqual(['A', 'C', 'B', 'D'])
  })

  it('setzt auch in eine leere Gruppe', () => {
    expect(ordne({ gruppe: 'leer', index: 0 })).toEqual(['A', 'C', 'B', 'D'])
  })

  it('verliert keinen Eintrag, wenn eine Gruppe fehlt', () => {
    const ergebnis = ordneUm({
      eintraege,
      gruppen: ['ohne'],
      gruppeVon: (eintrag) => eintrag.gruppe,
      gezogeneId: 'B',
      ziel: { gruppe: 'ohne', index: 0 },
    }).map((eintrag) => eintrag.id)

    expect(ergebnis).toHaveLength(4)
    expect([...ergebnis].sort()).toEqual(['A', 'B', 'C', 'D'])
  })
})
