import { describe, expect, it, vi } from 'vitest'
import { createBackStack } from '../../src/app/backStack'

/**
 * Back-Stack für die Android-Zurück-Taste (unit).
 *
 * Kernanforderung: Die Zurück-Taste schließt die zuletzt geöffnete Ebene –
 * und wenn keine offen ist, wird die App in den Hintergrund geschickt.
 */
describe('Back-Stack', () => {
  it('meldet false, wenn keine Ebene offen ist', () => {
    const stack = createBackStack()
    expect(stack.handle()).toBe(false)
    expect(stack.size()).toBe(0)
  })

  it('führt den Handler der obersten Ebene aus', () => {
    const stack = createBackStack()
    const onBack = vi.fn()
    stack.push(onBack)

    expect(stack.handle()).toBe(true)
    expect(onBack).toHaveBeenCalledTimes(1)
    expect(stack.size()).toBe(0)
  })

  it('schließt die zuletzt geöffnete Ebene zuerst', () => {
    const stack = createBackStack()
    const erste = vi.fn()
    const zweite = vi.fn()
    stack.push(erste)
    stack.push(zweite)

    stack.handle()
    expect(zweite).toHaveBeenCalledTimes(1)
    expect(erste).not.toHaveBeenCalled()

    stack.handle()
    expect(erste).toHaveBeenCalledTimes(1)
  })

  it('entfernt beim Abmelden nur die eigene Ebene', () => {
    const stack = createBackStack()
    const a = vi.fn()
    const b = vi.fn()
    const abmeldenA = stack.push(a)
    stack.push(b)

    abmeldenA()
    expect(stack.size()).toBe(1)

    stack.handle()
    expect(b).toHaveBeenCalledTimes(1)
    expect(a).not.toHaveBeenCalled()
  })

  it('verträgt doppeltes Abmelden', () => {
    const stack = createBackStack()
    const a = vi.fn()
    const b = vi.fn()
    const abmelden = stack.push(a)
    stack.push(b)

    abmelden()
    abmelden()
    abmelden()

    expect(stack.size()).toBe(1)
    stack.handle()
    expect(b).toHaveBeenCalledTimes(1)
  })

  it('ignoriert eine bereits geschlossene Ebene beim Abmelden', () => {
    const stack = createBackStack()
    const a = vi.fn()
    const b = vi.fn()
    const abmeldenA = stack.push(a)
    stack.push(b)

    // a wurde durch die Zurück-Taste geschlossen – das spätere Aufräumen des
    // Effekts darf b nicht mitreißen.
    stack.handle()
    expect(stack.size()).toBe(1)
    abmeldenA()

    stack.handle()
    expect(b).toHaveBeenCalledTimes(1)
    expect(stack.size()).toBe(0)
  })

  it('leert den Stack', () => {
    const stack = createBackStack()
    stack.push(vi.fn())
    stack.push(vi.fn())
    stack.clear()
    expect(stack.size()).toBe(0)
    expect(stack.handle()).toBe(false)
  })
})

/**
 * Die Ebenen sind benannt.
 *
 * Das ändert nichts am Ablauf, macht den Zustand aber lesbar: „was ist offen?“
 * beantwortet `top()` bzw. `names()` – vorher waren es sieben Booleans in
 * sieben Dateien und anonyme Rückrufe im Stapel. Ein späterer Router kann an
 * diesen Namen seine Adressen aufhängen.
 */
describe('Back-Stack mit Namen', () => {
  it('nennt die oberste Ebene', () => {
    const stack = createBackStack()
    expect(stack.top()).toBeNull()

    stack.push(() => {}, 'aufgabe-bearbeiten')
    expect(stack.top()).toBe('aufgabe-bearbeiten')

    stack.push(() => {}, 'liste-verwalten')
    expect(stack.top()).toBe('liste-verwalten')
  })

  it('zählt die Ebenen von unten nach oben auf', () => {
    const stack = createBackStack()
    stack.push(() => {}, 'aufgabe-detail')
    stack.push(() => {}, 'aufgabe-verschieben')

    expect(stack.names()).toEqual(['aufgabe-detail', 'aufgabe-verschieben'])

    stack.handle()
    expect(stack.names()).toEqual(['aufgabe-detail'])
  })

  it('kommt ohne Namen aus', () => {
    const stack = createBackStack()
    stack.push(() => {})
    expect(stack.top()).toBeNull()
    expect(stack.names()).toEqual(['(ohne Namen)'])
  })
})
