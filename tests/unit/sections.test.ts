import { describe, expect, it } from 'vitest'
import {
  SECTIONS_MAX,
  SECTION_NAME_MAX,
  flattenGroups,
  groupTasks,
  parseSections,
  withNewSection,
  withRenamedSection,
  withoutSection,
} from '../../src/domain/sections'
import type { ListSection } from '../../src/domain/types'

/**
 * Abschnitte innerhalb einer Liste.
 *
 * Die Regeln sind reine Funktionen: Der Plan steht als Array an der Liste, die
 * Zugehörigkeit als Feld an der Aufgabe. Damit lässt sich das Ordnen ohne
 * Datenbank und ohne Oberfläche prüfen.
 */
const obst: ListSection = { id: 's-obst', name: 'Obst' }
const getraenke: ListSection = { id: 's-getraenke', name: 'Getränke' }

describe('Abschnittsplan lesen', () => {
  it('liest einen gültigen Plan', () => {
    expect(parseSections([{ id: 'a', name: 'Obst' }, { id: 'b', name: ' Getränke ' }])).toEqual([
      { id: 'a', name: 'Obst' },
      { id: 'b', name: 'Getränke' },
    ])
  })

  it('verträgt fehlende und verbogene Werte', () => {
    // Vor der Migration gibt es die Spalte nicht, und ein Eintrag kann aus
    // einer anderen Fassung stammen – die Liste darf daran nicht scheitern.
    expect(parseSections(undefined)).toEqual([])
    expect(parseSections(null)).toEqual([])
    expect(parseSections('Obst')).toEqual([])
    expect(parseSections([{ id: 'a' }, { name: 'ohne Kennung' }, null, 42])).toEqual([])
    expect(parseSections([{ id: 'a', name: '   ' }])).toEqual([])
    expect(parseSections([{ id: 'a', name: 'x'.repeat(SECTION_NAME_MAX + 1) }])).toEqual([])
  })

  it('nimmt eine Kennung nur einmal', () => {
    expect(parseSections([{ id: 'a', name: 'Erster' }, { id: 'a', name: 'Zweiter' }])).toEqual([
      { id: 'a', name: 'Erster' },
    ])
  })

  it('hört bei der Höchstzahl auf', () => {
    const viele = Array.from({ length: SECTIONS_MAX + 5 }, (_, i) => ({ id: `s${i}`, name: `B${i}` }))
    expect(parseSections(viele)).toHaveLength(SECTIONS_MAX)
  })
})

describe('Abschnitte ändern', () => {
  it('legt einen Abschnitt hinten an', () => {
    const neu = withNewSection([obst], 'Getränke')
    expect(neu?.sections.map((s) => s.name)).toEqual(['Obst', 'Getränke'])
    expect(neu?.id).toBe(neu?.sections[1].id)
  })

  it('lehnt leere Namen und zu viele Abschnitte ab', () => {
    expect(withNewSection([], '   ')).toBeNull()
    const voll = Array.from({ length: SECTIONS_MAX }, (_, i) => ({ id: `s${i}`, name: `B${i}` }))
    expect(withNewSection(voll, 'Noch einer')).toBeNull()
  })

  it('benennt um und lässt Unbekanntes in Ruhe', () => {
    expect(withRenamedSection([obst, getraenke], 's-obst', 'Frisches')).toEqual([
      { id: 's-obst', name: 'Frisches' },
      getraenke,
    ])
    expect(withRenamedSection([obst], 'gibt-es-nicht', 'Egal')).toEqual([obst])
    expect(withRenamedSection([obst], 's-obst', '  ')).toEqual([obst])
  })

  it('entfernt einen Abschnitt', () => {
    expect(withoutSection([obst, getraenke], 's-obst')).toEqual([getraenke])
  })
})

describe('Aufgaben gruppieren', () => {
  const aufgabe = (id: string, section_id: string | null) => ({ id, section_id })

  it('stellt „ohne Bereich" nach oben und hält die Reihenfolge', () => {
    const gruppen = groupTasks(
      [aufgabe('a', 's-getraenke'), aufgabe('b', null), aufgabe('c', 's-obst')],
      [obst, getraenke],
    )

    expect(gruppen.map((g) => g.section?.name ?? 'ohne')).toEqual(['ohne', 'Obst', 'Getränke'])
    expect(gruppen[0].tasks.map((t) => t.id)).toEqual(['b'])
    expect(gruppen[1].tasks.map((t) => t.id)).toEqual(['c'])
    expect(gruppen[2].tasks.map((t) => t.id)).toEqual(['a'])
  })

  it('behält leere Abschnitte', () => {
    // Eben angelegt wären sie sonst unsichtbar.
    const gruppen = groupTasks([aufgabe('a', null)], [obst])
    expect(gruppen.map((g) => g.tasks.length)).toEqual([1, 0])
  })

  it('zählt einen Verweis ins Leere zu „ohne Bereich"', () => {
    const gruppen = groupTasks([aufgabe('a', 's-verschwunden')], [obst])
    expect(gruppen[0].tasks.map((t) => t.id)).toEqual(['a'])
  })

  it('verträgt einen fehlenden Abschnittsplan', () => {
    // Zeilen aus einer Fassung vor Migration 0013 haben das Feld nicht. Genau
    // daran ist 0.18.0 beim Zeichnen abgestürzt („Cannot read properties of
    // undefined (reading 'map')") – die Ansicht blieb schwarz.
    const gruppen = groupTasks([aufgabe('a', null)], undefined as unknown as ListSection[])
    expect(gruppen).toHaveLength(1)
    expect(gruppen[0].tasks.map((t2) => t2.id)).toEqual(['a'])
  })

  it('flacht in Anzeigereihenfolge ab', () => {
    const gruppen = groupTasks(
      [aufgabe('a', 's-getraenke'), aufgabe('b', null), aufgabe('c', 's-obst')],
      [obst, getraenke],
    )
    expect(flattenGroups(gruppen).map((t) => t.id)).toEqual(['b', 'c', 'a'])
  })
})
