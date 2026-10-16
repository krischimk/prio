import { describe, expect, it } from 'vitest'
import { mergeTaskExpansions, parseTaskExpansions } from '../../src/domain/taskExpansion'
import { normalisiereStartansicht } from '../../src/domain/normalize'
import { localUserPreference } from '../support/factories'

describe('Persönlich aufgeklappte Aufgaben', () => {
  it('liest alte und ungültige Werte als zugeklappt', () => {
    expect(normalisiereStartansicht({ ...localUserPreference(), task_expansions: undefined } as never).task_expansions).toEqual({})
    expect(parseTaskExpansions({ a: 1, b: 2, c: 3, d: 4, e: true, '': 1 })).toEqual({ a: 1, b: 2, c: 3 })
    expect(parseTaskExpansions([])).toEqual({})
  })
  it('führt verschiedene Aufgaben und beide Schalter derselben Aufgabe zusammen', () => {
    expect(mergeTaskExpansions({ a: 1 }, { a: 0, b: 1 }, { a: 3, c: 2 })).toEqual({ a: 2, b: 1, c: 2 })
    expect(mergeTaskExpansions({}, { a: 1 }, { a: 2 })).toEqual({ a: 3 })
    expect(mergeTaskExpansions({ a: 3 }, { a: 2 }, { a: 1 })).toEqual({})
  })
})
