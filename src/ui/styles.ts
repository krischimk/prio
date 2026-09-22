import type { SyncTone } from '../sync/syncStatus'

/**
 * Gemeinsame Tailwind-Klassen und die semantischen Farben der Oberfläche.
 *
 * Bewusst nur Konstanten statt eigener Komponenten: Für einen Prototyp ist das
 * weniger Abstraktion und der Aufbau bleibt in den Komponenten sichtbar.
 *
 * Was hier steht und was nicht:
 *
 *   Hier stehen Farben, die eine **Bedeutung** tragen – Zustand, Gefahr,
 *   gedämpfter Text. Sie dürfen genau einmal definiert sein, damit „Fehler“ in
 *   der breiten und der mobilen Ansicht nicht versehentlich verschieden
 *   aussieht.
 *
 *   Nicht hier stehen die Stufen der Tailwind-Skala als solche
 *   (`text-neutral-400` für „etwas unwichtiger“). Sie zu Konstanten zu machen
 *   würde nichts verhindern: Derselbe Wert ergibt dieselben Pixel, und die
 *   Komponenten würden nur schwerer lesbar.
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

/* -------------------------------------------------------------------------- */
/* Semantische Farben                                                          */
/* -------------------------------------------------------------------------- */

/** Ein Zustand des Synchronisation – als Punkt, als Text und als Beschriftung. */
export interface SyncToneStyle {
  /** Hintergrund für einen kleinen farbigen Punkt. */
  dot: string
  /** Textfarbe für die zugehörige Meldung. */
  text: string
  /** Kurze Beschreibung, auch für Vorleseprogramme. */
  label: string
}

/**
 * Die einzige Stelle, an der ein Sync-Zustand eine Farbe bekommt.
 *
 * Wird von der Statusanzeige, der mobilen App-Leiste und den Erinnerungen
 * benutzt – vorher stand dieselbe Abbildung dreimal im Code.
 */
export const statusTone: Record<SyncTone, SyncToneStyle> = {
  ok: { dot: 'bg-emerald-400', text: 'text-emerald-400', label: 'Alles synchronisiert' },
  pending: { dot: 'bg-amber-400', text: 'text-amber-400', label: 'Synchronisation ausstehend' },
  error: { dot: 'bg-red-400', text: 'text-red-400', label: 'Synchronisation fehlgeschlagen' },
}

/** Hervorhebung für überfällige Aufgaben. */
export const dangerText = 'text-red-400'

/**
 * Hinweis, der Aufmerksamkeit braucht – etwa eine verfügbare neue Fassung.
 *
 * Bewusst getrennt von den Sync-Zuständen: „ausstehend“ und „hier gibt es
 * etwas zu tun“ sind verschiedene Aussagen.
 */
export const attentionText = 'text-amber-400'
export const attentionDot = 'bg-amber-400'

/** Inline-Meldung unter einem Formular – Fehler und Erfolg. */
export const errorMessage = 'text-xs text-red-400'
export const successMessage = 'text-xs text-emerald-400'

/** Umschlossene Meldungsbox (Anmeldung und Registrierung). */
export const errorBox =
  'rounded-md border border-red-900/60 bg-red-950/40 px-3 py-2 text-sm text-red-300'
export const successBox =
  'rounded-md border border-emerald-900/60 bg-emerald-950/40 px-3 py-2 text-sm text-emerald-300'

/** Zurückgenommener Text für Hinweise und Metadaten. */
export const mutedText = 'text-neutral-500'
