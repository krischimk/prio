/** Der Schluessel der Gruppe ohne Bereich. */
export const OHNE_BEREICH = 'ohne-bereich'

/**
 * Umsortieren in der Vorschau (reine Funktion).
 *
 * Der Zieh-Haken liefert nur das **Ziel**: die Gruppe unter dem Finger und den
 * Platz darin. Wie die Liste daraus aussieht, wird hier gerechnet – einmal für
 * die Anzeige während des Ziehens und einmal für die Reihenfolge, die beim
 * Loslassen geschrieben wird. Beide Wege sind damit derselbe, und die Anzeige
 * kann nicht vom Ergebnis abweichen.
 *
 * Vorher rechnete der Haken die Reihenfolge selbst, aus Kennungen und einer
 * Zuordnung „Aufgabe → Gruppe", die er von außen bekam. Lief beides
 * auseinander, blieb die Vorschau still – der Zug sah aus, als täte er nichts.
 */
export function ordneUm<T extends { id: string }>({
  eintraege,
  gruppen,
  gruppeVon,
  gezogeneId,
  ziel,
}: {
  /** Die Einträge in ihrer aktuellen Reihenfolge. */
  eintraege: T[]
  /** Die Gruppen in ihrer Reihenfolge. */
  gruppen: string[]
  /** Zu welcher Gruppe ein Eintrag gehört. */
  gruppeVon: (eintrag: T) => string
  /** Der gezogene Eintrag. */
  gezogeneId: string
  /** Wohin er soll. */
  ziel: { gruppe: string; index: number }
}): T[] {
  const andere = eintraege.filter((eintrag) => eintrag.id !== gezogeneId)
  const gezogen = eintraege.find((eintrag) => eintrag.id === gezogeneId)

  const reihenfolge: T[] = []
  for (const gruppe of gruppen) {
    const inGruppe = andere.filter((eintrag) => gruppeVon(eintrag) === gruppe)
    if (gruppe === ziel.gruppe && gezogen) {
      reihenfolge.push(...inGruppe.slice(0, ziel.index), gezogen, ...inGruppe.slice(ziel.index))
    } else {
      reihenfolge.push(...inGruppe)
    }
  }

  /*
   * Sicherung: Was in keiner Gruppe auftaucht, kommt hinten dran. Ein Eintrag
   * darf hier **nie** verloren gehen – die Vorschau wird beim Loslassen
   * geschrieben.
   */
  const platziert = new Set(reihenfolge.map((eintrag) => eintrag.id))
  for (const eintrag of eintraege) {
    if (!platziert.has(eintrag.id)) reihenfolge.push(eintrag)
  }
  return reihenfolge
}
