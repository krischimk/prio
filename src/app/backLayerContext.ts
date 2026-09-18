import { createContext } from 'react'
import type { BackStack } from './backStack'

/**
 * Kontext für den Back-Stack.
 *
 * Eigene Datei, damit `BackLayerProvider` nur die Komponente exportiert –
 * das hält Fast Refresh im Dev-Server intakt.
 */
export const BackLayerContext = createContext<BackStack | null>(null)
