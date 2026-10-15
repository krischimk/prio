import type { BackHandler, BackStack } from './backStack'

interface Entry { session: string; index: number; listId: string | null; layers: number[] }
export interface NavigationPort {
  push(entry: Entry): void
  replace(entry: Entry): void
  go(delta: number): void
  listen(listener: (entry: unknown) => void): () => void
}

/** Browser und Android teilen Besuche und Ebenen; IndexedDB enthält keine UI-Kopie. */
export function createNavigation(port: NavigationPort, session: string) {
  let listId: string | null = null
  let index = 0
  let nextLayer = 0
  let queued = false
  let disposed = false
  let programmaticBack = false
  const layers: Array<{ id: number; handler: BackHandler; onHistoryBack: BackHandler; name: string | null }> = []
  const listeners = new Set<() => void>()
  let entries: Entry[] = [{ session, index, listId, layers: [] }]
  const same = (a: Entry, b: Entry) => a.listId === b.listId && a.layers.join(',') === b.layers.join(',')
  const snapshot = (): Entry => ({ session, index, listId, layers: layers.map(layer => layer.id) })

  const sync = () => {
    queued = false
    if (disposed || programmaticBack) return
    const next = snapshot()
    const before = entries[index]
    if (same(before, next)) return
    if (next.listId !== before.listId && before.layers.length > 0 && next.layers.length === 0) {
      // Eine Auswahl im Menü ersetzt dessen Eintrag durch den neuen Besuch.
      // Sonst läge beim Vorwärtsgehen ein bereits geschlossenes Menü dazwischen.
      entries[index] = next
      port.replace(next)
      return
    }
    if (next.listId === before.listId && next.layers.length < before.layers.length) {
      const target = entries.slice(0, index).findLast(entry => same(entry, next))
      if (target) { programmaticBack = true; port.go(target.index - index); return }
    }
    if (next.listId !== before.listId || (next.layers.length > before.layers.length && before.layers.every((id, at) => next.layers[at] === id))) {
      index += 1
      const entry = { ...next, index }
      entries = [...entries.slice(0, index), entry]
      port.push(entry)
    } else {
      // Austausch eines kurz ladenden Dialograhmens oder eines Unterdialogs.
      entries[index] = next
      port.replace(next)
    }
  }
  const schedule = () => {
    if (!queued && !disposed) { queued = true; queueMicrotask(sync) }
  }
  const onPop = (value: unknown) => {
    if (!value || typeof value !== 'object') return
    const entry = value as Partial<Entry>
    if (entry.session !== session || !Number.isInteger(entry.index) || !entries[entry.index!]) return
    const target = entries[entry.index!]
    index = target.index
    if (programmaticBack) {
      programmaticBack = false
    } else {
      // Browser-Zurück schließt die betroffenen Dialoge. Native Zurück/Escape
      // dürfen zusätzlich den lokalen Untermodus eines Blatts zurücknehmen.
      for (const layer of [...layers].reverse()) {
        if (!target.layers.includes(layer.id)) layer.onHistoryBack()
      }
      listId = target.listId
      for (const listener of listeners) listener()
    }
    schedule()
  }
  let stop = () => {}

  const stack: BackStack = {
    push(handler, name, onHistoryBack = handler) {
      const layer = { id: ++nextLayer, handler, onHistoryBack, name: name ?? null }
      layers.push(layer); schedule()
      return () => {
        const at = layers.indexOf(layer)
        if (at >= 0) { layers.splice(at, 1); schedule() }
      }
    },
    handle() {
      const layer = layers.at(-1)
      if (!layer) return false
      // Der aktive Rahmen meldet sich beim tatsächlichen Schließen ab. Ein
      // „Zur Übersicht“ im selben Blatt bleibt dadurch weiter zurück-bedienbar.
      layer.handler()
      return true
    },
    size: () => layers.length,
    top: () => layers.at(-1)?.name ?? null,
    names: () => layers.map(layer => layer.name ?? '(ohne Namen)'),
    clear() { layers.splice(0); schedule() },
  }
  return {
    start() {
      disposed = false
      port.replace(entries[index])
      stop = port.listen(onPop)
      return () => { disposed = true; stop() }
    },
    stack,
    selectedListId: () => listId,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } },
    selectList(id: string | null) {
      if (id === listId) return
      listId = id
      for (const listener of listeners) listener()
      schedule()
    },
    back() {
      if (stack.handle()) return true
      if (index === 0) return false
      port.go(-1)
      return true
    },
    dispose() { disposed = true; stop() },
  }
}
export type Navigation = ReturnType<typeof createNavigation>
