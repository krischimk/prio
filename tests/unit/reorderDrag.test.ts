import { describe, expect, it } from 'vitest'
import { OHNE_BEREICH, zielAusGeometrie } from '../../src/ui/mobile/useReorderDrag'
import { ordneUm } from '../../src/ui/mobile/ordnen'

/**
 * Das Ziel beim Ziehen (unit).
 *
 * Drei Zeilen à 50 px (Mittellinien bei 25, 75, 125), dazu Bereichsköpfe.
 */
const kopf = (gruppe: string, top: number) => ({ gruppe, top })
const zeile = (id: string, gruppe: string, top: number) => ({ id, gruppe, top, height: 50 })

function ziel(koepfe: ReturnType<typeof kopf>[], zeilen: ReturnType<typeof zeile>[], y: number) {
  return zielAusGeometrie({ koepfe, zeilen, gezogeneId: 'B', clientY: y })
}

describe('zielAusGeometrie', () => {
  const flach = [zeile('A', OHNE_BEREICH, 0), zeile('B', OHNE_BEREICH, 50), zeile('C', OHNE_BEREICH, 100)]
  const einKopf = [kopf(OHNE_BEREICH, -20)]

  it('laesst die Aufgabe an ihrem Platz, solange der Finger in ihrer Zeile bleibt', () => {
    // Genau hier sprang sie frueher: Sobald der Finger die eigene Mitte (75)
    // verliess, galt die naechste Zeile als Ziel.
    expect(ziel(einKopf, flach, 60).index).toBe(1)
    expect(ziel(einKopf, flach, 80).index).toBe(1)
    expect(ziel(einKopf, flach, 99).index).toBe(1)
  })

  it('zaehlt nur die anderen Mittellinien', () => {
    expect(ziel(einKopf, flach, 0).index).toBe(0)
    expect(ziel(einKopf, flach, 500).index).toBe(2)
  })

  it('nimmt den Bereich des letzten Kopfes ueber dem Finger', () => {
    const koepfe = [kopf(OHNE_BEREICH, 0), kopf('obst', 60), kopf('getraenke', 200)]
    const zeilen = [
      zeile('A', OHNE_BEREICH, 20),
      zeile('B', 'obst', 80),
      zeile('C', 'getraenke', 220),
    ]

    expect(zielAusGeometrie({ koepfe, zeilen, gezogeneId: 'B', clientY: 100 }).gruppe).toBe('obst')
    expect(zielAusGeometrie({ koepfe, zeilen, gezogeneId: 'B', clientY: 230 }).gruppe).toBe(
      'getraenke',
    )
  })

  it('zieht unter dem letzten Kopf bis ans Ende in dessen Bereich', () => {
    // Der Fall aus dem Betrieb: Der Kopf steht am Ende der Liste. Frueher blieb
    // die Aufgabe in ihrem alten Bereich, wenn man darunter losliess.
    const koepfe = [kopf(OHNE_BEREICH, 0), kopf('leer', 100)]
    const zeilen = [zeile('A', OHNE_BEREICH, 20), zeile('B', OHNE_BEREICH, 70)]

    const unterDemKopf = zielAusGeometrie({
      koepfe,
      zeilen,
      gezogeneId: 'B',
      clientY: 400,
    })

    expect(unterDemKopf.gruppe).toBe('leer')
    expect(unterDemKopf.index).toBe(0)
  })

  it('zieht auch in einen zugeklappten Bereich', () => {
    const koepfe = [kopf(OHNE_BEREICH, 0), kopf('zu', 60)]

    expect(zielAusGeometrie({ koepfe, zeilen: [], gezogeneId: 'A', clientY: 70 }).gruppe).toBe('zu')
  })
})

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
