import { describe, expect, it, vi } from 'vitest'
import { createNavigation, type NavigationPort } from '../../src/app/navigation'

function setup() {
  let listener: (entry: unknown) => void = () => {}
  const entries: unknown[] = []
  let index = 0
  const port: NavigationPort = {
    replace: entry => { entries[index] = entry },
    push: entry => { index += 1; entries.splice(index); entries[index] = entry },
    go: delta => { queueMicrotask(() => { index += delta; listener(entries[index]) }) },
    listen: callback => { listener = callback; return () => { listener = () => {} } },
  }
  const nav = createNavigation(port, 'test')
  nav.start()
  return { nav, port, entries, index: () => index }
}
async function settle() { for (let i = 0; i < 6; i++) await Promise.resolve() }

describe('Browser- und Android-Navigation', () => {
  it('geht durch Listen zurück und vorwärts', async () => {
    const { nav, port } = setup()
    nav.selectList('A'); await settle()
    nav.selectList('B'); await settle()
    port.go(-1); await settle()
    expect(nav.selectedListId()).toBe('A')
    port.go(1); await settle()
    expect(nav.selectedListId()).toBe('B')
  })
  it('schließt verschachtelte Ebenen vor dem Listenwechsel', async () => {
    const { nav, port } = setup()
    nav.selectList('A'); await settle()
    const closeSheet = vi.fn(() => removeSheet())
    const removeSheet = nav.stack.push(closeSheet, 'Aufgabe')
    await settle()
    const closeCalendar = vi.fn(() => removeCalendar())
    const removeCalendar = nav.stack.push(closeCalendar, 'Kalender')
    await settle()
    port.go(-1); await settle()
    expect(closeCalendar).toHaveBeenCalledOnce()
    expect(closeSheet).not.toHaveBeenCalled()
    expect(nav.selectedListId()).toBe('A')
    port.go(-1); await settle()
    expect(closeSheet).toHaveBeenCalledOnce()
    expect(nav.selectedListId()).toBe('A')
    port.go(-1); await settle()
    expect(nav.selectedListId()).toBeNull()
  })
  it('hinterlässt nach Schließen per Knopf keinen leeren Zurück-Schritt', async () => {
    const { nav, port, index } = setup()
    nav.selectList('A'); await settle()
    const remove = nav.stack.push(() => {}, 'Konto'); await settle()
    remove(); await settle()
    expect(index()).toBe(1)
    port.go(-1); await settle()
    expect(nav.selectedListId()).toBeNull()
  })
  it('nimmt Menüauswahl als Listenbesuch und verliert keine spätere Öffnung', async () => {
    const { nav, port } = setup()
    nav.selectList('A'); await settle()
    const closeMenu = nav.stack.push(() => {}, 'Menü'); await settle()
    nav.selectList('B'); closeMenu(); await settle()
    port.go(-1); await settle()
    expect(nav.selectedListId()).toBe('A')
    expect(nav.stack.size()).toBe(0)
    port.go(1); await settle()
    expect(nav.selectedListId()).toBe('B')
  })
  it('Android nimmt zuerst einen Untermodus zurück und bleibt danach bedienbar', async () => {
    const { nav } = setup()
    const historyClose = vi.fn()
    const back = vi.fn()
    const remove = nav.stack.push(back, 'Liste', historyClose)
    await settle()
    expect(nav.back()).toBe(true)
    expect(nav.back()).toBe(true)
    expect(back).toHaveBeenCalledTimes(2)
    expect(historyClose).not.toHaveBeenCalled()
    remove(); await settle()
    expect(nav.back()).toBe(false)
  })
})
