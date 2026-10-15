import { describe, expect, it } from 'vitest'
import { orderedLists, placeNavigationList } from '../../src/domain/listNavigation'
import { localList, localListPreference } from '../support/factories'

const lists = ['A', 'B', 'C'].map(id => localList({ id, name: id }))

describe('persönliche Listennavigation', () => {
  it('behält ohne persönliche Werte den alphabetischen Einstieg', () => {
    expect(orderedLists([...lists].reverse(), []).map(row => row.id)).toEqual(['A', 'B', 'C'])
  })
  it('verschiebt vor einen Nachbarn und behält nachträgliche Neuzugänge', () => {
    const placed = placeNavigationList(lists, [], 'C', { hidden: false, beforeListId: 'A' })
    expect(placed.filter(row => !row.hidden).map(row => row.listId)).toEqual(['C', 'A', 'B'])
  })
  it('versteckt unabhängig von der Gesamtansicht und kann zurückverschieben', () => {
    const preferences = [localListPreference({ list_id: 'B', hidden: true, include_in_overview: true, position: 1 })]
    const placed = placeNavigationList(lists, preferences, 'A', { hidden: true, beforeListId: 'B' })
    expect(placed.filter(row => row.hidden).map(row => row.listId)).toEqual(['A', 'B'])
    expect(preferences[0].include_in_overview).toBe(true)
    expect(placeNavigationList(lists, preferences, 'B', { hidden: false, beforeListId: 'C' }).map(row => row.listId)).toEqual(['A', 'B', 'C'])
  })
  it('verwirft ein nicht mehr erreichbares Ziel statt beliebig umzuräumen', () => {
    expect(() => placeNavigationList(lists, [], 'A', { hidden: true, beforeListId: 'weg' })).toThrow()
  })
})
