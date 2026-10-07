import type { SyncTone } from './status/syncStatus'

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
 *   Hier stehen **keine Palettenwerte**. Farben, Schriftgrößen und Rundungen
 *   sind Rollen und stehen in `src/index.css` als CSS-Variablen
 *   (`--color-ink-muted`, `--text-meta`, `--radius-card`); Tailwind macht
 *   daraus `text-ink-muted`, `text-meta`, `rounded-card`. Diese Datei ordnet sie
 *   nur noch zu Bedeutung: „Fehler“ sieht in beiden Ansichten gleich aus, weil
 *   es genau eine Stelle dafür gibt.
 */

const focusRing =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-soft'

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
const buttonBase = `inline-flex items-center justify-center gap-2 rounded-control font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`

const buttonSizes = {
  /** Der Standardknopf. */
  md: 'px-3 py-2.5 text-body',
  /** Kompakt – Kopfzeilen, dichte Bereiche. */
  sm: 'px-2 py-1 text-meta',
  /** Blockknopf: gleiche Schrift, mehr Höhe für die Trefferfläche. */
  block: 'px-3 py-3 text-body',
  /** Nur ein Symbol (rundum gleiche Polsterung). */
  icon: 'h-11 w-11',
} as const

const buttonVariants = {
  primary: 'bg-brand text-on-brand hover:bg-brand-soft',
  secondary: 'border border-line-strong bg-surface text-ink hover:bg-raised',
  ghost: 'text-ink-muted hover:bg-raised hover:text-ink',
  /**
   * Ein Bediensymbol ohne Rahmen. `active:` ist die Rückmeldung auf dem
   * Telefon, `hover:` die auf dem Rechner (siehe `AGENTS.md`, erlaubte
   * Unterschiede).
   */
  icon: 'text-ink-muted hover:bg-raised hover:text-ink active:bg-raised',
  /** Ein Symbolknopf, das heller steht – die Hauptbedienung der App-Leiste. */
  iconBright: 'text-ink-soft hover:bg-raised hover:text-ink active:bg-raised',
  iconMuted: 'text-ink-faint hover:bg-raised hover:text-ink-soft',
  /** Ein Symbol, das einen aktiven Zustand zeigt (gefüllter Stern). */
  iconActive: 'text-brand-soft hover:bg-raised hover:text-brand-ink active:bg-raised',
  danger: 'border border-danger-line/60 bg-danger-tint/40 text-danger-ink hover:bg-danger-tint/70',
  /** Zurückgenommen, aber mit Aufmerksamkeit – etwa „neue Fassung da“. */
  attention: 'text-warn hover:bg-raised hover:text-warn-ink',
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






export const input = `w-full rounded-control border border-line-strong bg-surface px-3 py-2 text-body text-ink placeholder:text-ink-faint ${focusRing}`

/**
 * Schmales Feld für die Zahlen einer eigenen Vorlaufzeit.
 *
 * Bewusst nicht aus `input` zusammengesetzt: Tailwind ordnet Padding-Klassen in
 * der Reihenfolge des Stylesheets, nicht des Klassenattributs. Ein angehängtes
 * `px-2` verdrängt das `px-3` aus `input` deshalb nicht – das Feld blieb breit
 * gepolstert und schnitt bei drei Ziffern ab.
 */
export const numberInput = `w-full rounded-control border border-line-strong bg-surface px-2 py-1 text-body text-ink ${focusRing}`

/**
 * Die Ebenen übereinander.
 *
 * Eine Zahl zu wählen ist eine Entscheidung über Reihenfolge – sie gehört
 * benannt. Vorher standen sieben Werte an neun Stellen ohne Bezug zueinander;
 * niemand konnte sagen, warum das Menü bei 40 und das Blatt bei 50 liegt.
 */
export const layer = {
  /** Eine Zeile, die gerade gezogen wird. */
  row: 'z-10',
  /** Der runde Plus-Knopf. */
  fab: 'z-20',
  /** Die App-Leiste. */
  appBar: 'z-30',
  /** Schwebende Leisten und das Menü. */
  raised: 'z-40',
  /** Blätter und Dialoge. */
  screen: 'z-50',
  /** Ein Dialog über einem Dialog – die Ziel-Auswahl beim Verschieben. */
  top: 'z-60',
} as const

/** Der Grund hinter allem: reines Schwarz, kein Grau. */
export const appBackground = 'bg-page'

/** Eine Karte: Panels, aufgeklappte Bereiche, Dialoginhalte. */
export const card = 'rounded-card border border-line bg-surface/60 p-4'

/**
 * Die gedämpfte Karte – Karten **in** Karten und Zeilen: die Aufgabenzeile,
 * aufgeklappte Zusatzfelder, eine Hinweisbox.
 *
 * Vorher gab es dafür sieben Ausprägungen (zwei Deckkräfte, drei Polsterungen)
 * in fünf Dateien; der Token `card` stand daneben und wurde nie benutzt.
 */
export const cardSoft = 'rounded-card border border-line bg-surface/40 p-3'

/** Der leere Zustand: gestrichelter Rahmen statt einer Fläche. */
export const emptyState =
  'rounded-card border border-dashed border-line px-3 py-6 text-center text-body text-ink-faint'

export const link = `rounded-control text-brand-soft underline-offset-2 hover:underline ${focusRing}`

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
  ok: { dot: 'bg-ok', text: 'text-ok', label: 'Alles synchronisiert' },
  pending: { dot: 'bg-warn', text: 'text-warn', label: 'Synchronisation ausstehend' },
  error: { dot: 'bg-danger', text: 'text-danger', label: 'Synchronisation fehlgeschlagen' },
}

/** Hervorhebung für überfällige Aufgaben. */
export const dangerText = 'text-danger'

/**
 * Hinweis, der Aufmerksamkeit braucht – etwa eine verfügbare neue Fassung.
 *
 * Bewusst getrennt von den Sync-Zuständen: „ausstehend“ und „hier gibt es
 * etwas zu tun“ sind verschiedene Aussagen.
 */
export const attentionText = 'text-warn'
export const attentionDot = 'bg-warn'

/** Inline-Meldung unter einem Formular – Fehler und Erfolg. */
export const errorMessage = 'text-meta text-danger'
export const successMessage = 'text-meta text-ok'

/** Umschlossene Meldungsbox (Anmeldung und Registrierung). */
export const errorBox =
  'rounded-control border border-danger-line/60 bg-danger-tint/40 px-3 py-2 text-body text-danger-ink'
export const successBox =
  'rounded-control border border-ok-line/60 bg-ok-tint/40 px-3 py-2 text-body text-ok-ink'

/** Zurückgenommener Text für Hinweise und Metadaten. */
export const mutedText = 'text-ink-faint'

/**
 * Ein Bediensymbol, das einen aktiven Zustand zeigt – etwa der gefüllte Stern
 * an einer Erinnerung, die in der Schnellauswahl liegt.
 *
 * Steht hier und nicht in der Komponente, weil derselbe Zustand überall
 * dieselbe Farbe haben soll. Der Architekturtest fängt nur die Statusfarben
 * (emerald/amber/red) ab; für alles andere ist diese Datei die Absprache.
 */
export const activeIcon = 'text-brand-soft'

/**
 * Zahlen, die sich ändern, in fester Breite (`DESIGN.md` P19).
 *
 * Zähler („3 Änderungen warten") und Datumsangaben springen sonst beim Wechsel:
 * Eine 1 ist schmaler als eine 8, und der Text dahinter rutscht mit.
 * `tabular-nums` gibt jeder Ziffer dieselbe Breite. Als Konstante, damit die
 * Regel an einer Stelle steht und `tests/unit/uiConventions.test.ts` sie
 * durchsetzen kann.
 */
export const numeric = 'tabular-nums'
