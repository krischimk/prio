# Design-Prinzipien

**Status: Sammlung, kein Auftrag.** Dieses Dokument ist ein Vorrat für den
späteren UI-Überhaul. Es beschreibt nichts, was heute umgesetzt ist, und
verpflichtet zu nichts. Verbindliche Arbeitsregeln stehen weiterhin in
`AGENTS.md`.

## Wie dieses Dokument aufgebaut ist

Jedes Prinzip hat eine feste Nummer, eine Begründung und eine Angabe, wodurch
es durchgesetzt wird. Die Nummern sind stabil: „P31 verletzt" ist eine
brauchbare Review-Anmerkung, „der Leerzustand passt nicht" nicht.

**Durchsetzung** heißt eine von drei Stufen:

| Stufe | Bedeutung |
| --- | --- |
| **Test** | maschinell geprüft; eine Verletzung lässt den Lauf scheitern |
| **Review** | ein Mensch muss hinsehen (Screenshot, Kontrastrechner, Vorlesen) |
| **Disziplin** | nur durch Gewohnheit – die schwächste und häufigste Stufe |

Nach dem Grundsatz aus `AGENTS.md` gilt auch hier: *Eine Regel ohne Prüfung ist
ein Wunsch.* Die Spalte macht sichtbar, wie viele Wünsche darunter sind.

## Herkunft der Prinzipien

Drei Quellen, mit unterschiedlicher Belastbarkeit:

1. **Aus fremdem Quelltext gelesen** – [MorpheApp/morphe-manager][morphe]
   (GPL-3.0). Belastbar, weil nachprüfbar: Die Belege sind Datei- und
   Wertangaben, keine Erinnerung. Übernommen werden **Werte und Verfahren,
   kein Code** – siehe `THIRD-PARTY.md`.
2. **Etablierte Normen und Praxis** – WCAG 2.2, Material 3, Apple HIG und die
   gängige Fachliteratur. Belastbar, aber allgemein; die Kunst ist die Auswahl.
3. **Eigene Schlüsse für `prio`** – dort, wo `prio` anders ist als die Vorlagen
   (zwei Bedienmodelle, Web statt Compose, offline-first). Am unsichersten und
   am wertvollsten, weil es diese Kombination selten gibt.

---

## 1 Fundament: Werte

| # | Prinzip | Begründung | Durchsetzung |
| --- | --- | --- | --- |
| P1 | Jeder visuelle Wert ist benannt und liegt an genau einer Stelle. | Ein Wert an zwanzig Stellen sind zwanzig Entscheidungen; an einer ist es eine. Morphe bündelt alles in `object Defaults` (`shared/SettingComponents.kt`), `prio` hat den Ansatz in `src/ui/styles.ts`. | Test |
| P2 | Skalen statt Einzelwerte: Abstand, Radius, Höhe, Dauer. | Eine Skala macht „ein bisschen mehr" unmöglich und damit Inkonsistenz. Morphe: Abstand `8/16/24/32`, Elementabstand `12`. | Test |
| P3 | Die Größe eines Elements kodiert sein Gewicht. | Morphe begründet seine Knopfhöhen im Kommentar: Pille `36/40` sitzt in einer Kartenzeile, Glas-Tab `48` ist eine Registerkarte, Dialog-Knopf `52` ist der Grund, warum es den Dialog gibt. | Review |
| P4 | Bauteile verzweigen nicht auf einen Modus; dazwischen liegt eine Vermittlerschicht. | Morphe: „Component code routes through here instead of branching on `LocalThemeTraits` so that a new override lands in a single place." `outlines = false` nimmt jeden Rahmen der App auf einmal weg. | Test |
| P5 | Jeder Wert trägt seine Begründung im Code. | Ein Kommentar, der den Code wiederholt, ist Rauschen; einer, der das Warum festhält, ist das Design-Dokument. Morphe erklärt die 8er-Deckelung, die vier Rahmenstopps, die eine Blend-Schicht. Deckt sich mit „welcher Fehler war das?" aus `AGENTS.md`. | Review |
| P6 | Neue Werte entstehen nicht im Bauteil, sondern in der Skala. | Sonst wandert die Ausnahme in den Bestand und wird zur zweiten Regel. | Review |

## 2 Farbe

| # | Prinzip | Begründung | Durchsetzung |
| --- | --- | --- | --- |
| P7 | Eine Bedeutung hat genau eine Farbe. | Steht sinngemäß schon in `AGENTS.md` (`SyncTone → Farbe` existiert einmal) und wird von `tests/unit/uiConventions.test.ts` erzwungen. | Test |
| P8 | Eine Farbe, die von außen kommt, wird gerechnet – nicht gewählt. | Nutzer- und Iconfarben sind beliebig; Kontrast muss folgen. Morphe: `ensureContrast`, `distinctFromCard`, `readableOn(fill, surface, minRatio)` in `util/ColorUtils.kt`. | Test |
| P9 | Kontrast ist eine Zahl, keine Meinung: 4,5:1 für Text, 3:1 für große Schrift und Bedienelemente. | WCAG 2.2, 1.4.3 und 1.4.11. Rechenbar und damit prüfbar. | Test |
| P10 | Kontrast allein genügt nicht – die Polarität muss stimmen. | Morphe: Eine helle Fläche mit dunkler Schrift kann rechnerisch bestehen und trotzdem falsch aussehen, weil eine getönte Fläche die Paarung verschiebt, für die die Palette gedacht war. | Test |
| P11 | Zwei Flächen, die sich zu ähnlich sind, werden auseinandergezogen. | Morphe: `CardSeparation = 0.15f`. Vordergrund, der auf dem Hintergrund „fast" liegt, wirkt unsauber statt dezent. | Test |
| P12 | Akzentfarben werden nicht satt auf Flächen gelegt, sondern abgetönt. | Morphe: Deckkraft `0,35`/`0,55` im Dunkeln, `0,6`/`0,72` im Hellen – je nach Auswahlzustand. | Review |
| P13 | Dunkel und hell werden über Variablen gebaut, nie über `dark:`-Klassen. | `prio` ist heute bewusst nur dunkel (`src/index.css`). Variablen kosten jetzt fast nichts und machen den zweiten Modus später zu einer Datei statt zu einem Rewrite jeder Klasse. | Test |
| P14 | Farbe ist nie der einzige Träger einer Information. | Zustand braucht zusätzlich Form, Symbol oder Text – sonst ist er für rund jeden Zwölften nicht vorhanden. | Review |

## 3 Typografie

| # | Prinzip | Begründung | Durchsetzung |
| --- | --- | --- | --- |
| P15 | Ein Typografie-System wird nicht überschrieben, sondern nur dort angepinnt, wo es abweicht. | Morphes `theme/Type.kt` ist vier Zeilen lang: nur `bodyLarge` (16 sp / 24 sp, Sperrung 0,5 sp), alles andere kommt von Material. Selbst bauen heißt, jede Stufe einzeln falsch treffen zu können. | Review |
| P16 | Rollen statt Pixel: `label`, `body`, `title`, `heading`. | Bauteile sollen „Titel" sagen, nicht „20 px". Dann ist eine Skalenänderung eine Änderung an einer Stelle. | Test |
| P17 | Zeilenhöhe skaliert mit der Größe; Fließtext bekommt 1,4–1,6. | Morphe pinnt 24 sp bei 16 sp, also 1,5. | Review |
| P18 | Hierarchie entsteht aus Gewicht, Größe und Dämpfung – nicht aus Farbe allein. | Wer Hierarchie nur über Farbe macht, verliert sie im Monochrommodus und bei Farbsehschwäche. | Review |
| P19 | Zahlen, die sich ändern, stehen in fester Breite. | Zähler, Zeiten und Datum springen sonst beim Umschalten. `font-variant-numeric: tabular-nums`. | Review |
| P20 | Zeilenlänge wird begrenzt. | Zu breite Textspalten liest niemand gern; auf dem Tablet betrifft das `prio` direkt. | Review |
| P21 | Text skaliert mit den Systemeinstellungen. | `rem` statt `px`. Morphe behandelt das ausführlich (`theme/UiScale.kt`, 0,75–1,25 in 0,05-Schritten) – inklusive des Falls, dass die nichtlineare Schriftskalierung ab Android 14 erhalten bleiben muss. | Test |

## 4 Raum und Layout

| # | Prinzip | Begründung | Durchsetzung |
| --- | --- | --- | --- |
| P22 | Abstände kommen aus einem Raster, meist 4 oder 8 px. | Ein Raster ist der billigste Weg zu „das sieht aufgeräumt aus". | Test |
| P23 | Der Inhalt hat eine Maximalbreite. | Morphe: `ContentMaxWidth = 560.dp` – „so a bar under one lines up with its cards". Ohne Deckel zerfällt eine Liste auf einem breiten Bildschirm. | Review |
| P24 | Nähe gruppiert: Zusammengehöriges steht enger beieinander als Getrenntes. | Abstand ist die stärkste Gruppierung – stärker als jede Trennlinie, weil er nichts kostet. | Review |
| P25 | Im Zweifel mehr Luft. | Großzügigkeit wirkt hochwertig und ist die billigste Politur. Enge wirkt nach Fehler. | Review |
| P26 | Trefferflächen sind mindestens 24 × 24 CSS px, Ziel sind 44–48. | WCAG 2.2, 2.5.8 verlangt 24 × 24 (AA). Morphe setzt `MinTouchTarget = 48.dp` und `TallTouchTarget = 52.dp` für Zeilen, „that carry an action rather than merely allow one". | Test |
| P27 | Die Trefferfläche ist nicht die sichtbare Fläche. | Ein kleines Symbol darf ein großes Ziel haben; das ist Polsterung, kein Layout. | Review |

## 5 Form, Tiefe, Material

| # | Prinzip | Begründung | Durchsetzung |
| --- | --- | --- | --- |
| P28 | Rundungen sind eine Skala mit Hierarchie. | Morphe: `12` kompakt, `14` Einstellungen, `16` Karte, `18` Sektion, `50 %` Pille. Der Radius sagt, welche Ebene man vor sich hat. | Test |
| P29 | Tiefe entsteht aus Fläche und Kante, nicht aus Schatten. | Morphe zieht Rahmen und getönte Flächen dem Schatten vor (`CardBorder`, `CardElevation` fällt im Monochrommodus auf `0`). Schatten sind im dunklen Modus kaum sichtbar und teuer. | Review |
| P30 | Ein Rahmen hat eine Richtung und eine Lichtquelle. | Morphe zeichnet die Kante mit vier Stopps von oben-links hell nach unten-rechts dunkel – mit der Begründung, dass eine rein aufhellende Kante bei einer flachen Karte nur noch die Ecken leuchten lässt. | Review |
| P31 | Transluzenz ist ein Budget, kein Stilmittel. | Morphe: „Every translucent layer costs the GPU a full blend pass over the card, and a list of them scrolling is what pushed the frame past its budget." Deshalb ein Verlauf mit drei Stopps statt gestapelter Schichten. | Review |
| P32 | Die Richtung eines Verlaufs ist Teil der Aussage und folgt der Leserichtung. | Morphe: Verlauf von unten-links nach oben-rechts, sprachrichtungsabhängig über `startEdgeX(w, rtl)`. In CSS ist `to top right` physisch und muss unter `[dir=rtl]` gespiegelt werden. | Review |
| P33 | Trennlinien sind leiser als Rahmen. | Morphe tönt Trennlinien (`dividerColor`) und legt sie mit rund halber Deckkraft an; innere Zeilen einer Karte bekommen gar keinen Rahmen. | Review |

## 6 Zustände

| # | Prinzip | Begründung | Durchsetzung |
| --- | --- | --- | --- |
| P34 | Jeder Bildschirm hat vier Zustände: leer, lädt, Fehler, voll. Alle vier werden entworfen. | Der Ruhezustand mit Daten ist der einzige, den ein Screenshot zeigt – und der einzige, der selten schiefgeht. | Review |
| P35 | Skelette tragen die Geometrie des echten Inhalts. | Morphe baut die Platzhalterzeilen auf dieselben Höhen wie Titel und Statuszeile, „so the card does not jump". Ein Skelett anderer Größe verursacht genau das Springen, das es verhindern soll. | Review |
| P36 | Der Leerzustand sagt, was zu tun ist. | „Keine Aufgaben" ist eine Feststellung, „Tippe auf +, um die erste Aufgabe anzulegen" ist eine Einladung. | Review |
| P37 | Der Fehlerzustand sagt, was zu tun ist – nicht, was schiefging. | Technische Ursachen gehören ins Log, nicht in die Oberfläche. | Review |
| P38 | Deaktiviert ist eine Deckkraft, kein Grauton. | Morphe nutzt `0.38` – Materials Wert für „vorhanden, aber außer Reichweite". Ein handgewähltes Grau bricht den Kontrast zur Umgebung. | Test |
| P39 | Zerstörung fragt nach – oder ist rückgängig zu machen. | `prio` hat beides (`UndoProvider`, Soft Delete). Rückgängig ist die bessere Hälfte, weil es den Fluss nicht unterbricht. | Test |
| P40 | Während etwas läuft, ist der Auslöser gesperrt. | Verhindert den zweiten Lauf, der den ersten überschreibt – und ist ehrlicher als ein Knopf, der nichts tut. | Test |

## 7 Bewegung

| # | Prinzip | Begründung | Durchsetzung |
| --- | --- | --- | --- |
| P41 | Drei Dauern genügen: rund 220 ms Standard, 180 kurz, 320 für Ansichtswechsel. | Morphe: `ANIMATION_DURATION = 220`, `ANIMATION_DURATION_SHORT = 180`, `SCREEN_ENTER_DURATION = 320`. Mehr Vokabular heißt mehr Gelegenheit, danebenzugreifen. | Test |
| P42 | Der Eintritt dauert länger als der Austritt. | Morphe formuliert es als Prinzip: „Asymmetric duration (enter slightly longer than exit) gives a snappier feel." | Review |
| P43 | Federn für Dinge, die ihren Platz ändern; Tweens für Ein- und Ausblenden. | Morphe: `listSpring(stiffness = 400f, dampingRatio = 0.8f)` für Listenbewegung, `tween` für Deckkraft. Eine Feder auf einer Deckkraft wirkt unruhig, ein Tween auf einer Positionsänderung hölzern. | Review |
| P44 | Verzögerungen sind gedeckelt. | Morphe staffelt Chips um 40 ms, aber höchstens acht Schritte, „so a long run does not keep its last chips waiting". Ungedeckeltes Staffeln bestraft lange Listen. | Review |
| P45 | Bewegung bestätigt Ursache und Wirkung; sie dekoriert nicht. | Eine Animation, die nichts erklärt, kostet Zeit und Aufmerksamkeit. | Review |
| P46 | Reduktion ist eine Funktion, kein Medienmerkmal. | Morphe schaltet schwere Animationen ab, sobald TalkBack aktiv ist, und beobachtet das zur Laufzeit – weil schwere Übergänge den Screenreader auf schwachen Geräten ausbremsen. Auf dem Web: `prefers-reduced-motion`. | Test |

## 8 Rückmeldung und Interaktion

| # | Prinzip | Begründung | Durchsetzung |
| --- | --- | --- | --- |
| P47 | Ein Druck ist sichtbar, und überall gleich. | Morphe: `PressedScale = 0.97f` als geteilte Konstante, „so every button gives the same push-back". Ein Gefühl pro Knopf ist keins. | Test |
| P48 | Haptik ergänzt die Rückmeldung, sie ersetzt sie nicht. | Wer nur haptisch antwortet, ist für alle stumm, die die Haptik aus haben. Morphe feuert `VIRTUAL_KEY` beim Tippen und `LONG_PRESS` beim Halten. | Review |
| P49 | Jede Handlung hat einen Weg zurück. | `prio` hat dafür `BackLayerProvider` und den System-Zurück-Knopf; die Regel gilt aber auch für den Desktop (Escape). | Test |
| P50 | Verschiedene Aktionen müssen sich unterscheiden lassen. | Zwei Knöpfe, die gleich aussehen und Verschiedenes tun, sind ein Fehler, kein Stilmittel – „nichts verdoppeln, was nur zufällig gleich aussieht" aus `AGENTS.md`. | Review |
| P51 | Die Eingabeart bestimmt die Rückmeldung. | `hover:` auf dem Desktop, `active:` auf dem Telefon. Das ist bei `prio` ein ausdrücklich erlaubter Unterschied und darf nicht „vereinheitlicht" werden. | Review |

## 9 Barrierefreiheit

| # | Prinzip | Begründung | Durchsetzung |
| --- | --- | --- | --- |
| P52 | Der Fokus ist sichtbar und sieht überall gleich aus. | `prio` hat dafür `focusRing` in `styles.ts`. Ein Fokusring, den man nur beim Suchen findet, ist keiner. | Test |
| P53 | Jedes Bedienelement hat einen Namen für Vorleseprogramme. | Morphe begründet das an einer langen Aktion ausdrücklich: „rather than left as an unlabeled action the screen reader cannot describe". | Review |
| P54 | Die Tastatur erreicht alles, in der Reihenfolge der Leserichtung. | Gilt für `prio` besonders in der breiten Ansicht, wo Menüs und Seitenleiste im Spiel sind. | Test |
| P55 | Die Sprache kommt vom Dokument, nicht vom Layout. | `lang` und logische Richtung (`dir`) steuern Silbentrennung, Vorlesen und Verlaufsrichtung. Morphe macht die Richtung im Code explizit. | Review |
| P56 | Die Systemeinstellungen werden respektiert: Schriftgröße und Bewegungsreduktion. | Siehe P21 und P46. | Test |

## 10 Text in der Oberfläche

| # | Prinzip | Begründung | Durchsetzung |
| --- | --- | --- | --- |
| P57 | Eine Information, eine Formulierung, eine Quelle. | Steht so in `AGENTS.md`; `prio` löst es mit gemeinsamen Formatierungsfunktionen (`formatDueLabel` in `src/ui/datetime.ts`). | Test |
| P58 | Knöpfe benennen die Handlung. | „Liste löschen" statt „OK". Der Nutzer soll den Knopf nicht lesen müssen, um zu wissen, was er tut. | Review |
| P59 | Ein Platzhalter ist kein Label. | Er verschwindet, sobald getippt wird – genau dann, wenn die Information gebraucht wird. | Review |
| P60 | Fehlermeldungen sind sachlich und enden mit einem Schritt. | Wer schimpft, wird nicht gelesen. | Review |
| P61 | Text wird nicht abgeschnitten, ohne dass der volle Text erreichbar ist. | Morphe kürzt lange App-Namen mit Auslassung und legt den vollen Namen in den Dialog. | Review |

## 11 Zwei Ansichten (prio-spezifisch)

| # | Prinzip | Begründung | Durchsetzung |
| --- | --- | --- | --- |
| P62 | Eine Sprache, zwei Bedienmodelle. | Gleiche Information wird gleich dargestellt und gleich formatiert, unabhängig von der Ansicht – verbindlich in `AGENTS.md`. | Test |
| P63 | Die Dichte darf abweichen, das Aussehen nicht. | Karten auf dem Desktop, flache Zeilen auf dem Telefon: erlaubt und sinnvoll. Zwei Grüntöne für denselben Zustand: nicht. | Test |
| P64 | Jede Funktion ist auf beiden Oberflächen erreichbar. | Eine Aktion nur auf einem Bildschirm ist ein Fehler, kein Zwischenstand. Durchgesetzt von `tests/e2e/parity.spec.ts`, wo ein einseitiger Eintrag gar nicht anlegbar ist. | Test |
| P65 | Vor jeder Oberflächenänderung: Wo ist die andere Stelle? | Die Frage ist billiger als die Nacharbeit. Bei „nirgends" ist die Arbeit nicht fertig. | Disziplin |

## 12 Wie man das prüft

Prüfmittel, die zu `prio` passen und die vorhandenen Werkzeuge benutzen:

1. **Screenshot in Telefongröße und selbst ansehen.** Steht schon in `AGENTS.md`
   und hat laut dessen eigener Notiz einen Fehler gefunden, den keine Zusicherung
   erwischt hätte (`npm run android:emu:shot`, Ziel `test-results/`).
2. **Eine Küchenseite** im Entwicklungsbuild, auf der jedes Bauteil in jedem
   Zustand nebeneinander steht. Unterschiede, die man in einer echten Liste
   nicht sieht, sieht man hier sofort. Kostet eine Route und spart einen
   Überhaul.
3. **Belastungsprobe:** sehr langer Text, 200 % Schriftgröße, keine Daten,
   langsames Netz, Querformat. Kein Screenshot zeigt diese Zustände – und genau
   dort brechen Oberflächen.
4. **Kontrastrechner** für jedes Farbpaar mit Bedeutung. Rechenbar, also prüfbar
   (P9, P10).
5. **Vorlesen lassen** und einmal nur mit der Tastatur bedienen.

## 13 Offene Entscheidungen

Diese Fragen beantwortet dieses Dokument **nicht**. Sie gehören in den Auftrag
für den Überhaul, nicht in die Vorbereitung:

| Frage | Warum sie vorher zu klären ist |
| --- | --- |
| Woher kommt die Farbe einer Liste? | Morphes Karten leben von App-Markenfarben. Ob `prio`-Listen eine Farbe bekommen, aus dem Symbol abgeleitet oder vom Nutzer gewählt, ist eine Produktentscheidung – die Technik (P8) folgt danach. |
| Nur dunkel, oder auch hell? | `prio` ist heute bewusst dunkel. P13 macht den zweiten Modus später billig, aber die Entscheidung fällt jetzt. |
| Wie viel Bewegung? | P41–P46 beschreiben ein Vokabular. Ob `prio` es überhaupt einsetzt, ist eine eigene Entscheidung. |
| Eigene Bauteile oder ein fertiges System? | shadcn/ui und `matraic/m3e` (beide MIT) bringen Bauteile und Verhalten mit – und eine eigene Token-Sprache, die gegen P1/P4 arbeitet. Entweder übernehmen und umbiegen, oder selbst bauen. |
| Systemschrift oder eigene Schrift? | Morphe bleibt bei `FontFamily.Default` (P15). Eine eigene Schrift ist ein Bekenntnis mit Ladezeit. |
| Was passiert mit den rohen Farbklassen im Bestand? | Rund 170 Stellen (`text-neutral-500` allein 41) stehen derzeit neben `styles.ts`. Sie sind die Arbeitsliste des Überhauls, kein Notstand. |

## 14 Verhältnis zu `AGENTS.md`

`AGENTS.md` enthält **verbindliche** Regeln, dieses Dokument einen **Vorrat**.
Ein Prinzip wandert nach `AGENTS.md`, wenn es gelten soll – und bekommt dabei
die Angabe, wodurch es durchgesetzt wird. Ein Prinzip, das nur in `DESIGN.md`
steht, ist ein Vorschlag.

Umgekehrt gilt: Was hier als **Test** ausgewiesen ist, ist bereits oder
problemlos prüfbar. Genau die Prinzipien sind die reifen, unabhängig davon, ob
sie schön klingen.

## Quellen

* [MorpheApp/morphe-manager][morphe] (GPL-3.0) – Grundlage für P1–P5, P8–P12,
  P15, P17, P21, P23, P26, P28–P33, P35, P38, P41–P48, P52, P55, P61.
  Gelesen wurden `ui/theme/{Theme,ThemeTraits,Type}.kt`,
  `ui/screen/shared/{SettingComponents,Animations,PressFeedback,GlassButtonDefaults,
  CardBackground,CardBorder,Accessibility}.kt`, `util/ColorUtils.kt`,
  `util/AppCardColorDefaults.kt` und `ui/screen/home/HomeAppCards.kt`.
* [WCAG 2.2](https://www.w3.org/TR/WCAG22/) – P9 (1.4.3, 1.4.11), P14, P26
  (2.5.8), P53, P54.
* Material 3 – P38 (Deckkraft 0,38 für Deaktiviertes), P28 (Radienhierarchie).
* Apple Human Interface Guidelines – P45 (Bewegung erklärt, sie dekoriert nicht).
* Eigene Schlüsse für `prio`: P6, P7, P13, P16, P19, P22, P34, P36, P39, P40,
  P49–P51, P57–P60, P62–P65.

[morphe]: https://github.com/MorpheApp/morphe-manager
