/**
 * Was dasteht, wenn nichts dasteht.
 *
 * Der Leerzustand ist der einzige Bildschirmzustand, den ein Screenshot mit
 * Daten nie zeigt – und deshalb der, den man vergisst (`DESIGN.md` P34, P36).
 * „Noch keine Aufgaben" ist eine Feststellung; „… schreib oben die erste" ist
 * eine Einladung. Jeder Text hier endet mit dem nächsten Schritt.
 *
 * Der **erste Satz** ist für beide Ansichten derselbe (P57): Die Information
 * wird gleich formuliert, egal wo sie erscheint. Nur der Weg dorthin
 * unterscheidet sich, und das darf er (P62): Auf dem Telefon tippt man, in der
 * breiten Ansicht schreibt man in das Feld darüber.
 *
 * `tests/unit/emptyTexts.test.ts` hält beides fest: dass eine Einladung dabei
 * ist und dass der gemeinsame Satz wirklich gemeinsam ist.
 */

const KEINE_AUFGABEN = 'Noch keine Aufgaben in dieser Liste.'
const KEINE_LISTE = 'Noch keine Liste vorhanden.'

export type Ansicht = 'breit' | 'mobil'

/** Leere Aufgabenliste. */
export function leerAufgaben(ansicht: Ansicht): string {
  return `${KEINE_AUFGABEN} ${
    ansicht === 'breit' ? 'Schreib oben die erste.' : 'Tippe auf +, um die erste anzulegen.'
  }`
}

/** Keine Liste vorhanden (Seitenleiste bzw. Menü). */
export function leerListen(ansicht: Ansicht): string {
  return `${KEINE_LISTE} ${
    ansicht === 'breit'
      ? 'Leg unten die erste an.'
      : 'Tippe unten auf „Neue Liste", um die erste anzulegen.'
  }`
}

/** Keine Bereiche in einer Liste. */
export const LEER_BEREICHE = 'Noch keine Bereiche. Leg unten den ersten an.'

/** Niemand außer mir hat Zugriff auf diese Liste. */
export const LEER_MITGLIEDER =
  'Noch keine Mitglieder. Teile die Liste über die Adresse einer Person.'
