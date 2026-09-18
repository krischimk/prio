/**
 * Gemeinsame Tailwind-Klassen.
 *
 * Bewusst nur Konstanten statt eigener Komponenten: Für einen Prototyp ist das
 * weniger Abstraktion und der Aufbau bleibt in den Komponenten sichtbar.
 */

const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400'

export const button = `inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`

export const primaryButton = `${button} bg-indigo-500 text-white hover:bg-indigo-400`

export const secondaryButton = `${button} border border-neutral-700 bg-neutral-900 text-neutral-100 hover:bg-neutral-800`

export const ghostButton = `${button} text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100`

export const dangerButton = `${button} border border-red-900/60 bg-red-950/40 text-red-300 hover:bg-red-950/70`

export const input = `w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-500 ${focusRing}`

export const card = 'rounded-lg border border-neutral-800 bg-neutral-900/60 p-4'

export const link = `rounded text-indigo-400 underline-offset-2 hover:underline ${focusRing}`
