import { describe, expect, it, vi } from 'vitest'
import { createRepositories, type Repositories } from '../../src/db/repositories'
import { openLocalDatabase } from '../../src/db/localDb'
import {
  LESEND,
  NUR_LOKAL,
  SCHREIBEND,
  withChangeTracking,
} from '../../src/app/trackedRepositories'

/**
 * Die Einordnung der Datenbankmethoden.
 *
 * Sie ist fachlich entscheidend: Eine schreibende Methode in der Lese-Gruppe
 * heißt, dass ihre Daten nie hochgeladen werden; eine Eingabehilfe in der
 * Schreib-Gruppe lässt die App im Sekundentakt synchronisieren (genau das ist
 * schon einmal passiert). Geprüft wird deshalb, dass die drei Listen die
 * Methoden der Datenbank **genau** abdecken und dass die Rückrufe dort landen,
 * wo sie sollen.
 */
async function repositories(): Promise<Repositories> {
  const db = await openLocalDatabase(`test-${Math.random().toString(36).slice(2)}`)
  return createRepositories(db)
}

describe('withChangeTracking', () => {
  it('umhüllt jede Methode der Datenbank – keine mehr, keine weniger', async () => {
    const original = await repositories()
    const umhuellt = withChangeTracking(original, () => {}, () => {})

    expect(Object.keys(umhuellt).sort()).toEqual(Object.keys(original).sort())
    for (const name of Object.keys(original)) {
      expect(typeof umhuellt[name as keyof Repositories]).toBe('function')
    }
  })

  it('ordnet jede Methode genau einmal ein', async () => {
    const original = await repositories()
    const alle = Object.keys(original).sort()
    const eingeordnet = [...SCHREIBEND, ...NUR_LOKAL, ...LESEND].sort()

    // Eine neue Methode in `createRepositories`, die in keiner Liste steht,
    // lässt genau diese Zusicherung scheitern.
    expect(eingeordnet).toEqual(alle)
    expect(new Set(eingeordnet).size).toBe(eingeordnet.length)
  })

  it('meldet eine Datenänderung als Änderung', async () => {
    const original = await repositories()
    const onChange = vi.fn()
    const nurLokal = vi.fn()
    const umhuellt = withChangeTracking(original, onChange, nurLokal)

    await umhuellt.createList('Haushalt', 'user-1')

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(nurLokal).not.toHaveBeenCalled()
  })

  it('meldet eine lokale Eingabehilfe getrennt – sonst liefe der Abgleich in einer Schleife', async () => {
    const original = await repositories()
    const onChange = vi.fn()
    const nurLokal = vi.fn()
    const umhuellt = withChangeTracking(original, onChange, nurLokal)

    await umhuellt.setReminderPresets([10, 60])

    expect(nurLokal).toHaveBeenCalledTimes(1)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('zählt beim Lesen nichts', async () => {
    const original = await repositories()
    const onChange = vi.fn()
    const nurLokal = vi.fn()
    const umhuellt = withChangeTracking(original, onChange, nurLokal)

    await umhuellt.listLists()
    await umhuellt.listRestorableTasks()

    expect(onChange).not.toHaveBeenCalled()
    expect(nurLokal).not.toHaveBeenCalled()
  })
})
