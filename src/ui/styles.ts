import type { SyncTone } from '../sync/syncStatus'

/**
 * Gemeinsame Tailwind-Klassen und die semantischen Farben der Oberfläche.
 *
 * Was hier steht und was nicht:
 *
 *   Hier stehen Farben, die eine **Bedeutung** tragen – Zustand, Gefahr,
 *   gedämpfter Text. Sie dürfen genau einmal definiert sein, damit „Fehler“ in
 *   der breiten und der mobilen Ansicht nicht versehentlich verschieden
 *   aussieht.
 *
 *   Hier stehen außerdem die **Knöpfe**: eine Grundlage, eine Größenskala und
 *   die Arten. Eine Größe wird gewählt, nicht angehängt – siehe unten.
 *
 *   Noch nicht hier stehen die Stufen der Tailwind-Skala als solche
 *   (`text-neutral-400` für „etwas unwichtiger“). Sie werden zu Rollen, sobald
 *   es Farbvariablen gibt (`DESIGN.md` §15.2).
 */

const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400'

/*
 * Warum eine Funktion und keine angehängte Zeichenkette
 *
 * Tailwind ordnet die Utilities in der Reihenfolge des **Stylesheets**, nicht
 * des Klassenattributs. Ein an einen fertigen Knopfstil gehängtes `px-2`
 * verdrängt dessen `px-3` deshalb nicht – es wirkt schlicht nicht. Im gebauten
 * Stylesheet steht `.px-3` hinter `.px-2` und `.py-2` hinter `.py-1`; so sind
 * 22 „kompakte“ Knöpfe entstanden, die nie kompakt waren (nur ihre Schrift war
 * kleiner). Genau daran ist vorher auch das schmale Zahlenfeld gescheitert
 * (`numberInput`).
 *
 * Deshalb wird die Größe **gewählt** statt angehängt:
 *
 *   className={buttonClass('ghost', 'sm')}
 *   className={buttonClass('secondary', 'md', 'w-full')}
 *
 * `extra` ist für **Layout** da (Breite, Außenabstand, Ausrichtung) – nicht für
 * Polsterung, Farbe oder Schriftgröße. Die kommen aus Größe und Art.
 * `tests/unit/uiConventions.test.ts` hält das fest.
 */
const buttonBase = `inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`

const buttonSizes = {
  /** Der Standardknopf. */
  md: 'px-3 py-2 text-sm',
  /** Kompakt – Kopfzeilen, dichte Bereiche. */
  sm: 'px-2 py-1 text-xs',
  /** Blockknopf: gleiche Schrift, mehr Höhe für die Trefferfläche. */
  block: 'px-3 py-3 text-sm',
  /** Nur ein Symbol (rundum gleiche Polsterung). */
  icon: 'p-2',
} as const

const buttonVariants = {
  primary: 'bg-indigo-500 text-white hover:bg-indigo-400',
  secondary: 'border border-neutral-700 bg-neutral-900 text-neutral-100 hover:bg-neutral-800',
  ghost: 'text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100',
  /**
   * Ein Bediensymbol ohne Rahmen. `active:` ist die Rückmeldung auf dem
   * Telefon, `hover:` die auf dem Rechner (siehe `AGENTS.md`, erlaubte
   * Unterschiede).
   */
  icon: 'text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100 active:bg-neutral-800',
  /** Ein Symbolknopf, das heller steht – die Hauptbedienung der App-Leiste. */
  iconBright: 'text-neutral-300 hover:bg-neutral-800 hover:text-neutral-100 active:bg-neutral-800',
  iconMuted: 'text-neutral-500 hover:bg-neutral-800 hover:text-neutral-300',
  /** Ein Symbol, das einen aktiven Zustand zeigt (gefüllter Stern). */
  iconActive: 'text-indigo-400 hover:bg-neutral-800 hover:text-indigo-300 active:bg-neutral-800',
  danger: 'border border-red-900/60 bg-red-950/40 text-red-300 hover:bg-red-950/70',
  /** Zurückgenommen, aber mit Aufmerksamkeit – etwa „neue Fassung da“. */
  attention: 'text-amber-400 hover:bg-neutral-800 hover:text-amber-300',
} as const

export type ButtonSize = keyof typeof buttonSizes
export type ButtonVariant = keyof typeof buttonVariants

/** Setzt einen Knopf aus Grundlage, Größe, Art und Layout zusammen. */
export function buttonClass(
  variant: ButtonVariant = 'primary',
  size: ButtonSize = 'md',
  extra = '',
): string {
  return [buttonBase, buttonSizes[size], buttonVariants[variant], extra].filter(Boolean).join(' ')
}

export const primaryButton = buttonClass('primary')

export const secondaryButton = buttonClass('secondary')

export const ghostButton = buttonClass('ghost')

export const dangerButton = buttonClass('danger')

/** Symbolknopf: Schließen, Menü, Synchronisation. */
export const iconButton = buttonClass('icon', 'icon')

export const input = `w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-500 ${focusRing}`

/**
 * Schmales Feld für die Zahlen einer eigenen Vorlaufzeit.
 *
 * Bewusst nicht aus `input` zusammengesetzt: Tailwind ordnet Padding-Klassen in
 * der Reihenfolge des Stylesheets, nicht des Klassenattributs. Ein angehängtes
 * `px-2` verdrängt das `px-3` aus `input` deshalb nicht – das Feld blieb breit
 * gepolstert und schnitt bei drei Ziffern ab.
 */
export const numberInput = `w-full rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1 text-sm text-neutral-100 ${focusRing}`

/** Der Grund hinter allem: reines Schwarz, kein Grau. */
export const appBackground = 'bg-black'

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

/**
 * Ein Bediensymbol, das einen aktiven Zustand zeigt – etwa der gefüllte Stern
 * an einer Erinnerung, die in der Schnellauswahl liegt.
 *
 * Steht hier und nicht in der Komponente, weil derselbe Zustand überall
 * dieselbe Farbe haben soll. Der Architekturtest fängt nur die Statusfarben
 * (emerald/amber/red) ab; für alles andere ist diese Datei die Absprache.
 */
export const activeIcon = 'text-indigo-400'
