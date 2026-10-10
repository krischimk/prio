# Design für Prio

Stand: 10. Oktober 2026. Dies ist die Arbeitsgrundlage für den begonnenen
UI-Umbau. Sie trennt überprüfbares Verhalten von veränderbaren Stilwerten.
Der Lieferumfang und die noch offenen Produktentscheidungen stehen in
[UI-OVERHAUL-PLAN.md](UI-OVERHAUL-PLAN.md). Arbeits-, Daten- und Release-Regeln
stehen in [AGENTS.md](AGENTS.md).

## Verhaltensregeln

| Regel | Zweck | Nachweis |
| --- | --- | --- |
| **D1 Identität und Herkunft**: Eine Aufgabe wird über ihre ID geöffnet. Ihre Liste bleibt im Editor sichtbar. | Gleiche Titel und mehrere Ansichten dürfen keine andere Aufgabe ändern. | Gesamt-/Listenansicht öffnen dieselbe ID; externe Änderungen treffen den richtigen Editor (`overview`, `foundation`, `taskQuery`). |
| **D2 Entwürfe**: Eingaben gehören ihrer Liste bzw. Aufgabe. Schließen bietet Behalten, Verwerfen und Weiterbearbeiten. Ansichtswechsel behält das offene Formular. | Verhindert verlorene Eingaben und falsche Ziele. | Listenwechsel, Breitenwechsel, externe Änderung, Schließen und Abmelden (`foundation`, `overhaul`, `taskForm`). |
| **D3 Aufgaben zuerst**: Im Normalzustand stehen Titel, vorhandene Metadaten und Abhaken im Vordergrund. Zusatzaktionen liegen im Editor, Listenverwaltung in den Einstellungen. | Reduziert wiederholte Verwaltungsflächen und hält schnelle Erfassung leicht. | Eine Standardaufgabe braucht nur einen Titel; leere Zusatzdaten erzeugen keine Platzhalter in der Aufgabenzeile. Screenshots mit kurzen/langen Titeln und mit/ohne Metadaten. |
| **D4 Informationsrollen**: Auswahl, Fehler, Alter, Aufwand und Priorität erhalten unterscheidbare Rollen. | Eine Farbe oder Größe soll im selben Kontext keine widersprüchlichen Aussagen tragen. | Statusfarben kommen aus einer gemeinsamen Zuordnung. Altersfarben, Aufwand-Größen und Prioritätshervorhebung werden erst mit Ranking/Matrix an Beispielen festgelegt. |
| **D5 Gemeinsame Bedeutung**: Telefon und breite Ansicht verwenden dieselben Fachoperationen, Texte, Aufgabenfakten und Formularinhalte. | Konsistenz ohne starres identisches Layout. | Paritätsabläufe einschließlich Besitzer-/Mitgliedsrollen, zusätzlich eigenständige Kernabläufe. Editor und Listenverwaltung sind gemeinsame Komponenten. |
| **D6 Mehrere Bedienweisen**: Jede Kernaktion hat einen Tastaturweg und einen Weg mit einem einzelnen Zeiger ohne verpflichtendes Ziehen. | Langdruck und Drag dürfen keine Voraussetzung sein. | Aufgabenreihenfolge über „Reihenfolge ändern“; Bereiche über ihre vorhandenen Sortierknöpfe. Drag bleibt ein zusätzlicher Weg. Spätere Slider brauchen Track-Tap, Pfeiltasten und Zahleneingabe. |
| **D7 Dialog und Orientierung**: Der oberste Dialog hält den Fokus; der Hintergrund ist inaktiv. Zurück/Escape betrifft die oberste Ebene. Schließen gibt den Fokus zum Auslöser oder seinem Gegenpart zurück. | Verhindert versehentliche Hintergrundaktionen und verlorene Orientierung. | `sheet`, `overhaul`, `cloud`; Breitenwechsel und verschachtelter Dialog. Ein verschwundener Auslöser braucht einen sinnvollen verbleibenden Fokus. |
| **D8 Lesbarkeit und Ziele**: Normaler Text erreicht 4,5:1, identifikationsrelevante Markierungen 3:1. Häufige Touch-Aktionen haben mindestens 44 × 44 CSS-Pixel Trefferfläche. | Größe einer Trefferfläche ist unabhängig vom visuellen Gewicht einer Aktion. | Farbpaare werden gerechnet; tatsächliche Ziele, 200 % Schrift sowie Telefon-Hoch-/Querformat werden gerendert. Kompakte Hilfsaktionen dürfen 32 Pixel hoch sein; sie ersetzen keine Touch-Hauptaktion. |
| **D9 Zuverlässige Rückmeldung**: Speichern reagiert auf den lokal erreichten Zustand; Sync meldet die Cloudübertragung gesondert. Fehler erklären Ursache und nächste wirksame Handlung. | Ein deaktivierter Knopf allein beweist weder Persistierung noch Konfliktschutz. | Offline, Schreibfehler, konkurrierende Änderung, Wiederholung und Serverablehnung. Entwurf bleibt bei Fehlern erhalten. Upload-Bestätigung ist eine interne Bestätigung, kein zusätzlicher Benutzerdialog. |
| **D10 Kleine gemeinsame Bausteine**: Wiederkehrende Bedeutung und Verhalten werden gemeinsam geändert. Nicht mehr verwendete Varianten werden entfernt. | Vermeidet lokales Auseinanderlaufen und ein Designframework ohne Verbraucher. | Kitchen für Bausteine, Quelltextkonventionen und konkrete Browserabläufe. Normale Layoutwerte bleiben bei der bestehenden Skala. |

Die Kontrastschwellen beziehen sich auf [WCAG 2.2: Kontrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html).
Dialogverhalten folgt dem [WAI-Dialogmuster](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/),
der alternative Bedienweg dem [Kriterium zu Ziehbewegungen](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html).
44 Pixel sind das Prio-Ziel für häufige Touch-Aktionen. Diese Regeln und einzelne
Tests behaupten keine vollständige WCAG-Konformität der Anwendung.

## Erste visuelle Fassung

Der Hintergrund ist auf ausdrücklichen Nutzerwunsch vollständig schwarz
(`#000000`). Formularflächen und angehobene Zustände sind neutral und klar
getrennt; Violett bezeichnet Auswahl und
Hauptaktion. Rote Flächen gehören zu Fehlern bzw. destruktiven Aktionen.
Der sichtbare Produktname wird „Prio“ geschrieben.
Farbwerte, Schriftgrößen und Rundungen stehen in `src/index.css`, die Auswahl
von Knopfvarianten in `src/ui/styles.ts`. Sie dürfen nach Nutzerprüfung geändert
werden, solange die Verhaltensregeln und Kontrastprüfungen weiter erfüllt sind.

Aufgaben erscheinen als ruhige Zeilen mit einer großen Abhakfläche. Vorhandene
Metadaten stehen kompakt unter dem Titel, Beschreibungen lassen sich aufklappen.
Die Gesamtansicht zeigt Herkunft und Aufgabenanzahl je Liste. Der Editor öffnet
breit als mittiger Dialog und auf dem Telefon als ganze Fläche; Speichern und
Schließen bleiben auch bei langem Inhalt erreichbar. Die Listeneinstellungen
trennen die persönliche Auswahl von der gemeinsamen Aufbewahrungsregel.

Der bisherige Karten-Zwischenraum `zeile` entfällt: Die Aufgaben sind jetzt
zusammenhängende Zeilen mit Trennern. Ein ungenutzter Token wird nicht allein
für seine Existenzprüfung behalten. Inhaltsbreiten und Rundungen sind
Arbeitswerte dieser Fassung, keine unumkehrbaren Produktentscheidungen.

## Abnahme und Grenzen

- `npm run ci`: Typen, Konventionen, Geschäftslogik, Farbpaare und Build.
- Browser: neue Kernabläufe in `overhaul.spec.ts`, vorhandene Abläufe in den
  jeweiligen E2E-Dateien; Parität ersetzt keine Rollen-/Fehlerprüfung.
- Visuell: dieselben Beispieldaten breit sowie im Telefon-Hoch-/Querformat;
  lange Titel, leere Daten, Metadaten, Entwürfe, Fehler und vergrößerte Schrift.
- Vor Android-Auslieferung: tatsächlicher App-Code im Emulator; reale Tastatur,
  Systemleisten und Gerätebesonderheiten bei Bedarf am Telefon.

Neue Prioritätsregeln, Checklisten und optionale Hierarchie werden im jeweiligen
Lieferumfang fachlich geklärt. Der aktuelle Umbau legt diese Entscheidungen
nicht durch einen Platzhalter oder einen Default fest. Ein Hellmodus bleibt
möglich, ist aber kein Teil dieser ersten Fassung.

## 15 Historische Befunde

Dieser Anhang erhält die Befundnummern, auf die `AGENTS.md` verweist. Zahlen,
Dateipfade und Stand-Vermerke beschreiben die damalige Prüfung vom 7. Oktober
2026. Sie sind **keine aktuelle offene Arbeitsliste** und keine Freigabe des
jetzigen Codes. Die alten 65 Prinzipien gelten nicht zusätzlich zu den Regeln
oben. Der neue Befundstand und die Abnahme stehen im Overhaul-Plan.

### 15.1 Schon heute falsch – keine Geschmacksfrage

| # | Befund | Ort | Beleg | Aufwand | Stand |
| --- | --- | --- | --- | --- | --- |
| F1 | „Aufgabe verschieben" gibt es nur auf dem Telefon | `src/ui/mobile/MoveTaskSheet.tsx:36` | `moveTask` hat genau **eine** Aufrufstelle, und `parity.spec.ts` hat keinen Eintrag dafür | S | erledigt |
| F2 | Escape schließt die breiten Dialoge nicht, obwohl der Kommentar es behauptet | `src/ui/RestoreTasksPanel.tsx:50` | nur `MobileDrawer.tsx:53` hatte einen `keydown`-Zuhörer; `useBackLayer` kannte keinen Tastaturweg | S | erledigt |
| F3 | Angehängte Klassen an Knöpfen bewirken nichts, der „kompakte" Knopf existiert nicht | `src/ui/TaskPanel.tsx:94` u. a. | im gebauten CSS steht `.px-3` **hinter** `.px-2`, `.py-2` hinter `.py-1` – 22 Stellen wirkungslos | S | erledigt |
| F4 | `db:check` nennt falsche Migrationsdateien | `scripts/db-apply.mjs:115` | `tasks.position` → 0009 (richtig 0005), `lists.icon` → 0007 (richtig 0008) | S | erledigt |
| F5 | Toter Code | `src/domain/merge.ts:28`, `src/app/WorkspaceProvider.tsx:69` | `needsPush` wird nur von Tests gelesen, `lastSyncedAt` hat keinen Verbraucher | S | erledigt |
| F6 | Der Paritätstest prüft nur, was jemand eingetragen hat | `tests/e2e/parity.spec.ts:39` | eine handgepflegte Tabelle; F1 ist genau deshalb unbemerkt geblieben | M | erledigt: `tests/unit/parityCoverage.test.ts` geht von den **schreibenden Operationen** aus – je Operation ein Eintrag (Vollständigkeit erzwingt der Typ `Record<…>`), jeder genannte Eintrag muss in der Paritätstabelle vorkommen. `null` nur mit Begründung |

### 15.2 Fundament – Voraussetzung für jeden Umbau

| # | Befund | Ort | Maß | Aufwand | Stand |
| --- | --- | --- | --- | --- | --- |
| A1 | Keine Bausteine, nur Klassenketten | `src/ui/styles.ts:6` | 82 `<button>`, 228 Verwendungen der Knopf-Konstante, drei konkurrierende „kleiner Knopf"-Rezepte | M | erledigt: `Button`/`IconButton` in `src/ui/components/`; `buttonClass` nur noch dort, Größe/Art als Eigenschaft, Layout über `layout` (63 + 9 Aufrufe umgestellt, 6 Tests). Die übrigen `<button>` sind eigenständige Flächen (Zeilen, Kacheln, Plus-Knopf) |
| A2 | Keine Farb-, Raum- und Typo-Tokens | `src/index.css`, `src/ui/styles.ts` | **234** rohe Farbklassen in **26** Dateien; 7 Schriftgrößen (5 in `px`), 8 Polster-, 6 Radius-, 9 Abstandswerte | L | entschieden: Farben, Schrift und Radius sind Rollen in `@theme` (321 Stellen umgestellt); für den Raum gibt es jetzt vier **benannte** Abstände (`--spacing-karte`, `-zeile`, `-abschnitt`, `-rand`) an den vier Stellen, deren Bedeutung festliegt. **Keine zweite Skala** – und die frühere Begründung dafür war falsch: Tailwinds Skala *ist* ein globaler Drehknopf (`.p-4{padding:calc(var(--spacing) * 4)}`), sie steuert aber auch `.h-14` und `.w-4` und ändert damit alles gleichzeitig; `px-4` steht an 29 Stellen für mindestens drei Zwecke, `px-4 py-3` sechsmal als unbenannte Zeile. Es fehlte keine Skala, sondern Benennung. **Bewusst nicht:** Ersatz der Tailwind-Schritte oder Umbau aller Polsterstellen |
| A3 | Kartenfläche siebenfach statt einmal | `src/ui/styles.ts:56` (`card` – **unbenutzt**) | 7 Ausprägungen in 5 Dateien, zwei Deckkräfte, drei Polsterungen | S | erledigt: `card`, `cardSoft`, `emptyState` – der tote Token ist benutzt |
| A4 | Dialoge sind fünfmal von Hand gebaut | `RestoreTasksPanel`, `ListSettingsSheet`, `MoveTaskSheet`, `TaskDetailSheet`, `MobileDrawer` | 4 Rahmen, 4 Schleier, 9 unbenannte Z-Ebenen, 1 von 4 mit Escape, keine Fokusführung | M | erledigt: Verhalten einmal in `useDialog` (Rolle, Name, Escape, Zurück-Taste, Fokus); `Sheet` für die drei Blätter, `Screen` für die Detailansicht, das Menü nutzt dieselbe Mechanik mit eigenem Rahmen. Ebenen als `layer.*`, 9 Dialogtests |
| A5 | Gerätegeometrie als verstreute Zahlen | `MobileAppBar.tsx:36`, `index.css:139`, `MobileWorkspace.tsx:57`, `UndoProvider.tsx:58` | vier voneinander abhängige Werte (`h-14`, `3.5rem`, `pb-28`, `mb-24`) ohne Beziehung im Code | S | erledigt: `--spacing-app-bar`, `--spacing-fab`, `--spacing-fab-gap` und die Klassen `.app-bar-offset`, `.fab-offset`, `.fab-clearance` |
| A6 | Kein Ort, an dem man ein Bauteil in allen Zuständen sieht | – | `DESIGN.md` §12 nennt die „Küchenseite" als Prüfmittel; sie fehlt | S | erledigt: `src/ui/dev/Kitchen.tsx` unter `?kueche=1` (nur Entwicklungslauf, hinter `import.meta.env.DEV`), mit `tests/e2e/kitchen.spec.ts`. Dazu das fehlende Bauteil `Field` |

### 15.3 Zwei Ansichten

| # | Befund | Ort | Maß | Aufwand | Stand |
| --- | --- | --- | --- | --- | --- |
| Z1 | Aufgabenzeile und Aufgabenformular sind zweimal gebaut | `TaskItem.tsx:71-155` und `mobile/TaskDetailSheet.tsx:176-254`, `TaskComposer.tsx` | Zeileninhalt wörtlich doppelt, **drei** Formulare; Anlegen kann mobil mehr als breit | M–L | erledigt: `useTaskForm` (Zustand, Umwandlungen, Prüfung, Sperre), `TaskFields` (die Felder, in allen drei Formularen), `TaskFacts` (Zeileninhalt beider Ansichten) |
| Z2 | Zwei Modusschalter mit verschiedenen Schwellen | `src/app/useIsDesktop.ts:18` gegen `md:` | JS entscheidet bei 1024 px, `md:` bei 768 px; 9 `md:`-Stellen in 7 Dateien | S | erledigt: **eine** Schwelle (`useIsDesktop`) – auch für die Form des Blattes; die immer wahren `md:`-Reste in den Desktop-Dateien und die CSS-Medienabfrage der Rückgängig-Leiste sind weg. Inhaltsraster (Symbolauswahl, Küchenseite) richten sich weiter nach der Breite: das ist Layout, nicht die Ansicht |
| Z3 | Ansichtszustand liegt in beiden Bäumen | `WorkspaceScreen.tsx:32-33`, `mobile/MobileWorkspace.tsx:34-37` | `useSelectedListId` und `restoreOpen` je zweimal → Auswahlverlust beim Breitewechsel | M | erledigt: `ViewProvider` über der Verzweigung; `useSelectedListId` ist darin aufgegangen. `tests/e2e/lists.spec.ts` prüft, dass die gewählte Liste den Breitenwechsel überlebt – mit simuliertem Altverhalten ist der Test rot |
| Z4 | Navigation ist kein Modell | 10 `useBackLayer`-Aufrufe in 7 Dateien | „was ist offen" nur als Boolean je Komponente | M | entschieden: Ebenen sind **benannt** (`backLayer(…, 'aufgabe-bearbeiten')`, `backStack.top()/names()`), die Reihenfolge liegt zentral, 3 neue Tests. **Bewusst nicht:** ein Router, der an die Namen Adressen aufhängt, wäre eine neue Funktion (teilbare Links), kein Aufräumen – die Namen und die zentrale Reihenfolge sind die Voraussetzung dafür und stehen |

### 15.4 Zustands- und Anwendungsschicht

| # | Befund | Ort | Maß | Aufwand | Stand |
| --- | --- | --- | --- | --- | --- |
| B1 | `WorkspaceProvider` ist DB, Sync, Erinnerungen, Cloud-Aufruf, Timer und Darstellung | `src/app/WorkspaceProvider.tsx` | 295 Zeilen, 8 Zustandszellen, 10 Kontextfelder, `ui/styles`-Import, JSX | M | erledigt: `createWorkspaceRuntime` (React-frei: Datenbank, Abgleich, Erinnerungen, Entprellung, Zeitgeber, Momentaufnahme) und ein dünner `WorkspaceProvider`, der sie abonniert (`useSyncExternalStore`). Ladeansicht nach `src/ui/WorkspaceLoading.tsx`. Neuer Integrationstest der Laufzeit (4 Fälle) |
| B2 | Anzeigetexte und Ton-Vokabular in den Fachschichten | `syncStatus`, `reminderStatus`, `updateStatus`, `authPort`, `OFFLINE_MESSAGE` | 26 Textstellen außerhalb `src/ui`; Fehler teils am Wortlaut erkannt statt an einem `code` | M | erledigt: Die drei Statusmodule liegen in `src/ui/status/`, die Sync-Engine liefert nur `kind`, und `ValidationError` trägt eine **Kennung** (`not-found`, `empty`, `email`, `limit`) statt nur einen deutschen Satz – die frühere Wortlaut-Erkennung ist weg |
| B3 | `trackedRepositories` klassifiziert 27 Methoden von Hand, ungeprüft | `src/app/trackedRepositories.ts:48-79` | ein falscher Eimer heißt: kein Sync (still) oder Dauer-Sync; 0 Tests | S | erledigt: Einordnung als Tabelle (`SCHREIBEND`/`NUR_LOKAL`/`LESEND`), der Wrapper entsteht daraus; `tests/unit/trackedRepositories.test.ts` prüft Deckung, Disjunktheit und Verhalten – fehlt eine Methode in den Listen, ist der Test rot |
| B4 | Lese-Hooks invalidieren grob und lesen für geschlossene Panels | `src/app/hooks.ts`, `RestoreTasksPanel.tsx:23` | Zähler ohne Bezug; je Änderung u. a. ein Scan der ganzen `tasks`-Tabelle für ein unsichtbares Panel | M | entschieden: Das geschlossene Fenster liest nicht mehr (`useRestorableTasks(aktiv)`), `completed_at` ist indiziert (Dexie Version 6, im Upgrade-Test geprüft), die Abfrage geht über den Index statt über `toArray()`. **Bewusst nicht:** eine feinere Invalidierung – der eine Zähler ist der Preis dafür, dass es genau eine Wahrheit gibt (die lokale Datenbank) und keinen zweiten Zustandsspeicher daneben; die teure Stelle (Scan der ganzen `tasks`-Tabelle) ist weg, geblieben ist ein indiziertes Neulesen je Verbraucher |
| B5 | `BackendLabel` liest `import.meta.env` selbst | `src/ui/BackendLabel.tsx:17` gegen `src/app/services.ts:16` | widerspricht der dokumentierten Zusage; in Tests mit Attrappe zeigt es das echte Projekt | S | erledigt: `AppServices.backendUrl` und `BackendContext`; `BackendLabel` liest den Kontext. In Tests gegen Attrappen zeigt die Anzeige jetzt nichts statt des echten Projekts |
| B6 | Lint-Regel global abgeschaltet statt dateiweise | `.oxlintrc.json:7` | begründet mit zwei Dateien, gilt für alle | S | erledigt: Regel wieder an, `overrides` für genau drei Dateien (Workspace-, Auth- und Update-Provider), README-Punkt 10 nachgezogen. Der Weg dahin fand gleich die vierte Datei |
| B7 | `UndoProvider` kopiert Domänendaten, verschluckt Fehler, kennt fremdes Layout | `src/ui/UndoProvider.tsx:19,73,58` | Titelkopie, unbehandelte Ablehnung, `mb-24` als Wissen über den Plus-Knopf | S | erledigt: Die Leiste merkt sich nur die Kennung und liest den Titel nach (`useTask`); ein Fehlschlag bleibt sichtbar (`role="alert"`); die Platzierung folgt `useIsDesktop` |

### 15.5 Daten- und Sync-Schicht

| # | Befund | Ort | Maß | Aufwand | Stand |
| --- | --- | --- | --- | --- | --- |
| C1 | Ein abgelehnter Datensatz blockiert die ganze Warteschlange | `src/sync/syncEngine.ts:96-104`, `src/sync/supabaseGateway.ts:55-70` | ein `try` um drei Upserts; `markPushed` läuft dann nie, alles bleibt `dirty` und wird alle 30 s wiederholt | M | erledigt: `push` liefert ein Ergebnis **je Tabelle**; markiert wird nur, was angekommen ist. Dauerhaft abgelehnte Zeilen wandern nach `ABGELEHNT_AB_VERSUCHEN` Anläufen in ein Ablagefach (`meta`, Kennung ist `updated_at` – eine neue lokale Änderung wird wieder versucht), zählen nicht mehr als „warten“ und werden in der Anzeige mit Fehlerton benannt. Nebenbei: die Testattrappe schreibt erst nach vollständiger Prüfung – wie PostgREST |
| C2 | Feldkatalog an 6+ Orten, schon auseinandergelaufen | `scripts/db-apply.mjs`, `domain/mapping.ts`, `db/localDb.ts`, `domain/types.ts`, Migrationen | die Prüfliste deckt 5 von 29 gesendeten Spalten ab; F4 war die Folge | M | erledigt: `src/domain/fields.ts` nennt die Felder je Entität als Daten; zur **Übersetzungszeit** prüft `FelderGenau`, dass die Liste den Typ genau abdeckt. `tests/unit/fieldCatalogue.test.ts` hält fest, dass die Server-Umwandlung genau diese Felder benutzt, jedes Feld in einer Migration vorkommt und `db-apply.mjs` nichts Unbekanntes erwartet (nachgemessen: fehlt ein Feld in der Umwandlung, ist der Test rot) |
| C3 | `repositories.ts` macht sechs Dinge in 713 Zeilen | `src/db/repositories.ts` | Entitäten und lokale Eingabehilfen in einer Fabrik; 11 handgeschriebene `dirty: 1` neben 17 `stamp()` | M | erledigt: `src/db/repositories/` – ein Bereich je Datei (`listen` 118, `aufgaben` 277, `mitglieder` 64, `einstellungen` 77 Zeilen), gemeinsame Helfer in `context.ts`, Schnittstelle in `types.ts`, Zusammensetzung in `index.ts` (29 Zeilen). Die Schnittstelle nach außen (`createRepositories`, `Repositories`) bleibt gleich, alle 423 Tests unverändert grün |
| C4 | Drei Mechanismen für „Feld fehlt in alten Zeilen" | `repositories.ts:222`, `domain/sections.ts:111`, `mapping.ts:85-94`, `db/localDb.ts:65-84` | 9 Lesestellen, drei Antworten; `merge.ts` schaltet mit `as unknown as` die Typprüfung an der Grenze ab | M | erledigt: `src/domain/normalize.ts` – **ein** Leserand je Entität, angewandt an beiden Rändern (`mapping.fromRemote*` und jeder Lesevorgang in `repositories`). Die doppelte Vorsicht beim Zugriff auf `task.reminders` ist weg. 5 neue Tests mit Zeilen, wie eine alte Fassung sie hinterlässt |
| C5 | Anzeigepolitik in der Datenschicht | `repositories.ts:186-196` (`compareTasks`), `:379-385`, `RESTORE_WINDOW_DAYS` | eine andere Sortierung oder Gruppierung muss heute die Datenschicht ändern | S | erledigt: `src/domain/ordering.ts` (Aufgaben-, Wiederherstellungs-, Listen- und Mitglieder-Reihenfolge) und `RESTORE_WINDOW_DAYS`/`restoreCutoff`; `repositories` und die Oberfläche benutzen dieselben Funktionen. 9 neue Tests |
| C6 | `syncStore` ist der app-weite Schlüssel-Wert-Speicher | `src/sync/syncStore.ts` | `db` und `reminders` hängen damit an `sync` – die Schichtrichtung steht verkehrt | S | erledigt: `src/db/metaStore.ts` als neutrale Ablage; die Schlüssel gehören ihren Besitzern (`repositories`, `reminderService`, `syncStore`). Vorher hing `db` und `reminders` an `sync` |
| C7 | `RemoteGateway` vermischt Transport und Fach-Aufrufe | `src/sync/remoteGateway.ts:29-50` | 4 Implementierungen müssen `pull/push` **und** `shareListByEmail`/`coMemberContacts` nachbauen | S | erledigt: `SyncTransport` (pull/push) und `ShareDirectory` (teilen, Kontakte) getrennt; die Sync-Engine verlangt nur den Transport, der Teilen-Ablauf nur das Verzeichnis. `RemoteGateway` bleibt die Summe für die Zusammensetzung |

### 15.6 Prüfungen, die mitziehen müssen

| # | Befund | Ort | Maß | Aufwand | Stand |
| --- | --- | --- | --- | --- | --- |
| P1 | Der Architekturtest liest nur `src/ui` | `tests/unit/uiConventions.test.ts:30` | `src/App.tsx` (11 rohe Farbklassen) und `WorkspaceProvider` werden nie geprüft | S | erledigt: der Test liest ganz `src` (fand dabei „offene Aufgabe“ in einem Kommentar – Regel auf Zeichenketten eingegrenzt) |
| P2 | Nichts prüft Rollen, Token, angehängte Klassen oder den toten `card` | dito | die Regeln aus 15.2 sind heute reine Disziplin | S | erledigt: 10 Regeln im Test (Palette, Schriftgrößen, Anhängsel, Bausteine, `layout`) plus `tests/unit/components.test.tsx` |
| P3 | Kein Test für die Klassifikation in `trackedRepositories` | `tests/` | 27 Zuordnungen, 3 Kategorien, 0 Prüfungen (B3) | S | erledigt: `tests/unit/trackedRepositories.test.ts` (Deckung, Disjunktheit, Verhalten; nachgemessen rot, wenn eine Methode fehlt) – siehe B3 |

Alle 40 Punkte aus der Bestandsprüfung tragen `erledigt` oder `entschieden` – dort
ist keiner offen. Die Prinzipienprüfung (§15.7) hat daraus **18 weitere
offene Befunde** ergeben; sie stehen als D1–D8 und sind der nächste Arbeitsvorrat.

### 15.7 Aus der Prinzipienprüfung

Die Prinzipien aus §1–14 wurden am 07.10.2026 gegen den heutigen Code geprüft –
jedes einzelne, mit nachgemessenen Zahlen (Spalte **Stand** in den Tabellen
oben). Ergebnis: 39 von 65 galten sofort, 8 entfallen (die App animiert kaum,
hat keine Nutzerfarben und keine Verläufe), 18 galten nicht. Die 18 stehen
hier als Befunde – **alle acht sind inzwischen erledigt oder bewusst
entschieden** (D1–D8), dazu trägt die Statusanzeige in der App-Leiste
ihre Aussage jetzt auch in Form und Zahl statt nur in Farbe (P14).

| # | Befund | Ort | Beleg | Aufwand | Stand |
| --- | --- | --- | --- | --- | --- |
| D1 | Leerzustände laden nicht ein – und stehen doppelt | `src/ui/emptyTexts.ts` | **erledigt:** eine Quelle für beide Ansichten (`leerAufgaben`, `leerListen`, `LEER_BEREICHE`, `LEER_MITGLIEDER`), jede endet mit dem nächsten Schritt; `tests/unit/emptyTexts.test.ts` prüft Einladung und gemeinsamen Satz | S | erledigt |
| D2 | Zahlen mit wechselnder Breite | `src/ui/styles.ts` (`numeric`) | **erledigt:** `numeric` als Konstante, angewandt an sechs Stellen (Sync-Anzeige breit und im Menü, Zähler breit und mobil, Fälligkeit, Erinnerungen); `uiConventions` hält fest, dass `tabular-nums` nur von dort kommt | S | erledigt |
| D3 | 13 handgebaute Knöpfe umgehen die Bausteine | `src/ui/styles.ts`, neun Komponenten | **erledigt:** `focusRing` ist exportiert und liegt an allen zwölf handgebauten Knöpfen (Zeilen, Menüpunkte, Plus-Knopf, Symbolauswahl); jede trägt außerdem einen Namen für Vorleseprogramme. `uiConventions` verlangt den Ring an **jedem** `<button>` – nachgemessen: ohne ihn ist der Test rot. Die Größenskala der Bausteine gilt dort weiterhin nicht (eigene Formen), aber die Trefferfläche ist überall ≥ 44 px | M | erledigt |
| D4 | Bedienziele unter der Zielgröße | `buttonSizes` in `src/ui/styles.ts` | entschieden: `icon` 36 → **44 px**, Blockknopf 44, Zeilen 44–48 (Ziel erfüllt). `md` 40 und `sm` 32 bleiben **darunter, mit Absicht**: P26 nennt 44–48 als Ziel für Ziele, die eine Handlung *tragen*; P3 verlangt zugleich, dass die Größe das Gewicht kodiert. Wären alle Knöpfe 44, gäbe es keine Abstufung mehr. Verbindlich ist die 24-px-Grenze (AA) – die ist überall erfüllt | S | entschieden |
| D5 | Kontrast wird nirgends gerechnet | `tests/unit/contrast.test.ts` | **erledigt:** WCAG-Rechnung auf den Hex-Rollen – Text 4,5:1 auf `page`/`surface`/`raised`, Bedienelementrahmen 3:1, Statusfarben 4,5:1. Der Test fand drei echte Verstöße: `ink-faint` **#737373 → #8f8f8f** (3,2:1 auf `raised`) und `line-strong` **#404040 → #6b6b6b** (1,7:1 auf `surface`: Eingabefelder waren praktisch unsichtbar) | M | erledigt |
| D6 | Die vier Zustände sind nur halb entworfen | `src/ui/WorkspaceError.tsx` | erledigt/entschieden: Der **Fehlerzustand** fehlte ganz – schlug das Öffnen der lokalen Datenbank fehl, blieb die Ladeanzeige für immer stehen. Jetzt `WorkspaceError` mit „Erneut versuchen“. **Bewusst keine Skelette:** Die Daten liegen lokal, ein Skelett wäre ein Aufblitzen (P35 entfällt) | S | entschieden |
| D7 | Bewegungsreduktion und Haptik fehlen | `src/index.css` | erledigt/entschieden: **Bewegungsreduktion** steht jetzt als `@media (prefers-reduced-motion: reduce)` (`tests/unit/motion.test.ts` hält sie fest). **Haptik bewusst nicht:** Sie wäre die einzige Änderung, die eine native Abhängigkeit braucht (`@capacitor/haptics`), und die sichtbare Rückmeldung ist vollständig (P47); die Entscheidung steht hier, damit sie nicht als Versehen gilt | S | entschieden |
| D8 | Kein Inhaltsdeckel, gekürzter Text ohne Zugang | `src/ui/TaskPanel.tsx`, `src/ui/components/Sheet.tsx` | **erledigt:** der Aufgabenbereich ist auf `max-w-2xl` gedeckelt und zentriert; Blatt-Untertitel und Listentitel tragen den vollen Text als `title` | S | erledigt |
