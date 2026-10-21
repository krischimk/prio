import { createContext } from 'react'
import type { PriorityRank } from '../domain/overviewOrdering'

/** Nur aus den sichtbaren Aufgaben abgeleitet; kein eigener Datenbestand. */
export const PriorityRanksContext = createContext<ReadonlyMap<string, PriorityRank>>(new Map())
