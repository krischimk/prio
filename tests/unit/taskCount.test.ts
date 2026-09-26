import { describe, expect, it } from 'vitest'
import { formatOpenTasks } from '../../src/ui/taskCount'

/**
 * Der Zähler über der Liste. Abgehakte Aufgaben stehen nicht mehr in der Liste,
 * es gibt also nur noch offene – deshalb genau eine Zahl.
 */
describe('Zähler offener Aufgaben', () => {
  it('benutzt die Einzahl bei genau einer Aufgabe', () => {
    expect(formatOpenTasks(1)).toBe('1 offene Aufgabe')
  })

  it('benutzt die Mehrzahl ab zwei Aufgaben', () => {
    expect(formatOpenTasks(2)).toBe('2 offene Aufgaben')
    expect(formatOpenTasks(7)).toBe('7 offene Aufgaben')
  })

  it('nennt auch die leere Liste', () => {
    expect(formatOpenTasks(0)).toBe('0 offene Aufgaben')
  })
})
