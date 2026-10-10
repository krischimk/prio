# Prio: Bestandsprüfung und Plan für den UI-Overhaul

Ausgangsprüfung: **9. Oktober 2026**, fortgeschrieben am **10. Oktober 2026**. Geprüft: **`main`, `6bd45440e1a01a73e7b3296d736ef581d51fb0a7`, Version 0.23.4**.

Die Bestandsprüfung und der Stufenplan beziehen sich auf den oben genannten Ausgangscommit. Nach ausdrücklichen Folgeaufträgen wurden begrenzte Grundlagenpakete umgesetzt; ihre eigenen Abschlussstände stehen in §11 und §12. Der erneute Abgleich sämtlicher geplanter Features und die Korrektur voreilig angenommener Defaults stehen in §13. Der erste konkrete Gesamtansicht-Ablauf und seine Grenzen stehen in §14; die anschließende Aufbewahrung und Nachbar-Rückkehr in §15. Produktvorschläge sind als solche gekennzeichnet; die Aufgabenhierarchie und die Prioritätsformel bleiben offen. Frühere Analysen und Entwürfe wurden nicht als Beleg übernommen.

In den Rückfragen bestätigt: **MCP zunächst nur für den Cloud-Bestand**, **persönliche synchronisierte Listenauswahl für die Gesamtansicht**, **Rückkehr in die ursprüngliche Nachbarschaft mit festgelegtem Rückfall** und **ungespeicherte Eingaben je Liste/Aufgabe behalten**. Die Entwurfsregel wurde nach Erläuterung des Beispiels ausdrücklich bestätigt: Eine ungespeicherte Eingabe in „Einkaufen“ bleibt dort beim Wechsel zu „Arbeit“ erhalten und erscheint beim Zurückwechseln wieder. Sie wird dadurch noch nicht gespeichert.

**Nachträglich ausdrücklich geklärt:** „Abgehakt am Listenende“ ohne Sieben-Tage-Grenze ist eine aktivierbare Listeneinstellung, **kein neuer Default**; sie ist zunächst aus. Bei ausgeschalteter Einstellung sollen erledigte Aufgaben künftig nach sieben Tagen automatisch und ohne weitere Wiederherstellungsfrist verschwinden. Bereits erledigte Aufgaben erhalten bei Einführung dieser Regel und beim Abschalten von „Abgehakt“ sieben Tage ab der Umstellung. „Abgehakt“, Prioritätsnutzung und Namensregel bestimmt der Besitzer gemeinsam für die Liste. Bestehende und neue Listen kommen erst nach ausdrücklichem Aktivieren in die persönliche, synchronisierte Gesamtansicht. Das heutige Verhalten löscht nach sieben Tagen noch nichts; automatische Löschung ist eine neue Funktion.

## Empfehlung

**Den Overhaul früh beginnen, nach einer begrenzten Absicherung der Datenoperationen und des Ansichtszustands. Nicht erst sämtliche neuen Features in die alte Oberfläche einbauen.** Ein vollständiger Neubau der Architektur vor dem UI wäre ebenfalls unnötig.

Der aktuelle Stand enthält bereits brauchbare Grenzen: reine Fachfunktionen, aufgeteilte Repositories, eine React-freie Arbeitsbereichslaufzeit, einen gemeinsamen Ansichtszustand, semantische Gestaltungstokens und gemeinsame Formular- und Dialogbausteine. Diese Teile ermöglichen den schrittweisen Austausch der Oberfläche.

Die größten Risiken liegen in **Schreibkonflikten, unvollständiger Absicherung von Berechtigungen und Wiederöffnen sowie Entwürfen, die an veralteten Daten oder der falschen Liste hängen**. Mehr Felder, gemeinsame Listen und Agenten würden diese Risiken verstärken. Sie rechtfertigen konkrete Vorarbeiten, aber kein allgemeines Erweiterungsframework.

Der Gesamtauftrag ist damit gut machbar, jedoch größer als eine neue Gestaltung: Grundoberfläche, Bewertungsmodell, Matrix, optionale Hierarchie und unabhängiger MCP-Zugriff sind getrennte Lieferumfänge. Der MCP-Schreibweg und eine echte Hierarchie sind die aufwendigsten fachlichen Erweiterungen. Eine seriöse Gesamtzeit lässt sich vor deren Produktentscheidungen nicht festlegen.

## 1. Prüfgrundlage und Grenzen

### Repository und Aktualität

- Zu Beginn war die Arbeitskopie sauber, auf `main`, mit `origin/main` als Upstream.
- `origin` wurde frisch abgerufen. Lokaler und entfernter Branch standen beide auf dem oben genannten Commit; Ahead/Behind: **0/0**. Auch die direkte Remote-Abfrage bestätigte den Stand. Ein Pull hätte keine Änderung gebracht.
- `package.json` und Tag `v0.23.4` passen zusammen.
- Untersucht wurden Quellcode, aktuelle Dokumentation, Migrationen, Testaufbau und die tatsächlich gerenderte Weboberfläche mit eigens angelegten Mock-Daten.

### Ausgeführte Prüfung

| Prüfung | Ergebnis | Aussagegrenze |
| --- | --- | --- |
| Installation aus dem vorhandenen Lockfile | Erfolgreich; Lockfile unverändert | Der vorhandene Abhängigkeitsordner war zunächst veraltet und enthielt dnd-kit nicht. Dieser Umgebungsfehler wurde vor der Bewertung behoben. |
| `npm run ci` | Typecheck, Lint, Skriptprüfung, **454 Tests in 54 Dateien**, Produktionsbuild erfolgreich | Eine Lint-Warnung in `Markdown.tsx`; Warnung wegen des großen Hauptbundles. Grün bedeutet nur, dass die vorhandenen Prüfungen bestehen. |
| Gesamter E2E-Lauf | **81 Tests erfolgreich**, einschließlich PWA gegen den Produktionsbuild | Mock-Server und Chromium; kein Beweis für die tatsächlich installierten Cloud-Policies oder native Gesten. |
| Zusätzliche Datenproben | Acht gezielte Fälle mit echtem Repository-/Sync-Code, kontrollierter Uhr, lokalen Testdatenbanken und dem Remote-Testserver | Die Fälle unten wurden eigens geprüft und sind teilweise noch nicht Bestandteil der regulären Testsuite. Kein Schreibversuch gegen die Produktionscloud. |
| Zusätzliche UI-Prüfung | Desktop, Telefon-Hochformat, Web-Querformat, Aufgabenformular mit 200 % Schrift, Listenbesitzer und Mitglied | Browserprüfung mit Testdaten; kein Zugriff auf persönliche App-Daten oder den Benutzerdesktop. |
| Tatsächliche Cloud-Datenbank | **Nicht verifiziert** | `db:check` konnte wegen fehlendem `psql` nicht laufen. Eingespieltes Schema, externe Bereinigung und echte RLS-Wirkung sind damit nicht bestätigt. |

Bei Abschluss des ursprünglichen Planungsauftrags blieben Anwendung und Tests unverändert. Zwischenzeitlich verfrüht begonnene Implementierungsänderungen wurden vollständig zurückgenommen. Der danach ausdrücklich beauftragte Umsetzungsschritt ist gesondert in §11 dokumentiert. Eine Emulator-/Release-Runde war für die reine Planung nicht erforderlich; sie bleibt ein Abschlusskriterium späterer UI-Veröffentlichungen.

## 2. Tatsächliches Verhalten der heutigen Funktionen

| Thema | Befund | Konsequenz |
| --- | --- | --- |
| Sieben Tage | Erledigte und gelöschte Aufgaben werden in den Wiederherstellen-Abfragen auf die letzten sieben Tage eingeschränkt. Danach bleiben die Zeilen bestehen. Nach acht Tagen ließen sie sich über das Repository noch öffnen bzw. wiederherstellen. Im untersuchten Code ist keine automatische Bereinigung nach sieben Tagen vorhanden. | **Sieben Tage sind heute eine Sichtbarkeitsgrenze, keine Löschfrist.** Die inzwischen ausdrücklich gewünschte automatische Löschung ist ein neuer Fachablauf. Der optionale dauerhafte Bereich „Abgehakt“ benötigt eine eigene Abfrage und aktiviert die Aufbewahrung dieser Liste. |
| Erledigt und gelöscht | `completed`/`completed_at` und `deleted_at` sind bereits getrennt. Das Wiederherstellen-Panel präsentiert beides gemeinsam. | „Abgehakt“ gilt nur bei aktivierter Listeneinstellung. Sonst gilt künftig die bestätigte Sieben-Tage-Löschregel. Automatisch abgelaufene Aufgaben bekommen keine zusätzliche Papierkorbfrist; die Wiederherstellung manuell gelöschter Aufgaben ist davon gesondert zu behandeln. |
| Gleiche Namen | Zwei Aufgaben mit gleichem Titel werden bereits akzeptiert. | Neu ist die **einstellbare Einschränkung**, nicht die grundsätzliche Erlaubnis. Bestehende Daten dürfen durch einen neuen Standard nicht plötzlich ungültig werden. |
| Erstellzeitpunkt | `created_at` ist bereits vorhanden. | Kein neues Grundfeld nötig; Sichtbarkeit, Unveränderlichkeit und Nutzung für die Altersfarbe sind festzulegen. |
| Ursprüngliche Position | Die Position bleibt beim Abhaken erhalten. Umsortieren der offenen Aufgaben vergibt jedoch neue Positionen ohne die erledigten Aufgaben. Im Test entstand beim Wiederöffnen `A:1, B:1, C:2`. | Eine gespeicherte Zahl allein gewährleistet die gewünschte Rückkehr an die ursprüngliche Stelle nicht. |
| Ursprüngliche Gruppe | `section_id` bleibt normalerweise bestehen. Beim Löschen eines Bereichs werden auch erledigte Aufgaben aus ihm gelöst. | Für entfernte Gruppen braucht es einen bewussten Rückfall. Eine nicht mehr vorhandene Gruppe kann nicht unverändert wiederhergestellt werden. |
| Wiederkehrende Aufgaben | Abhaken erzeugt einen Nachfolger. Wiederöffnen löscht einen noch offenen Nachfolger weich; dessen zwischenzeitliche Bearbeitungen werden dabei nicht besonders geschützt. | „Undo unmittelbar nach Abhaken“ und „historische Aufgabe später wieder öffnen“ brauchen eine ausdrückliche Regel für den Nachfolger. |
| Neue Bewertungsfunktionen | Aufwand, Wichtigkeit, Dringlichkeit, Aufgabenicon, Checkliste, Elternreferenz und die vorgesehenen Listenschalter fehlen. | Diese Features können einzeln auf der neuen Oberfläche entstehen. |

Belege: [Aufgabenoperationen](/home/krischi/Documents/GitHub/prio/src/db/repositories/aufgaben.ts:23), [Wiederherstellen-Abfragen](/home/krischi/Documents/GitHub/prio/src/db/repositories/aufgaben.ts:288), [Sieben-Tage-Grenze](/home/krischi/Documents/GitHub/prio/src/domain/ordering.ts:57), [Datenmodell](/home/krischi/Documents/GitHub/prio/src/domain/types.ts:90). Auch die aktuelle [README](/home/krischi/Documents/GitHub/prio/README.md:719) beschreibt ausdrücklich, dass nach sieben Tagen keine Löschung erfolgt.

## 3. Befunde, die den Plan beeinflussen

### Nachgewiesene Probleme

Lokale und UI-Fehler wurden direkt nachgestellt. Die Sync-Fälle wurden mit dem bestehenden Remote-Testserver reproduziert und mit dem realen Supabase-Gateway abgeglichen: dessen unbedingte Upserts bzw. Tabellen-Batches besitzen die relevanten Schutzmechanismen nicht. Das belegt die Lücke im Repository; es behauptet keinen beobachteten Vorfall in der Produktionscloud.

| Befund | Nachweis und praktische Wirkung | Benötigter Abschluss |
| --- | --- | --- |
| **Ältere Uploads können neuere Cloud-Daten überschreiben.** | Mit zwei wirklich getrennten lokalen Datenbanken wurde zuerst die Änderung von 12:02 hochgeladen, danach eine Offline-Fassung von 12:01. Auf dem Server stand anschließend die ältere Fassung. Der Gateway schreibt unbedingte ganze Zeilen; die LWW-Entscheidung findet erst beim lokalen Pull statt. Das neuere Gerät behielt seine lokale Fassung und könnte sie später erneut hochladen, aber der Cloud-Bestand war zwischenzeitlich falsch. | Versionsprüfung **am Server**, für alle Schreibwege. Vor Freigabe schreibenden MCP-Zugriffs zwingend; bei der ersten neuen produktiven UI-Lieferung ebenfalls beheben oder als gesonderte, ausdrücklich akzeptierte Einschränkung behandeln. |
| **Parallele lokale Änderungen können sich verlieren.** | Zwei gleichzeitig gestartete Änderungen an Titel und Beschreibung ließen nur die neue Beschreibung übrig. `updateTask` liest eine Zeile, baut eine ganze neue Zeile und schreibt sie ohne gemeinsame Lese-/Schreibtransaktion. | Atomare lokale Änderungen; ungeänderte Felder nicht aus alten Formularständen zurückschreiben. |
| **Ein Millisekunden-Zeitstempel ist keine eindeutige Upload-Quittung.** | Bei zwei Änderungen mit identischem Zeitstempel wurde `dirty` nach Bestätigung des alten Uploads gelöscht, obwohl lokal bereits ein anderer Wert stand. | Bestätigung mit dem tatsächlich gesendeten Stand vergleichen, etwa durch vollständigen Vergleich der synchronisierten Felder oder eine lokale Änderungskennung. Eine neue Spalte ist dafür nicht zwingend. `updated_at` allein identifiziert die Änderung nicht. |
| **Die Quarantäne isoliert noch nicht die tatsächlich schlechte Zeile.** | Eine gültige und eine ungültige Aufgabe im selben Tabellen-Upload wurden beide abgelehnt. Nach drei Versuchen lagen beide in der Quarantäne; die gültige war nicht hochgeladen. | Fehlerhafte Zeilen isolieren; gültige weiter übertragen. Vorübergehende Fehler und dauerhafte Ablehnung getrennt behandeln. |
| **Entwürfe können die Liste wechseln.** | Auf dem Desktop blieb ein Aufgabenentwurf beim Wechsel von „Alltag“ zu „Projekt“ erhalten. Auch das offene Umbenennen-Formular behielt den Namen aus „Alltag“, während bereits „Projekt“ ausgewählt war. | Entwurf an eine feste Entitäts-/Listenkennung binden; Wechsel behandelt ihn ausdrücklich. Ein alter Entwurf darf keine andere Liste bearbeiten. |
| **Formulare können Änderungen aus anderen Quellen überschreiben.** | `useTaskForm` hält Anfangswerte und sendet beim Speichern alle bearbeitbaren Felder, auch unveränderte. Zusammen mit den vollständigen Zeilenschreibvorgängen ist ein inzwischen geänderter Server-/Agentenstand nicht geschützt. | Geänderte Felder plus Basisrevision; nachvollziehbare Konfliktbehandlung. Dieser Befund ergibt sich aus dem Schreibpfad, nicht aus einem separat gemessenen Live-Cloud-Konflikt. |
| **Berechtigungen und Funktionsparität stimmen nicht durchgängig.** | Ein Listenmitglied bekommt auf dem Desktop „Umbenennen“ und „Liste löschen“, aber kein „Liste verlassen“. Mobil ist es umgekehrt korrekt eingeschränkt. Das lokale Repository prüft Existenz, nicht die handelnde Person. | Gemeinsame Aktionsberechtigungen in beiden Oberflächen; verbindliche Cloud-Prüfung bleibt erhalten. Das ist ein falsches Bedienangebot und eine lokal mögliche Fehländerung, kein nachgewiesener RLS-Durchbruch. |
| **Die Dialog-Fokusführung ist unvollständig.** | Direkt nach Öffnen des Wiederherstellen-Dialogs führte Shift+Tab zu einem „Löschen“-Knopf im Hintergrund. Die Fokusfalle behandelt Anfang/Ende der Bedienelemente, nicht den zunächst fokussierten Dialograhmen. | Fokus bleibt im aktiven Dialog, Hintergrund ist inaktiv, Schließen stellt Fokus sinnvoll wieder her. |
| **Web-Querformat läuft über.** | Bei 844 × 390 CSS-Pixeln war das Dokument 960 Pixel breit. Unter anderem „Hinzufügen“ und „Liste löschen“ lagen teilweise außerhalb des sichtbaren Bereichs. | Kernaktionen ohne horizontales Seitenscrollen in Hoch-/Querformat und an den tatsächlichen Umschaltschwellen erreichbar. |

Belege: [Cloud-Schreibweg](/home/krischi/Documents/GitHub/prio/src/sync/supabaseGateway.ts:58), [Sync-Ablauf](/home/krischi/Documents/GitHub/prio/src/sync/syncEngine.ts:99), [Upload-Quittung](/home/krischi/Documents/GitHub/prio/src/sync/syncStore.ts:186), [lokales Update](/home/krischi/Documents/GitHub/prio/src/db/repositories/aufgaben.ts:101), [Formularspeicherung](/home/krischi/Documents/GitHub/prio/src/ui/useTaskForm.ts:91), [Desktop-Listenaktionen](/home/krischi/Documents/GitHub/prio/src/ui/TaskPanel.tsx:119), [mobile Berechtigungsprüfung](/home/krischi/Documents/GitHub/prio/src/ui/mobile/ListSettingsSheet.tsx:44), [Dialogverhalten](/home/krischi/Documents/GitHub/prio/src/ui/components/useDialog.ts:49).

### Grenzen der bisherigen Tests

Der Integrations-Testaufbau öffnet eine nach Benutzerkennung zwischengespeicherte Datenbank. Zwei „Geräte“ desselben Kontos erhalten darin **dasselbe Datenbankobjekt**. Das wurde direkt geprüft. Die betreffenden Mehrgeräte-Tests beweisen deshalb nicht das Verhalten zweier unabhängiger Offline-Bestände. Andere Tests mit getrennten Browserkontexten sind davon nicht automatisch betroffen. Belege: [Harness](/home/krischi/Documents/GitHub/prio/tests/support/harness.ts:23), [Mehrgeräte-Test](/home/krischi/Documents/GitHub/prio/tests/integration/multiDevice.test.ts:27).

Die Paritätsprüfung führt nur die aufgenommenen Funktionen aus. Die ergänzende Zuordnung lässt unter anderem Umsortieren und Verlassen einer Liste aus; „restoreTask“ wird einem Test zum Wiederöffnen erledigter Aufgaben zugeordnet, obwohl das unterschiedliche Operationen sind. Der Desktop hat aktuell keinen entsprechenden Umsortierweg. Auch die Erstellung ist unterschiedlich: mobil sind mehr Felder sofort verfügbar als im Desktop-Composer. Ein späterer Bearbeitungsweg ersetzt nicht zwingend einen gleichwertigen Erstellungsablauf. Beleg: [Abdeckungszuordnung](/home/krischi/Documents/GitHub/prio/tests/unit/parityCoverage.test.ts:41).

**Folgerung:** Die grüne Suite ist eine nützliche Basis. Ihre Testfälle und ihre tatsächliche Aussage müssen vor größeren Fachänderungen korrigiert werden. Zusätzliche Tests sollten beobachtete Fehler und fachliche Verträge abdecken, keine unverbindlichen Pixel oder die neue Implementierung nacherzählen.

### Weitere Risiken und Gestaltungsbefunde

- **Unpaginierte Datenabfragen:** Der Cloud-Pull verwendet drei unpaginierte `select('*')`-Abfragen. Supabase dokumentiert standardmäßig maximal 1.000 zurückgegebene Zeilen; die konkrete Projekteinstellung wurde nicht geprüft. Dauerhaftes „Abgehakt“, Soft Deletes und zusätzliche Einträge erhöhen das Risiko eines unvollständigen Bestands auf neuen Geräten. Erst vollständige, geordnete Seitennavigation einführen; ein umfassender Delta-Sync ist dafür keine notwendige Vorbedingung. [Gateway](/home/krischi/Documents/GitHub/prio/src/sync/supabaseGateway.ts:40), [Supabase-Dokumentation zum Projektlimit](https://supabase.com/docs/reference/python/select).
- **Lesefehler sind unsichtbar:** Die Hooks behalten bei Fehlern den letzten Stand, ohne ihn als veraltet oder fehlgeschlagen zu kennzeichnen. Beim ersten Laden kann ein Fehler wie eine leere Liste aussehen. Auch eine neue Gesamtansicht braucht „lädt“, „leer“, „Fehler“ und gegebenenfalls „letzter bekannter Stand“ als unterscheidbare Zustände. [Lese-Hooks](/home/krischi/Documents/GitHub/prio/src/app/hooks.ts:14).
- **Kleine Bedienflächen:** Gemessen wurden 16 × 16 Pixel für die Desktop-Checkbox, 20 × 20 mobil und rund 28 × 11 für „Mehr“. Daraus allein folgt wegen der WCAG-Ausnahmen zu Abstand und gleichwertigen Zielen noch kein vollständiges Konformitätsurteil. Es ist aber eine schlechte Ausgangslage für verlässliches Tippen. Die Produktvorgabe sollte erreichbare Trefferflächen festlegen, unabhängig von der sichtbaren Symbolgröße. [WCAG-Zielgrößen](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html).
- **Kontrastprüfung mit Lücken:** Weiß auf `brand` erreicht rechnerisch rund **4,47:1**, auf dem Hover-Hintergrund `brand-soft` rund **2,98:1**. Der normale kleine Knopftext braucht 4,5:1; die vorhandenen Tests prüfen diese Paarungen nicht. Gemeinsame Tokens ersetzen keine Prüfung der tatsächlich kombinierten Vorder-/Hintergründe. [Knopfvarianten](/home/krischi/Documents/GitHub/prio/src/ui/styles.ts:69), [Tokens](/home/krischi/Documents/GitHub/prio/src/index.css:37), [WCAG-Kontrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html).
- **Umschalten ist plattformabhängig:** Aktuell schaltet der Browser ab 768 Pixeln, die native App ab 1024. Die allgemeine 1024-Aussage in den Arbeitsregeln trifft den Browserstand nicht. Der Querformatbefund oben stammt ausdrücklich aus dem Web; native Safe Areas und Systemtastatur wurden damit nicht bewiesen. [Umschaltlogik](/home/krischi/Documents/GitHub/prio/src/app/useIsDesktop.ts:4).
- **Drag-and-drop ist konzentriert, aber komplex:** Die mobile Aufgabenliste verbindet Sensoren, DOM-basierte Vorschau, Gruppierung und Persistierung. Reale Langdruckgesten und Bereichswechsel sind nicht durch die grüne Paritätssuite bewiesen. Vor Übernahme messen bzw. gezielt nachstellen. Eine bedienbare Alternative ohne Ziehen ist vorzusehen; Tastatur allein genügt dafür nicht. [WCAG zu Ziehbewegungen](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html).

Die gesichteten Testbilder zeigen außerdem eine unruhige Hierarchie aus vielen kleinen Metadaten und ständig sichtbaren Verwaltungsaktionen. Die breite Ansicht nutzt viel Platz außerhalb eines vergleichsweise engen Arbeitsbereichs. Das sind Gestaltungsbefunde, keine objektiven Beweise für eine bestimmte neue Ästhetik. Sie sprechen für klarere Hauptaktionen, weniger Metadaten im Normalzustand und gezieltes Öffnen von Details.

## 4. Das Grundgerüst gezielt festigen

### Beibehalten

1. **React und TypeScript, Dexie lokal, Supabase als Cloud.** Ein Technologiewechsel ist durch diesen Befund nicht begründet.
2. **Reine Fachfunktionen und vorhandene Ports.** Sync ohne React/Supabase, Erinnerungsplanung ohne Systemzugriff und die Feldnormalisierung sind gute Grenzen.
3. **Den bestehenden Repository-Einstieg.** Schreibende UI-Aufrufe bleiben dort gebündelt; Aufteilung nach Aufgaben, Listen, Mitgliedern und Einstellungen erhalten.
4. **Eine Datenquelle pro Ausführungskontext.** Die UI arbeitet mit ihrem lokalen Bestand, der MCP-Server mit dem Cloud-Bestand. Beide verwenden dieselben fachlichen Verträge; sie brauchen keinen gemeinsamen globalen Zustandsstore.
5. **Tokens, Kitchen und nutzbare Bausteine.** Verhaltensfehler korrigieren; das Styling schrittweise austauschen.

### Die notwendigen Austauschgrenzen

| Grenze | Konkrete Veränderung | Umfangsgrenze |
| --- | --- | --- |
| Fachregeln ↔ Speicherung | Validierung, Zustandsübergänge und Ableitungen aus den betroffenen Repository-Methoden in React-/Dexie-/Supabase-unabhängige Funktionen ziehen. Lokale und Cloud-Adapter sorgen für Transaktionen und Berechtigungen. | Zuerst einen echten Ablauf gemeinsam verwenden: Aufgabe ändern. Danach weitere Operationen beim tatsächlichen Bedarf. Kein generischer Repository-Baukasten. |
| Lesen ↔ Darstellung | Einen gemeinsamen Aufgaben-Lesescope für Liste/Gesamtansicht mit klaren Filtern und Lade-/Fehlerzuständen anbieten. | Keine zusätzliche Kopie aller Aufgaben in einem neuen Store. `dataVersion` zunächst behalten; feinere Abonnements erst bei gemessenem Bedarf. |
| Ansicht ↔ Entität | Ansicht explizit als Gesamtansicht, Liste mit ID oder Matrix darstellen. Offene Aufgabe und Verschiebeziel über IDs referenzieren. | Keine neue Routing- oder Navigationsplattform nur für drei Ansichten. |
| Entwurf ↔ gespeicherte Aufgabe | Draft mit Entitätskennung, Basisrevision und geänderten Feldern. Vorhandene Werte kommen weiterhin aus dem gemeinsamen Leseweg. | Entwurf ist erlaubter lokaler Formularzustand, keine zweite fachliche Wahrheit. |
| Mutation ↔ Rückmeldung | Einheitliche Ergebnisse für lokal gespeichert, Cloud bestätigt, Validierungsfehler, fehlendes Recht und Konflikt. | Keine universelle Event-Bus-/Workflow-Engine. |

`createWorkspaceRuntime` ist bereits React-frei, öffnet aber Dexie und bindet Capacitor-Benachrichtigungen. **Sie ist daher nicht automatisch eine serverfähige MCP-Laufzeit.** Ihre Browserdienste zu emulieren wäre die falsche Vorbereitung. Der Server braucht nur die gemeinsame Fachlogik und einen konkreten Cloud-Datenzugriff. Beleg: [Laufzeit](/home/krischi/Documents/GitHub/prio/src/app/workspaceRuntime.ts:69).

Ein guter Nachweis der Austauschbarkeit ist eine echte vertikale Strecke: Ein altes und ein neues Aufgabenformular können dieselbe Operation aufrufen; dieselbe Validierung lässt sich außerhalb des Browsers ausführen. Dafür müssen nicht schon sämtliche Funktionen portiert sein.

## 5. DESIGN.md kritisch neu ordnen

**Die 65 Prinzipien nicht pauschal übernehmen.** Das Dokument verbindet einen unverbindlichen Vorrat, frühere Befunde, Stilpräferenzen und Erledigt-Vermerke. Beispielsweise nennt §13 rohe Farbklassen als aktuellen Bestand, obwohl §15 deren Umstellung als erledigt beschreibt; Zählungen und offene Arbeitsvorräte widersprechen sich. „Gilt“ ist daher kein verlässlicher Nachweis.

| Bestehende Vorstellung | Problem | Bessere Grundlage |
| --- | --- | --- |
| Jeder Wert braucht eine eigene Benennung/Begründung | Für normale Abstände oder Standardlayout entsteht viel Regel- und Kommentaraufwand ohne entsprechenden Nutzen. | Wiederkehrende Bedeutungen als Rollen; normale Layoutwerte aus einer kleinen bestehenden Skala. Entscheidungen mit echter Auswirkung begründen. |
| Größe kodiert Wichtigkeit | Eine nebensächliche Aktion kann trotzdem eine große Trefferfläche brauchen. In der Matrix ist Icon-Größe bereits ausdrücklich für Aufwand reserviert. | Sichtbares Gewicht, Informationskodierung und Trefferfläche getrennt festlegen. |
| Eine Bedeutung hat genau eine Farbe | Zu absolut für mehrere Modi und für Alter, Priorität, Dringlichkeit und Fehler. Eine gemeinsame Quelle ist sinnvoller als ein unveränderlicher Farbwert. | Kontextbezogene Rollen; keine widersprüchlichen Bedeutungen innerhalb derselben Darstellung. Bedeutung zusätzlich ohne Farbe vermitteln. |
| Fehler nennen nur den nächsten Schritt | „Nicht erlaubt“ und „inzwischen geändert“ brauchen verständliche Ursachen. Sonst kann der Nutzer den nächsten Schritt nicht beurteilen. | Kurze fachliche Ursache plus wirksame nächste Handlung; technische Details ins Log. |
| Deaktiviert ist immer eine Deckkraft | Eine feste Opazität gewährleistet weder Erkennbarkeit noch Verständlichkeit. | Zustände an echten Farbpaaren und mit ihrem Grund prüfen. |
| Busy-Knopf bedeutet zuverlässiges Schreiben | Schützt nicht vor zwei Formularen, Agenten, Geräten, Wiederholung nach Timeout oder verspäteten Antworten. | Rückmeldung im UI und Transaktions-/Versionsschutz im Datenpfad getrennt prüfen. |
| `title` macht gekürzten Text erreichbar | Ein Hover-Tooltip ist auf Telefonen und für Tastaturbedienung keine ausreichende Lösung. | Volltext über eine verständliche, bedienbare Detailansicht bzw. Aufklappen zugänglich. |
| Paritätstabelle macht die Gegenprüfung überflüssig | Die tatsächlichen Lücken zeigen, dass eine manuell ausgewählte Tabelle keine automatische Vollständigkeit beweist. | Funktionsinventar nach fachlichen Operationen, Rollen und wichtigen Abläufen führen; kritische Wege tatsächlich ausführen. |

Belege: [DESIGN.md](/home/krischi/Documents/GitHub/prio/DESIGN.md:1), insbesondere P3, P7, P9, P37–P40, P61, P64–P65 und §§13–15. Fremde Compose-/Material-Beispiele können Ideen liefern, begründen aber keine Prio-spezifische Produktregel. Die sinnvollen Teile bleiben: gemeinsame Semantik, lesbarer Kontrast, erkennbare Zustände, progressive Details und einheitliche Formate.

### Vorschlag für zehn überprüfbare neue Designregeln

Diese Regeln beschreiben gewünschtes Verhalten. Ihre optischen Werte werden erst an repräsentativen Ansichten festgelegt. Für jede spätere Freigabe braucht es den genannten Nachweis, nicht lediglich eine Statusspalte.

| Regel | Begründung | Überprüfbarer Nachweis |
| --- | --- | --- |
| **D1: Eine Aufgabe bleibt an ihrer Kennung erkennbar.** Liste, Editor, Matrix und Agenten zeigen denselben fachlichen Stand; gleichnamige Aufgaben bleiben unterscheidbar. | Doppelte Titel und mehrere Ansichten dürfen keine Identitätsfehler erzeugen. | Gleichnamige Aufgaben öffnen/ändern; Bearbeitung aus Gesamtansicht trifft genau die richtige ID und Liste. |
| **D2: Entwürfe haben einen festen Besitzer und ein erklärtes Ende.** Wechsel, Schließen und konkurrierende Änderungen behandeln den Entwurf bewusst. | Verhindert Änderungen an der falschen Entität und unbemerkten Verlust. | Liste wechseln, Breite wechseln, zurück, Escape, schließen und externe Änderung während des Entwurfs prüfen. |
| **D3: Im Normalzustand stehen Aufgabe und Hauptaktion im Vordergrund.** Unbewertete Aufgaben bleiben ruhig; Zusatzfelder sind bei Bedarf erreichbar. | Optionale Bewertung soll alltägliche Erfassung nicht erschweren. | Eine Standardaufgabe lässt sich ohne Bewertungsfelder anlegen und abhaken; lange Titel und fehlende Metadaten bleiben verständlich. Nutzerprüfung an typischen Aufgaben. |
| **D4: Priorität, Aufwand, Alter und Fehler haben unterscheidbare Darstellungsrollen.** | Die Matrix und die Liste dürfen widersprüchliche Signale vermeiden. | Legende und dieselben Beispieldaten in Liste/Matrix; Aufwand beeinflusst dort Größe, Alter Farbe, Priorität eine ausdrücklich eigene Hervorhebung. Auch ohne Farbe verständlich. |
| **D5: Gleiche Funktionen und Informationen haben auf Telefon und breiter Ansicht dieselbe Bedeutung.** Bedienwege und Dichte dürfen angepasst sein. | Erhält Konsistenz ohne doppelte, starre Markup-Bäume. | Aktionsinventar mit Besitzer-/Mitgliedsrollen, Erstellung, Bearbeitung, Verschieben, Wiederöffnen und Fehlerfällen auf beiden Ansichten ausführen. |
| **D6: Jede Kernaktion funktioniert mit Tastatur und mit einem einzelnen Zeiger ohne verpflichtendes Ziehen.** | Langdruck und Drag allein schließen Bedienweisen aus. | Umsortieren über zugängliche Alternative; Slider setzt per Track-Tap/Klick, Pfeiltasten und direkter Zahleneingabe denselben Wert. |
| **D7: Dialoge und Navigation bewahren Orientierung.** | Fokus, Zurück und ungespeicherte Änderungen sind Teil des Produkts. | Fokus bleibt im Dialog; Hintergrund inaktiv; Fokus kehrt zurück; mobile Zurück-Taste schließt die oberste Ebene. Browsertest, später native Prüfung. |
| **D8: Lesbarkeit und Bedienflächen werden am gerenderten Zustand geprüft.** | Token-Namen und Quelltextmuster beweisen weder Kontrast noch nutzbare Größe. | Normaler Text mindestens 4,5:1, große Schrift 3:1 nach WCAG; relevante nichttextliche Markierungen 3:1. Produktziel 44 × 44 CSS-Pixel für häufige Touch-Aktionen, dokumentierte dichte Ausnahmen; 200 % Schrift und Hoch-/Querformat ohne verlorene Kernaktion. |
| **D9: Speichern nennt den erreichten Zustand und erklärt Fehler.** | Lokal gesichert ist etwas anderes als in der Cloud bestätigt. | Offline, langsame Antwort, Ablehnung, Timeout nach erfolgreichem Commit und Versionskonflikt prüfen. Ein Entwurf bleibt bei Fehlern erhalten; Retry verdoppelt keine Wirkung. |
| **D10: Wiederkehrende Gestaltung wird gemeinsam geändert; Ausnahmen haben einen konkreten Zweck.** | Kleine Bausteine und Rollen sind wartbarer als viele lokale Varianten oder ein umfassendes Framework. | Kitchen zeigt eingesetzte Bausteine mit relevanten Zuständen. Quelltextprüfungen sichern Konventionen; Screenshots und Ablaufprüfungen sichern deren tatsächliche Wirkung. |

D6 stützt sich auf [WCAG zu Ziehbewegungen](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html), D7 auf das [WAI-Dialogmuster](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/), D8 auf [Kontrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) und [Zielgrößen](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html). Das 44-Pixel-Ziel ist ein vorgeschlagenes Prio-Produktziel, keine pauschale Behauptung über die WCAG-AA-Mindestgröße. Die Dokumentation sollte automatisierte, manuelle und noch fehlende Prüfungen ehrlich unterscheiden.

## 6. Welche Produktentscheidungen wann nötig sind

| Zeitpunkt | Muss dann feststehen | Darf noch offenbleiben |
| --- | --- | --- |
| **Vor den gezielten Vorarbeiten** | Offene/erledigte/gelöschte Zustände; Bedeutung der ursprünglichen Position bei späteren Umordnungen; Konflikte sichtbar statt still überschreiben; Rechte von Besitzer/Mitglied; MCP zunächst Cloud-Bestand. | Farbwelt, Kartengestaltung, Prioritätsformel, Matrixdetails, Eltern-Kind-Modell. |
| **Vor der ersten neuen Gesamt-/Listenansicht** | Gesamtansicht als Start; aktivierte Listen und Besitz der Einstellung; Ziel beim Erstellen einer Aufgabe; anfängliche Gesamtansicht-Sortierung; „Abgehakt“ und Verhalten beim Wiederöffnen; Entwurfs-/Navigationsregeln. | Endgültige Typografie, Animationen, Hellmodus, globale manuelle Reihenfolge über mehrere Listen. |
| **Vor Einführung der betreffenden Felder/Schalter** | Dezimalpräzision; Bedeutung von 0 und Punkt; Nutzung von Prioritäten je Liste; Defaults für bestehende/neue Listen; Regel für Namensgleichheit; Checklisten-Verhalten. | Matrixlayout und hierarchische Aufgaben, sofern Checklisten bewusst einfache Schritte bleiben. |
| **Vor produktivem Ranking und Matrix** | Formel mit Beispielen; manuelle/effektive Dringlichkeit; Fälligkeitseinfluss und Zeitzone; genaue Matrix-Zulassung; Aufwand-Größenabbildung; Altersfarben; Hervorhebungsstufen; Zeitänderungen während Bedienung. | Spätere Feinjustierung von Farbtönen, Abständen oder Animationen, sofern die Semantik stabil bleibt. |
| **Vor Hierarchie-Implementierung** | Eltern-Kind oder Bereiche oder beides; Tiefe, Zyklen, Verschieben, Erledigen, Löschen, Wiederöffnen, Serien und Migration bestehender Bereiche. | Diese gesamte Funktion kann bis zu diesem Zeitpunkt offenbleiben. |
| **Vor MCP-Schreibfreigabe** | Hosting/Transport und Clientkompatibilität; Identität und Zugriffsumfang; Transaktionen; Versionskonflikte; idempotente Wiederholungen; Umgang mit alten App-Schreibwegen. | Nicht benötigt werden ungesendete Offline-Daten, ein Geräte-Hintergrunddienst oder ein komplett umgebautes UI. |

Früh nötig sind vor allem Regeln, die Datenform, Berechtigung, Zustandsübergänge und Informationsarchitektur bestimmen. Endgültige Aussehensentscheidungen fallen anschließend an bedienbaren, repräsentativen Ansichten. Auch ein konkreter UI-Prototyp kann bereits während der begrenzten Vorarbeiten entstehen.

## 7. Fachliche Vorschläge für die geplanten Features

### Gesamtansicht und Listeneinstellungen

**Vorschlag:** Die Gesamtansicht ist eine Abfrage über zugängliche, dafür aktivierte Listen. Aufgaben bleiben in ihrer Ursprungsliste; deren Name und gegebenenfalls Gruppe sind in der Gesamtansicht erkennbar. Ohne aktivierte Listen zeigt sie einen passenden Leerzustand mit direktem Weg zur Auswahl.

**Bestätigt:** Die Aufnahme in die Gesamtansicht ist **eine persönliche, synchronisierte Einstellung je Benutzer und Liste**, zunächst **aus** für bestehende und neue Listen. Bei geteilten Listen verändert ein Mitglied damit nicht die Startansicht aller anderen. „Prioritäten verwenden“, „Abgehakt am Listenende“ und „gleiche Namen erlauben“ gelten dagegen **gemeinsam für die Liste; der Besitzer stellt sie ein**.

**Bestätigt:** Die Gesamtansicht bietet zwei Darstellungsmodi: nach Ursprungsliste gruppiert, darin die bestehende Aufgabenreihenfolge, und eine gemeinsame Liste mit den neuesten Aufgaben zuerst. Nur solange noch keine andere Ansicht gewählt wurde, gilt die Gruppierung. Die bevorzugte Ansicht wird persönlich gespeichert, beim erneuten Öffnen verwendet und zwischen Geräten synchronisiert. Ein Neustart setzt sie nicht auf die Gruppierung zurück. Eine Prioritätssortierung folgt erst mit dem Bewertungsvertrag; eine frei umsortierbare Gesamtansicht bleibt ein eigener Umfang.

**Bestätigt:** Beim Anlegen aus der Gesamtansicht wird die Zielliste ausdrücklich gewählt, bis der Nutzer manuell eine Standardliste gesetzt hat. Erst diese ausdrücklich gesetzte, weiterhin zugängliche Standardliste wird sichtbar vorausgewählt; eine bloße Auswahl bei der letzten Erstellung ändert den Default nicht. Auch die Standardliste wird persönlich synchronisiert. Zur Auswahl stehen alle zugänglichen Listen. Ist das Ziel nicht für die Gesamtansicht aktiviert, erklärt ein sichtbarer Hinweis, dass die Aufgabe dort nicht erscheint; die Erstellung aktiviert die Liste nicht automatisch.

**Vorschlag, noch nicht bestätigt:** Ist die Prioritätsnutzung ausgeschaltet, bleiben gespeicherte Bewertungen erhalten, fallen aber aus Prioritätsdarstellung und -sortierung dieser Liste heraus. Das verhindert Datenverlust beim Umschalten. Der heutige Bestand erlaubt gleiche Namen; daraus folgt noch kein bestätigter Default des neuen Schalters. Die Defaults der Schalter sind für Bestandslisten und neue Listen ausdrücklich festzulegen. „Abgehakt am Listenende“ ist nach Klarstellung zunächst ausgeschaltet.

### „Abgehakt“, Wiederöffnen und Reihenfolge

**Bestätigter Produktvertrag nach Klarstellung:**

- **Einstellung an:** Erledigte Aufgaben erscheinen ohne Sieben-Tage-Grenze in „Abgehakt“ am Listenende. Der Besitzer bestimmt diese gemeinsame Listenregel.
- **Einstellung aus, der anfängliche Default:** Erledigte Aufgaben bleiben zunächst über den Wiederherstellen-Ablauf erreichbar und sollen künftig nach sieben Tagen automatisch gelöscht werden. Danach sind sie für den Nutzer endgültig weg, ohne weitere Wiederherstellungsfrist im Papierkorb.
- **Einführung und Wechsel von an zu aus:** Bereits erledigte Aufgaben erhalten sieben Tage ab der Umstellung. Ihr historischer Abhakzeitpunkt bleibt erhalten; die neue Frist wird separat bestimmt. Neu abgehakte Aufgaben bekommen sieben Tage ab dem Abhaken.
- **Erledigte Aufgabe in andere Liste verschieben:** Es gilt die Zielregel. Ohne dauerhafte Aufbewahrung beginnen sieben Tage ab Verschieben; mit Aufbewahrung entfällt die Frist. Der ursprüngliche Abhakzeitpunkt bleibt erhalten. Bereits Abgelaufenes lässt sich nicht mehr verschieben.
- **Synchronisation:** Ein technischer Löschvermerk darf intern bestehen bleiben, damit ein altes Offline-Gerät die Aufgabe nicht wiederbelebt. Eine abgelaufene Aufgabe wird auch über MCP nicht wiederherstellbar. Eine bloße Sieben-Tage-Filterung erfüllt die neue Löschanforderung nicht.

Die neue Aufbewahrung und automatische Löschung sind Fachlogik. Sie müssen für UI und MCP gelten und auch ohne geöffnete Prio-App zuverlässig angewandt werden. Der konkrete Datenbankjob und seine lokale Prüfung stehen in §15; ein nur im UI laufender Zeitgeber reicht dafür nicht. Die technische Bereinigung von Löschvermerken wird gesondert von der nutzerseitigen Endgültigkeit behandelt.

**In der Fortsetzung bestätigt:** „Abgehakt“ beginnt eingeklappt, mit Anzahl erledigter Aufgaben. Bei eingeschalteter Aufbewahrung sind diese ausschließlich dort erreichbar, ohne zusätzlichen Eintrag unter „Wiederherstellen“. Manuell gelöschte Aufgaben behalten ihren gesonderten Ablauf.

**Bestätigt:** Beim Wiederöffnen zählt die ursprüngliche Nachbarschaft, nicht die alte numerische Listenposition. Die fachliche Reihenfolge muss erledigte Aufgaben mit berücksichtigen. Geeignet sind eine stabile Gesamtreihenfolge mit ausgeblendeten erledigten Einträgen oder eindeutig definierte Positionsanker. Kein vorschneller allgemeiner Baum-/Ranking-Dienst.

**Bestätigter Rückfall anhand A–B–C:** Beim Wiederöffnen von B gilt die ursprüngliche, weiterhin gültige Gruppe. B kommt nach dem noch offenen Vorgänger A, sofern dieser weiterhin in dieser Gruppe und Liste liegt; fehlt er, vor den entsprechenden Nachfolger C. Fehlen beide, kommt B ans Ende der ursprünglichen Gruppe. Wurde die Gruppe entfernt, fällt B in den ungruppierten Teil seiner Liste zurück. Ist A inzwischen hinter C gerückt, kommt B dennoch nach A. Verschobenen Nachbarn wird nicht in andere Gruppen oder Listen gefolgt.

Falls echte Eltern-Kind-Aufgaben eingeführt werden, bleibt ein erledigter Elternteil gemäß ursprünglichem Auftrag als fachliche Referenz erhalten; die offene Ansicht zeigt ein zuerst geöffnetes Kind vorübergehend als Wurzel. Ob die spätere Zuordnung automatisch oder manuell geschieht, bleibt offen. Ein ausdrücklich vom Benutzer geänderter Ort als Ersatz des alten Rückkehrorts ist weiterhin ein Vorschlag. Die Hierarchieentscheidung wird nicht durch die bestätigte Nachbarregel vorweggenommen.

Abschlussfälle: mittlere Aufgabe abhaken; offene Nachbarn umsortieren; nach mehr als sieben Tagen öffnen; Gruppe inzwischen entfernen; Liste wechseln; Seriennachfolger inzwischen bearbeiten; dieselbe Aktion gleichzeitig aus zwei Quellen ausführen. Eine Änderung muss die Aufgabe nachvollziehbar platzieren und bereits bearbeitete Nachfolger schützen.

### Ungespeicherte Eingaben beim Wechsel

**Bestätigt:** Neue Aufgabenentwürfe gehören zu einer festen Liste; Bearbeitungsentwürfe zu einer festen Aufgaben-ID. Beispiel: „Milch“ ist in „Einkaufen“ begonnen, aber noch nicht hinzugefügt. In „Arbeit“ erscheint diese Eingabe nicht. Zurück in „Einkaufen“ erscheint sie wieder. Ein Wechsel der Fensterbreite behält denselben Entwurf.

Das ist eine Hilfe für die laufende Sitzung, keine automatische Erstellung oder Cloud-Synchronisierung von Entwürfen. „Speichern/Hinzufügen“ beendet den Entwurf erfolgreich; „Verwerfen“ entfernt ihn ausdrücklich; ein Schreibfehler erhält ihn. Dauerhaftes Behalten nach App-Neustart ist ein zusätzlicher Umfang und keine Voraussetzung für den UI-Umbau. Ob Schließen eines Editors den Entwurf behält oder eine Rückfrage auslöst, ist vor dem neuen Navigationsablauf eindeutig festzulegen.

### Gleiche Aufgabennamen

Ein Schalter zum Verbieten gleicher Namen benötigt mindestens diese Festlegungen: Vergleich nach Trimmen, Groß-/Kleinschreibung und gegebenenfalls Unicode-Normalisierung; Geltungsbereich pro Liste; Einbeziehung erledigter/gelöschter Aufgaben; Verhalten beim Wiederöffnen, Verschieben und bei Wiederholungen.

**Vorschlag:** Nur offene, nicht gelöschte Aufgaben derselben Liste vergleichen, mit einer gemeinsamen normalisierten Titelregel. Vorhandene Doppelungen beim Aktivieren des Verbots anzeigen und bewusst auflösen lassen; keine automatische Löschung oder Umbenennung. Ein Namenskonflikt beim Wiederöffnen/Verschieben muss vorab eine verständliche Auflösung bekommen. Die Regel muss auch konkurrierende Erstellungen und MCP-Schreibzugriffe am Server abdecken. Identifikation erfolgt überall über IDs.

### Einfache Checklisten

**Vorschlag:** Checklisten sind aufgabeneigene Schritte mit stabiler ID, Text, Reihenfolge und abgehakt/nicht abgehakt. Sie haben zunächst keine eigenen Prioritäten, Termine, Erinnerungen, Berechtigungen oder Eltern-Kind-Kaskaden. Das Erledigen der Aufgabe ist zunächst eine bewusste Aktion; „alle Schritte abgehakt“ kann einen Fortschritt anzeigen, ohne automatisch die Hauptaufgabe abzuhaken.

JSON innerhalb der Aufgabe oder eigene Zeilen sind anhand der tatsächlich gewünschten Änderungsgranularität zu wählen. Stabile Item-IDs und konkrete Operationen wie „Schritt abhaken“ sind in beiden Fällen nötig. Gemeinsame Bearbeitung darf kein blindes Ersetzen einer alten kompletten Checkliste verwenden. Eine Item-Tabelle kann sinnvoll sein, ist aber weder vor dem Overhaul noch für ein hypothetisches universelles Baumobjekt nötig.

### Mögliche Eltern-Kind-Aufgaben

Die Entscheidung bleibt offen. Ein kurzer Bedienprototyp sollte Checklisten, Bereiche und zunächst eine Ebene echter Unteraufgaben an denselben Beispielen vergleichen. Echte Kinder sind eigene Aufgaben; sie erfordern viel mehr Regeln als Checklisten. Bereiche nicht automatisch in Aufgaben umwandeln.

Für den gewünschten Wiederöffnungsfall bietet sich die Trennung von **fachlicher Elternreferenz und aktuell sichtbarer Elternzuordnung** an. Ein Kind kann seine Eltern-ID behalten, während der erledigte Elternteil in der offenen Ansicht fehlt. Das Kind erscheint dort vorübergehend als Wurzel. Wird der Elternteil wieder geöffnet, kann es unter ihm erscheinen, sofern die Referenz noch gültig ist und der Benutzer es nicht ausdrücklich anders zugeordnet hat. Das vorübergehende Darstellen als Wurzel darf nicht die gespeicherte Beziehung löschen.

Vor Implementierung entscheiden: automatische oder ausdrücklich ausgelöste Wiederzuordnung; zulässige Tiefe; Zyklen verhindern; erlaubte Listen-/Gruppengrenzen; Verschieben ganzer Teilbäume; Elternabschluss mit offenen Kindern; Löschen/Wiederherstellen; nicht mehr zugängliche Eltern; Serien; Konflikte beim Umhängen. Elternwerte werden nicht ohne gesonderte Regel aus Kinderwerten berechnet. Die übrige neue Oberfläche muss diese Entscheidung nicht abwarten.

### Bewertungen, Dringlichkeit und Slider

Aufwand, Wichtigkeit und Dringlichkeit sind endliche Werte von **0 bis 10 einschließlich Nachkommastellen**, Standard 0; Standardicon Punkt. **Vorschlag zur Präzision: zunächst eine Nachkommastelle**, erst nach Produktentscheidung verbindlich. Dieselbe Grenz-/Rundungsregel gilt in UI, Fachlogik, Cloud und MCP. Ein Icon bekommt eine stabile fachliche Kennung; ein Agent muss kein SVG erzeugen.

Ein breiter Slider setzt den Wert durch einen Klick/Tap auf die Skala. Dazu gehören eine ablesbare Zahl, direkte Zahleneingabe und Tastaturbedienung. Nicht darauf vertrauen, dass der native Browser-Slider auf allen Geräten einen Track-Tap identisch auswertet. Vorschau bleibt im Entwurf; Persistierung erfolgt für den akzeptierten Wert, nicht als ungeprüfte Folge jeder Pointerbewegung. Reale Touch-Hilfstechnologien gehören zur späteren Geräteprüfung. [WAI-Sliderhinweise](https://www.w3.org/WAI/ARIA/apg/patterns/slider/).

Manuelle Dringlichkeit und eine aus Fälligkeit abgeleitete **effektive Dringlichkeit** unterscheiden. Die Ableitung ist eine gemeinsame reine Funktion aus Aufgabe, aktivierter Regel und aktuellem Zeitpunkt. Sie schreibt nicht im Minutentakt neue Aufgabenzeilen und ersetzt keinen manuellen Wert. Vor Freigabe sind Aktivierung, Vorlaufkurve, überfällige Aufgaben, Zeitzone und die Behandlung einer manuell hohen Dringlichkeit nötig.

Die Matrix-Ausschlussregel braucht ein konkretes Beispielset: Eine Aufgabe mit drei Nullen und Punkt bleibt draußen. Aber was gilt für nur ein anderes Icon, nur Aufwand, oder einen Termin mit aktiviertem Dringlichkeitseinfluss? Entscheidend ist, ob gespeicherte oder effektive Werte die Zulassung bestimmen. Diese kleine Produktentscheidung ist vor der Matrix nötig; ein zusätzliches allgemeines „bewertet“-Feld ist nicht automatisch nötig.

### Prioritätswert und visuelle Hervorhebung

Die Formel jetzt nicht festschreiben. Sie braucht einen fachlichen Vergleich: Wie soll eine wichtige langfristige Aufgabe gegenüber einer dringenden unwichtigen Aufgabe stehen? Ein arithmetisches Mittel und eine Regel, die beide hohen Werte voraussetzt, treffen deutlich andere Entscheidungen. Das muss an echten Aufgaben beurteilt werden.

Verbindlicher Vertrag vor produktivem Ranking: Ergebnis 0–10; deterministisch und erklärbar; keine versteckten Einflüsse durch Aufwand oder Alter; steigende Wichtigkeit/Dringlichkeit senkt den Wert nicht; gleiche Formel und effektive Eingaben in Liste, Matrix und MCP. Null ist nicht automatisch ein negatives Urteil über eine bewusst unbewertete Aufgabe.

**Vorschlag für Hervorhebung:** Wenige Stufen, etwa ruhig/normal/hervorgehoben, aus derselben Prioritätsberechnung. Der Zahlenwert bleibt zugänglich. Stärkere Hervorhebung kann Schriftgewicht und eine klar bezeichnete Markierung verwenden; keine wechselnden Trefferflächen oder Zeilenhöhen. Exakte Schwellen und Gestaltung erst nach den Formelbeispielen festlegen. Eine zeitabhängige Neubewertung verschiebt Aufgaben nicht mitten in einer laufenden Bearbeitung oder Ziehbewegung.

### Prioritätsmatrix

Dringlichkeit und Wichtigkeit bleiben die Achsen. Aufwand steuert Icon-Größe; Alter seit `created_at` die Farbe. Null-Aufwand benötigt trotzdem eine sicht- und bedienbare Mindestgröße. Für Größenvergleiche ist eine begrenzte Flächenabbildung ein sinnvoller Ausgangspunkt, statt den Durchmesser ungeprüft linear zu vervielfachen. Altersfarben brauchen eine verständliche Legende und ein auch ohne Farbe zugängliches Alter.

Überlappende Aufgaben, viele identische Werte und Punkte an den Rändern sind Kernfälle. Ein großes Icon darf kleine Aufgaben nicht unzugänglich machen. Vergrößerung, Auswahl einer Gruppe oder eine begleitende Liste sind mögliche Lösungen; die genaue Interaktion folgt aus dem Prototyp. Falls Punkte optisch entzerrt werden, bleiben tatsächliche Werte erkennbar. Dieselben Daten sind über eine bedienbare Liste/Tabelle erreichbar. Die Matrix ist ein späterer Lieferumfang und keine Voraussetzung für einen brauchbaren neuen Aufgabeneditor.

## 8. MCP: unabhängiger Cloud-Zugriff mit gemeinsamer Fachlogik

**Vom Nutzer bestätigt:** Zunächst Zugriff auf den synchronisierten Cloud-Bestand. Nicht Bestandteil dieser Stufe sind noch ungesendete Offline-Änderungen eines Geräts.

Damit kann ein eigenständiger Server lesen und schreiben, während Prio geschlossen ist. Ein lokal vom Agenten gestarteter Prozess mit Cloud-Zugriff genügt dafür grundsätzlich; für Zugriff von mehreren Geräten bzw. bei ausgeschaltetem lokalen Rechner ist ein gehosteter Dienst zweckmäßiger. Das sind unterschiedliche Betriebsmodelle, die vor dem MCP-Bau zu wählen sind. Die aktuellen MCP-Standardtransporte sind stdio und Streamable HTTP. Die konkret eingesetzte Protokoll-/SDK-Version muss zu den vorgesehenen Clients passen. [MCP-Transporte](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports).

### Gemeinsame Funktionen statt zweiten Fachsystems

Der MCP-Transport übersetzt Parameter in konkrete fachliche Operationen. Die UI verwendet dieselben Regeln für Eingaben, Ableitungen und Zustandsübergänge. Der Server implementiert weder Kopien der UI-Handler noch einen simulierten Browser mit IndexedDB.

Erste nachweisbare Strecke: Aufgaben finden/lesen, eine Aufgabe mit Versionsprüfung ändern, Wiederholung der Änderung sicher behandeln, neuen Stand beim späteren Öffnen der App sehen. Danach vervollständigen:

- Listen und persönliche Listeneinstellungen; Besitzer-/Mitgliedsaktionen, Teilen und Verlassen.
- Aufgaben erstellen, ändern, abhaken, wieder öffnen, löschen/wiederherstellen, verschieben und umsortieren.
- Termine, Wiederholungen und gespeicherte Erinnerungsdefinitionen.
- Bewertungen und dieselben abgeleiteten Prioritäts-/Matrixdaten wie im UI.
- Checklisten und gegebenenfalls später Hierarchieoperationen.

Die Tools brauchen IDs, Filter, Suche und Seitennavigation, klar begrenzte Patches, Eingabe-/Ausgabeschemata und verständliche strukturierte Fehler. Ein freier SQL-Zugang oder unbeschränkter Tabellen-Replace ist kein komfortabler fachlicher Zugriff. MCP definiert Tool-Schemata und Metadaten; deren Hinweise ersetzen keine durchgesetzte Berechtigung. [MCP-Tools](https://modelcontextprotocol.io/specification/2026-07-28/server/tools).

„Alle fachlichen Funktionen“ umfasst gespeicherte Erinnerungsregeln. Eine Cloud-Änderung kann jedoch nicht allein einen neuen Android-Systemalarm auf einem geschlossenen, noch nicht synchronisierten Gerät planen. Dafür müsste die App die Änderung bekommen und ihre lokalen Alarme abgleichen. Die erreichbare Zustellungsgarantie ist ausdrücklich zu beschreiben; ein Hintergrunddienst ist nicht stillschweigend Bestandteil der bestätigten Cloud-Stufe. Installieren von App-Updates oder Erteilen von Systemrechten sind keine Cloud-Fachoperationen.

### Verlässliche Schreiboperationen: notwendige Grenzen

| Vertrag | Konkrete Anforderung | Abnahmefall |
| --- | --- | --- |
| Identität und Rechte | Server kennt den handelnden Benutzer und einen begrenzten Agentenzugriff. Lesen/Schreiben und gegebenenfalls Listenverwaltung trennen; Quell- und Zielliste prüfen. RLS bleibt verbindlich. | Mitglied kann Aufgaben ändern, aber keine fremde Liste umbenennen; Widerruf wirkt beim nächsten Zugriff; kein Fremdbestand wird gelesen. |
| Versionsschutz | Änderung nennt eine eindeutige erwartete Basis: bestätigter vollständiger Zeilenstand oder Serverrevision. Prüfung und Schreiben sind atomar. Client-`updated_at` bleibt davon unabhängig. Der begrenzte Zeilenaustausch in §12 verwendet den vollständigen Stand und braucht keine neue Revisionsspalte. | Mensch und Agent ändern denselben Stand: zweite widersprechende Änderung liefert Konflikt, kein stilles Überschreiben. Unterschiedliche Felder nur nach ausdrücklich definierter Zusammenführung. |
| Idempotenz | Schreibaufruf hat eine eindeutige Mutations-ID mit gespeicherter Ergebnisquittung. Gleiche ID/gleicher Inhalt gibt dasselbe Ergebnis; gleiche ID/anderer Inhalt ist ein Fehler. | Timeout nach Commit und erneuter Aufruf erzeugen keine doppelte Aufgabe, keinen zweiten Seriennachfolger und keinen doppelten Checklistenschritt. |
| Transaktionen | Zusammengehörige Cloud-Änderungen werden gemeinsam gespeichert, etwa Erledigen plus Seriennachfolger oder Verschieben plus strukturelle Änderungen. | Fehler in einem Teilschritt hinterlässt keinen halbfertigen fachlichen Zustand. Ein Tabellen-Upload allein ist keine Transaktion über den ganzen Ablauf. |
| Alle Schreiber | UI-Sync und MCP verwenden denselben geschützten Serverpfad. Alte unbedingte Upserts dürfen ihn nicht umgehen. | Ein älterer Offline-Client überschreibt den neuen Agentenstand nicht. Sein abgelehnter Upload und notwendiges Update bleiben verständlich und rückholbar. |
| Vollständiges Lesen | Geordnete Seitennavigation und definierte Statusfilter. | Bestand über dem API-Seitenlimit inklusive erledigter Aufgaben ist vollständig lesbar, ohne fremde Listen oder Duplikate zwischen Seiten. |
| Nachvollziehbarkeit | Antworten unterscheiden bestätigt, abgelehnt und Konflikt; eine knappe Änderungsherkunft hilft bei Agentenänderungen. | Nach unklarer Verbindung kann die Wirkung über die Mutations-ID festgestellt werden; kein blindes erneutes Schreiben. |

Für einen gehosteten HTTP-MCP-Server gehört ein passender Autorisierungsfluss dazu. Tokens müssen für diesen Server bestimmt sein; ein beliebiges vorhandenes Supabase-Token darf nicht ungeprüft als MCP-Token durchgereicht werden. Die Verbindung zur Benutzeridentität und den RLS-Rechten ist konkret zu entwerfen. Ein pauschaler `service_role`-Zugang für alle Agenten ist keine Abkürzung. [MCP-Autorisierung](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization).

Diese Anforderungen sind durch die beobachteten Schreibfehler begründet. **CRDTs, Event Sourcing, eine zweite lokale Datenbank oder ein allgemeines Berechtigungsframework sind dafür nicht erforderlich.** Fachprüfungen im gemeinsamen Code und verbindliche Datenbankbedingungen dürfen dieselbe Invariante sichern; deren Übereinstimmung wird geprüft. Nicht jeder PostgreSQL-Transaktionsschritt muss künstlich zu TypeScript werden.

Der Nutzer hat bestätigt, dass bisher nur er Prio verwendet. Der Wechsel zum geschützten Schreibweg kann deshalb seine Web- und Android-Fassungen gemeinsam aktualisieren; parallele Unterstützung alter Schreiber und eine Ankündigungsphase sind nicht nötig. Seine bestehenden und ausstehenden Daten bleiben beim Update erhalten. Der neue Schreibschutz bleibt auch bei einem späteren UI-Rückwechsel aktiv.

## 9. Schrittweiser Plan mit Grenzen und Abschlusskriterien

### Stufe 0 – aktuellen Stand belegen

**Erledigt:** Branch/Remote/Arbeitsstand geprüft; Basisprüfungen ausgeführt; tatsächliches Sieben-Tage-Verhalten, Schreibkonflikte und relevante UI-Probleme unabhängig nachgestellt. Dieses Dokument ist das Ergebnis. Offen bleibt die tatsächliche Cloud-/Android-Verifikation, die erst vor einer entsprechenden Lieferung nötig ist.

### Stufe 1 – kleinen Produktvertrag festhalten

**Umfang:** Zustände, Rechte, Gesamtansicht, Einstellungseigentümer, Reihenfolge/Wiederöffnen und Entwurfsverhalten entscheiden. Je Regel wenige konkrete Beispieldaten, einschließlich geteilter Liste, gleicher Titel und bearbeitetem Seriennachfolger. Die bestätigte MCP-Reichweite festhalten.

**Grenze:** Keine vollständige Spezifikation aller Zukunftsfeatures; keine endgültigen Farben, Komponentenbibliothek, Formel oder Baumstruktur.

**Abschluss:** Alle Regeln, die den ersten Daten-/Navigationsumbau betreffen, haben ein erwartetes Ergebnis und einen zugehörigen Prüffall. Spätere Entscheidungen besitzen einen benannten Zeitpunkt statt eines unbestimmten „irgendwann“.

**Abhängigkeit:** Stufe 0. Erste bedienbare Layoutentwürfe können parallel zur Klärung entstehen.

### Stufe 2 – Austauschbarkeit an einem realen Ablauf beweisen

**Umfang:** Den Mehrgeräte-Testaufbau tatsächlich isolieren; die beobachteten lokalen Schreibverluste und Upload-Quittungen absichern; „Aufgabe ändern“ als ersten gemeinsamen Fachablauf verwenden. Entwürfe an IDs/Basisstand binden und nur Änderungen schreiben. Rechte und Lade-/Fehlerzustände für diesen Ablauf korrigieren. Bereits weiterverwendete Dialogbausteine erhalten funktionierende Fokusführung.

**Grenze:** Keine Portierung sämtlicher Repositories, kein zusätzlicher Store, keine allgemeine Plugin-/Workflow-/Tree-Architektur. Andere alte UI-Probleme können direkt im neuen UI behoben werden, statt alle alten Screens vorher aufzupolieren.

**Abschluss:** Zwei parallele lokale Feldänderungen verlieren nichts; eine alte Upload-Quittung bestätigt keinen neuen Stand; ein Entwurf schreibt nach Listenwechsel weiterhin nur zur ursprünglichen Entität oder wird bewusst verlassen. Die gleiche Eingabevalidierung läuft ohne React/Browser und aus dem vorhandenen Formular. Der echte getrennte Gerätefall schlägt für das alte fehlerhafte Verhalten fehl.

**Abhängigkeit:** Stufe 1. Serverweiterungen aus Stufe 4 sind hier noch nicht vollständig erforderlich.

### Stufe 3 – neue Grundoberfläche früh entwickeln

**Umfang:** Start-Gesamtansicht mit ausdrücklich aktivierten Listen, Listenansicht, Aufgabenzeile, Erfassung/Bearbeitung, persönliche Aufnahme-Auswahl und die zunächst ausgeschaltete gemeinsame Listeneinstellung „Abgehakt am Listenende“. Die bestätigte Löschfrist für ausgeschaltetes „Abgehakt“ ist ein eigener Fachablauf in diesem Lieferumfang, keine bloße Umgestaltung des Wiederherstellen-Panels. Eine gemeinsame Informationsdarstellung mit passend angepasster Navigation für Telefon und breite Ansicht. Beginnen mit vorläufigen, lesbaren Tokens und den bestehenden brauchbaren Bausteinen; Erscheinungsbild an realen Ansichten entscheiden.

Ein vorübergehender Entwicklungsschalter oder eine Vorschau kann alt/neu umschalten. Beide benutzen **dieselbe** lokale Laufzeit und denselben Datenbestand. Bereits übernommene neue Bereiche werden zum normalen Weg; alte Wrapper verschwinden nach ihrer Abnahme.

**Grenze:** Keine zwei dauerhaften Designsysteme, keine zweite Sync-Engine; keine Matrix und keine Hierarchie als Bedingung für den ersten brauchbaren Editor. Neue Listenschalter werden erst aktiv, wenn die dazugehörige Fachfunktion vorhanden ist.

**Abschluss:** Anlegen, Bearbeiten, Abhaken, Wiederöffnen, Verschieben und erlaubte Listenaktionen funktionieren für Besitzer/Mitglied auf beiden Ansichten. Die Herkunft einer Gesamtansicht-Aufgabe ist klar; Erstellen hat eine sichtbare Zielliste. Kein Entwurfsverlust oder Fehlziel beim Wechsel. Bestandslisten und neue Listen sind anfangs nicht in der Gesamtansicht, bis der Nutzer sie ausdrücklich aktiviert. Beide „Abgehakt“-Modi, sieben Tage ab Abschluss beziehungsweise Umstellung, Ablauf bei geschlossener App und fehlende Wiederherstellbarkeit nach Ablauf sind geprüft. Ein alter Offline-Stand belebt Abgelaufenes nicht wieder. Hoch-/Querformat, Umschaltschwellen, lange Inhalte, 200 % Schrift, Tastatur, Offlinezustand und Fehler wurden geprüft. Die ersten Prioritätsfelder dürfen danach ergänzt werden.

**Abhängigkeit:** Stufen 1–2. Ein Prototyp braucht noch keinen vollständigen produktiven MCP-Server. Vor einer produktiven Lieferung muss der bekannte Cloud-Schreibfehler entweder behoben oder als konkrete Einschränkung ausdrücklich akzeptiert sein; Standardempfehlung ist beheben.

### Stufe 4 – geschützten Cloud-Schreibweg und ersten MCP-Ablauf liefern

**Umfang:** Echte Cloud-RLS/Schema prüfen; paginierte Reads, Versionsprüfung, Idempotenz, Transaktionen und Isolation abgelehnter Zeilen implementieren. Eine kleine MCP-Strecke mit Lesen und Ändern im unabhängigen Prozess betreiben. UI-Sync an denselben geschützten Schreibweg anschließen. Betriebsmodell und Benutzerautorisierung anhand der tatsächlich vorgesehenen Agenten festlegen.

**Grenze:** Kein Zugriff auf ungesendete Gerätedaten; keine Pflicht zu einem permanenten lokalen Dienst. Nicht jede fachliche Operation muss fertig sein, bevor die erste Strecke geprüft wird. Kein universeller SQL-MCP-Server.

**Abschluss:** Bei geschlossener Prio-App liest und ändert MCP eine Testaufgabe; nach dem Öffnen erscheint sie korrekt. Zwei unabhängige Clients und ein Agent erzeugen einen erklärten Konflikt statt stiller Verluste. Retry nach Commit verdoppelt nichts. Eine ungültige Zeile hält gültige nicht zurück. Widerruf, fremde Liste, alter Offline-Schreiber, Seitenlimit und Transaktionsabbruch sind gegen die echte Testdatenbank geprüft.

**Abhängigkeit:** Stufen 1–2; unabhängig vom Abschluss des optischen Umbaus in Stufe 3. Schreibendes MCP erst nach dieser Abnahme freigeben, vollständige Fachabdeckung weiter vervollständigen.

### Stufe 5 – Bewertungen, Listenschalter und Checklisten hinzufügen

**Umfang:** Je Feature Datenvertrag, Normalisierung/Feldkatalog, lokale Speicherung, Cloud-Migration, Fachoperation, UI und MCP gemeinsam ergänzen. Dezimalwerte und Punkt-Standard einführen; Prioritätsnutzung und Namensregel aktivieren; einfache Checklisten umsetzen. Prioritätsformel und gegebenenfalls Terminbezug vor produktivem Ranking entscheiden, dann nachvollziehbare Hervorhebung ergänzen.

**Grenze:** Kein gleichzeitiger Hierarchieumbau; kein automatisches Auffüllen von Bewertungen alter Aufgaben. Keine nur im UI wirksamen Validierungsregeln.

**Abschluss:** Alte Zeilen ohne Felder normalisieren auf gültige Defaults; Aufgabe mit Standardwerten bleibt ruhig und gemäß Vertrag außerhalb der Matrixdaten. Slider-Klick/Tap, Zahleneingabe und Tastatur ergeben gleiche Werte. Ausgeschaltete Prioritäten löschen keine Daten. Doppelte Erstellung und gleichzeitige Checklistenschritte werden gemäß Vertrag behandelt. Alle neuen Fachaktionen sind über UI und MCP erreichbar und gegen Bestandsdaten geprüft.

**Abhängigkeit:** Neue Grundoberfläche für die Darstellung; geschützter Schreibweg für die Freigabe gemeinsamer/MCP-Schreibfunktionen. Einzelne Features können getrennt abgeschlossen werden.

### Stufe 6a – Matrix als eigener Lieferumfang

**Umfang:** Achsen, Aufwand-Größe, Altersfarbe, Legende, Auswahl überlappender Aufgaben und gleichwertiger Listenweg. Gemeinsame Bewertungsfunktionen aus Stufe 5 verwenden.

**Grenze:** Keine zweite Prioritätsberechnung; keine zusätzliche Persistierung zeitabhängiger Punktpositionen. Kein Hierarchieentscheid erforderlich.

**Abschluss:** Standardwerte ausgeschlossen; Null-Aufwand bedienbar; viele Aufgaben am selben Punkt auswählbar; Randwerte und ein repräsentativ großer Bestand geprüft; Datum/Alter und Prioritätswert in Liste, Matrix und MCP stimmen zum selben Prüfzeitpunkt überein. Touch-/Tastaturweg und Darstellung ohne Farbinformation funktionieren.

**Abhängigkeit:** Bewertungs- und Zulassungsvertrag aus Stufe 5.

### Stufe 6b – Hierarchie nur nach ausdrücklicher Produktentscheidung

**Umfang:** Erst Vergleichsprototyp, dann die gewählte Hierarchieregel einschließlich Wiederöffnen und gegebenenfalls Bereichsmigration umsetzen.

**Grenze:** Nicht mit Checklisten gleichsetzen und nicht im Grundgerüst vorwegnehmen. Falls die Entscheidung gegen Hierarchie fällt, entfällt diese Stufe ohne Umbau anderer Features.

**Abschluss:** Zyklen und unzulässige Zuordnungen abgewiesen; Wiederöffnen eines Kindes vor dem Elternteil erhält die fachliche Beziehung, Position und Gruppe nach festgelegten Rückfällen; spätere Zuordnung funktioniert. Explizites Umhängen, fehlende Eltern, Verschieben, Serien und gleichzeitige Änderungen sind geprüft. Bestehende Bereiche/Daten haben eine nachvollziehbare Migration oder bleiben erhalten.

**Abhängigkeit:** Eigenständiger Produktvertrag, geschützter Schreibweg, brauchbarer neuer Editor. Keine Voraussetzung für Stufe 6a.

### Stufe 7 – umstellen, Altbestand entfernen, ausliefern

**Umfang:** Vollständiges fachliches Aktionsinventar gegen beide UI-Ansichten und MCP prüfen. Temporäre Umschalter, überholte Komponenten und unbenutzte Adapter entfernen. DESIGN.md anhand der zehn tatsächlich übernommenen Regeln kürzen/neu schreiben; Historie nicht als aktuelle Spezifikation stehen lassen. Widersprechende README-/Arbeitsregel-Aussagen zum aktuellen Verhalten angleichen.

**Abschluss:**

- Jede freigegebene Fachoperation hat UI- und MCP-Abdeckung sowie klare Rechte; Gerätefunktionen sind als solche abgegrenzt.
- Kein ungeschützter alter Cloud-Schreibweg umgeht Versionen; offline wartende Änderungen sind bei einem Update nachvollziehbar behandelbar.
- Migrationen im bestehenden Prio-Verfahren gebündelt, wiederholbar eingespielt und tatsächlich geprüft; alter lokaler Bestand und fehlende Felder getestet. Keine destruktive Migration nur zur Entfernung alten Markups.
- `npm run ci` und alle E2E-Projekte einschließlich PWA bestehen. Neue Regressionen sind enthalten, nicht nur die ursprünglichen 81 Fälle.
- Screenshots der neuen Oberfläche wurden in Telefon-Hoch-/Querformat angesehen; der tatsächliche App-Code wurde vor einem Tag im Emulator geprüft. Reale Tastatur, native Hilfstechnologien und Benachrichtigungen auf dem Gerät prüfen, soweit sie betroffen sind.
- Eine zusammenhängende Lieferung mit passender Version, Tagtext und Release; vor Veröffentlichungen berücksichtigen, dass ein Push auf `main` auch die Webproduktion verändert. Der Rückweg ist für UI und Daten-/Schreibprotokoll getrennt beschrieben.

**Abhängigkeit:** Nur die tatsächlich zur Lieferung gehörenden Stufen; eine offene Hierarchie verhindert nicht die Veröffentlichung des restlichen Overhauls. Auch die Matrix kann gesondert folgen. Der Gesamt-MCP-Auftrag ist erst abgeschlossen, wenn alle freigegebenen fachlichen Funktionen abgedeckt sind.

## 10. Schutz vor einer Vorbereitung, die selbst zur Altlast wird

Eine Vorarbeit wird nur aufgenommen, wenn sie einen gemessenen Fehler behebt, eine unmittelbar benötigte Austauschgrenze schafft oder eine vereinbarte Cloud-Schreibgarantie ermöglicht. Ihr Abschluss muss sich an einem funktionierenden Ablauf zeigen.

- **Nach Stufe 2 beginnt der tatsächliche UI-Umbau.** Nicht erst sämtliche Repositories, alle Zukunftsfelder oder alle MCP-Tools fertigstellen.
- **Abstraktionen entstehen aus konkreten Nutzern:** gemeinsamer Aufgabenbefehl für UI und Cloud, gemeinsames Bewertungsmodell für Liste/Matrix/MCP. Keine universellen Nodes, generischen Regeln oder dynamischen Renderersysteme.
- **Ein Feature wird durchgängig abgeschlossen:** Daten, Rechte, Fehler, UI und gegebenenfalls MCP. Kein Stapel vorbereiteter Schalter ohne Verhalten.
- **Optische Entscheidungen werden an wenigen repräsentativen Ansichten getroffen:** lange/kurze Aufgaben, unbewertet/hoch bewertet, eigene/geteilte Liste, erledigt, leer, offline und Konflikt. Kein umfassender Designkatalog als Vorbedingung.
- **Tests sichern fachliche Ergebnisse und Bedienwege.** Quelltextkonventionen bleiben Hilfsmittel; starre DOM-/Pixeltests sollen den Austausch der Oberfläche nicht verhindern.
- **Temporäre Brücken bekommen einen Entfernungspunkt.** Ein alter Screen bleibt nur bis zum abgenommenen Ersatz; ein Entwicklungsschalter nur bis zur Umstellung.

Der sinnvolle nächste Implementierungsauftrag wäre daher: **den kleinen Produktvertrag entscheiden, die nachgewiesenen Schreib-/Testprobleme gezielt absichern und eine erste neue Gesamtansicht mit Aufgabeneditor als zusammenhängenden Ablauf bauen.** Die endgültige Ästhetik wird an diesem Ablauf entwickelt. Weitere Features folgen auf der neuen Oberfläche, sobald ihre jeweiligen Fachregeln entschieden sind.

## 11. Beauftragtes Grundlagenpaket – Umsetzung

Der Folgeauftrag „leg los. wirklich.“ beauftragt das zuvor abgegrenzte Paket:
getrennte Mehrgeräte-Tests, verlässliche lokale Aufgabenänderungen und
Upload-Bestätigungen, gemeinsame Aufgabenbearbeitung und Entwürfe je
Liste/Aufgabe. Die Umsetzung liegt lokal auf `feature/ui-foundation`, ausgehend
vom oben dokumentierten aktuellen `main`. Dieses Paket ist ein Teil der
Vorarbeiten; es behauptet keinen Abschluss des gesamten Overhauls oder aller
weiteren Punkte aus Stufe 2.

### Umgesetzt

- **Unabhängige Testgeräte:** Jeder Geräte-Harness öffnet einen eigenen
  IndexedDB-Bestand, auch für dasselbe Konto. Ein zusätzlicher Prüffall verlangt,
  dass die zweite Datenbank vor dem ersten Abgleich weder Liste noch Aufgabe
  enthält. Das Produktions-Caching bleibt bestehen.
- **Atomare lokale Aufgabenoperationen:** Erstellen, Bearbeiten, Abhaken/
  Wiederöffnen, Verschieben, Umsortieren, Löschen und Wiederherstellen lesen und
  schreiben ihren Bestand in einer Transaktion. Parallele Feldänderungen und
  paralleles Erstellen verlieren damit weder Inhalt noch Reihenfolge. Ein
  wiederholter Abschluss verändert den Abschlusszeitpunkt nicht erneut.
  Reihenfolge beim späteren Wiederöffnen und der Umgang mit bearbeiteten
  Seriennachfolgern folgen weiterhin dem alten Verhalten; deren neue fachliche
  Regeln sind eigene Arbeit.
- **Verlässliche Upload-Bestätigung:** `markPushed` vergleicht den vollständigen
  synchronisierten Inhalt atomar mit dem tatsächlich gesendeten Stand. Auch
  bei identischen Zeitstempeln bleibt ein neuerer Inhalt als noch ausstehend
  markiert. Das ist eine interne Prüfung der automatischen Serverantwort,
  keine zusätzliche Rückfrage an den Benutzer. Dafür sind keine neue Spalte
  und keine Migration nötig.
- **Gemeinsame Aufgabenbearbeitung:** `src/domain/taskEdit.ts` enthält die reine,
  browserunabhängige Prüfung und Konfliktregel. Die bestehenden Formulare
  schicken nur geänderte Felder. Der lokale Adapter prüft diese gegen die
  Entwurfsbasis innerhalb seiner Transaktion. Andere zwischenzeitlich geänderte
  Felder bleiben bestehen; dieselben Felder und die gekoppelte Gruppe aus
  Termin/Wiederholung/Erinnerungen liefern einen ausdrücklichen Konflikt.
  Geänderte Aufgaben-/Listenidentität wird ebenfalls geprüft. Ein unverändertes
  Formular erzeugt keine neue schmutzige Zeile.
- **Entwürfe und Lesestand:** Neue Aufgabenentwürfe gehören zu einer Liste,
  Bearbeitungsentwürfe zu einer Aufgaben-ID, begonnene Listennamen zur jeweiligen
  Listen-ID. Der Entwurfszustand liegt über der Umschaltung zwischen Telefon und
  breiter Ansicht; gespeicherte Daten kommen weiterhin aus den Datenbank-Hooks.
  Die mobile Bearbeitung und Verschiebeauswahl halten IDs statt eingefrorener
  Aufgabenkopien. Fehlende Aufgabe, erstes Laden und Lesefehler sind im mobilen
  Editor unterscheidbar; ein Lesefehler bietet einen erneuten Versuch.
- **Erklärtes Ende und Schreibfehler:** Mobile Entwürfe lassen sich beim
  Schließen behalten, verwerfen oder weiterbearbeiten. Explizites Abbrechen im
  breiten Editor verwirft. Speichern beendet den jeweiligen Entwurf; Fehler
  bewahren ihn. Eine echte konkurrierende Feldänderung zeigt einen Hinweis;
  das ausdrücklich beschriftete Neuladen ersetzt die eigene Eingabe. Doppelte
  Submit-Ereignisse sind auch vor dem nächsten Render gesperrt, Eingaben beim
  Speichern geschützt, und ein verspäteter Abschluss schließt keinen anderen
  Editor. Entwürfe gelten für die Sitzung und enden bei Abmelden/Neustart.

Die Regressionen wurden vor den Korrekturen nachgestellt: Der neue Prüfblock
hatte sieben Fehlschläge. Der korrigierte Stand besteht die fachlichen und
Bedienprüfungen. Die Abnahme umfasst `npm run ci`, sämtliche E2E-Projekte
inklusive PWA sowie angesehene Telefonbilder in Hoch- und Querformat. Die
Prüfungen arbeiten mit kontrollierten Testdaten; sie schreiben nicht in die
Produktionscloud.

### Grenzen dieses ersten Pakets und nächster Schritt

Keine neuen persistierten Felder, Bibliotheken, Migrationen, Veröffentlichungen
oder endgültigen Gestaltungsentscheidungen. Die Cloud-Uploads bleiben
unbedingte ganze Zeilen; serverseitiger Versionsschutz, zuverlässige MCP-
Schreiboperationen und Quarantäne-Isolation folgen in Stufe 4. Die lokale
Feldprüfung ist dafür eine verwendbare Fachgrenze, ersetzt diese Garantien
aber nicht. Listenmutationen haben noch nicht denselben Feldkonfliktvertrag
wie die Aufgabenbearbeitung. Andere dokumentierte UI-Befunde, etwa
Desktop-Mitgliedsaktionen, Dialogfokus und der breite Web-Querformatüberlauf,
sind mit diesem begrenzten Paket nicht erledigt.

Der nächste Lieferumfang ist die neue Gesamt-/Listenansicht mit Aufgabeneditor
und „Abgehakt“. Vor ihrem Datenumbau werden die noch offenen Regeln aus Stufe 1
konkret entschieden: Erstellungsziel und Anfangssortierung der Gesamtansicht,
Defaults der Listenschalter, genauer Rückfall beim Wiederöffnen und Schutz
bearbeiteter Seriennachfolger. Endgültige Farben, Matrix und Hierarchie müssen
den Start der neuen Grundoberfläche nicht aufhalten. Vor produktiver
Veröffentlichung bleibt der bekannte Cloud-Schreibfehler ein eigenes Tor.
Der darauf folgende Stand zum Cloud-Schreibweg ist in §12 dokumentiert.

## 12. Fortsetzung: geschützte Cloud-Schreiboperationen

Der Folgeauftrag „also mach weiter“ setzt die begrenzte Grundlagenarbeit fort.
Vor Beginn wurde `origin` erneut abgerufen: `feature/ui-foundation` basiert
weiter auf `6bd4544`; `main` und `origin/main` stehen unverändert dort. Das
erste Paket wurde als lokaler Arbeitsstand erhalten. Dieser Schritt behebt die
nachgewiesene Cloud-Schreiblücke vor einer produktiven UI-Lieferung; er ist
noch kein vollständiger Abschluss von Stufe 4.

### Verhalten und Umfang

- **Atomare Basisprüfung:** `sync_push` akzeptiert den vollständigen zuletzt
  bestätigten Serverstand als Erwartung. Prüfung und Schreiben halten Zeilen-
  und erforderliche Berechtigungssperren; für noch nicht vorhandene Kennungen
  gibt es ebenfalls eine Sperre. Ein älterer Upload und eine falsche Geräteuhr
  können einen inzwischen geänderten Stand nicht still überschreiben. Ein
  exakt identischer Wiederholungsversuch bestätigt denselben Inhalt.
- **Alle App-Schreibwege:** Direkte Tabellen-Schreibrechte sind entzogen.
  Listenbesitzer, Mitgliedschaft/Verlassen und Quell-/Zielrechte für Aufgaben
  werden im Serverbefehl geprüft. Lesen bleibt RLS-geschützt; der bestehende
  Teilen-Befehl bleibt erreichbar. Die bereits geschützte Datenbank bleibt
  auch während einer Wiederholung alter Migrationsdateien geschützt.
- **Automatische Zusammenführung:** Eine reine, browserunabhängige Funktion
  vergleicht Basis, lokale Fassung und Cloudfassung. Verschiedene unabhängige
  Felder werden automatisch verbunden. Termin/Wiederholung/Erinnerungen/
  Abschluss/Seriennachfolger sowie Liste/Bereich/Reihenfolge bilden jeweils
  gekoppelte Gruppen. Löschen gegen Bearbeiten betrifft den gesamten Inhalt.
  Eine einzelne erneute Übertragung nach automatischem Zusammenführen genügt;
  weitere Konkurrenz wird beim nächsten normalen Lauf behandelt.
- **Erklärte Konflikte:** Eingaben bleiben lokal erhalten. Die Übersicht wird
  vom Benutzer geöffnet, ist auf beiden Ansichten erreichbar und bleibt beim
  Breitenwechsel offen. Sie zeigt beide Fassungen und betroffene Angaben.
  Lokale Wahl bewahrt eigene geänderte Felder/Gruppen und unabhängige Cloud-
  Angaben; Cloudwahl ersetzt die eigene Änderung. Eine veraltete Auswahl ist
  nicht anwendbar. Der gemeinsame Dialog hält jetzt auch den ersten Shift+Tab
  vom Rahmen sowie Tab ohne erreichbaren Knopf innerhalb seiner Fläche.
- **Update und Fehlversuche:** Alte schmutzige Daten ohne bestätigte Basis
  werden nicht blind neu basiert. Unterschiede brauchen eine bewusste Wahl.
  Alte Quarantänevermerke ohne gesicherten Inhalt blockieren das neue Protokoll
  nicht dauerhaft. Ein dauerhaft abgelehnter Inhalt wird vollständig gesichert;
  gültige Zeilen laufen weiter. Vorübergehende Fehler bleiben versuchbar.
  Zähler beziehen sich auf tatsächlich noch blockierte Eingaben. Nach
  Rechteentzug wird kein unlösbarer Konflikt angeboten; seine eigene Fassung
  bleibt für einen späteren Wiederaufnahmeweg gesichert.
- **Keine zusätzliche Datenarchitektur:** Basis und Konflikte liegen in der
  vorhandenen lokalen `meta`-Tabelle. Lokale Zeile und Basis werden gemeinsam
  gelesen. Die genaue bestätigte Serverfassung einschließlich Mikrosekunden
  bleibt erhalten, während UI und normale lokale Felder normalisiert bleiben.
  Der alte reine LWW-Code und seine überholten Tests wurden durch die neue
  Regel ersetzt. Der vollständige Pull ist geordnet und paginiert; eine
  kleinere Projekt-Seitengrenze beendet ihn nicht vorzeitig.

### Abnahme

Die ursprünglichen veralteten Schreibfälle und zusätzliche Update-Regressionen
wurden vor ihren Korrekturen nachgestellt. Die lokale Abnahme verlangt:

1. `npm run ci`: Typecheck, Lint, Skriptprüfung, fachliche Tests und Build.
2. Sämtliche E2E-Projekte einschließlich PWA; Konfliktwahl für Telefon und
   breite Ansicht, Fokus und Wechsel der Breite; Telefonbilder in Hoch- und
   Querformat tatsächlich ansehen.
3. `npm run db:test` gegen eine isolierte echte PostgreSQL-Datenbank:
   **16 Prüfungen** für gespeicherten Inhalt, veraltete/gleichzeitige Writes,
   falsche Uhr, Retry, Zeilenisolation, fremde Daten, Quell-/Zielzugriff,
   nicht angemeldete Aufrufe, Mitgliedsrechte, Verlassen, unveränderliche
   Erstellung, Teilen, direkte Umgehungen, wiederholte Migrationen und
   paralleles Anlegen. `db:check` prüft den geschützten lokalen Stand zusätzlich
   rein lesend. Die CI bekommt hierfür einen eigenen PostgreSQL-Dienst.

**Abschlussstand:** `npm run ci` ist grün mit **502 Tests in 59 Dateien**
und Produktionsbuild; **alle 89 E2E-Fälle** einschließlich PWA sind grün.
Die **16 PostgreSQL-Prüfungen** und der rein lesende `db:check` bestehen in
einer wegwerfbaren lokalen Datenbank. Vier ungeeignete Verbindungsangaben
wurden zusätzlich vor jedem Datenbankaufruf abgewiesen. Die Konfliktübersicht
wurde in Telefon-Hochformat und Querformat angesehen, einschließlich der
durch Scrollen erreichbaren Aktionen. Der Remote-Stand wurde am Ende erneut
abgerufen und bleibt unverändert zum Ausgangscommit.

### Liefergrenze und verbleibende Arbeit

**Lokal vorbereitet, nicht in der Produktionscloud aktiviert.** Eine echte
Cloud-Verbindung ist hier nicht konfiguriert. Da bisher nur der Nutzer Prio
verwendet, genügt die gemeinsame Umstellung seiner App-Fassungen und der
Migration `0014`. Eine Ankündigungsphase und weitere Unterstützung alter
Schreiber sind nicht erforderlich. Ausstehende Daten bleiben erhalten; der
neue Client braucht den RPC und fällt vorher nicht auf ungeschützte Upserts
zurück. Der Ablauf steht in `supabase/README.md`. Es wurden keine Nutzer-
daten in der Cloud verändert, keine App-Version erhöht und nichts veröffentlicht.

Der geschützte Batch ist **je Zeile atomar**, nicht Alles-oder-nichts über
mehrere Fachänderungen. Abschluss plus Seriennachfolger, strukturelles
Verschieben und spätere Checklisten-/Hierarchieaktionen brauchen eigene
gemeinsame Cloud-Fachbefehle. Für MCP fehlen weiterhin Betrieb bei
geschlossener App, Benutzer-/Agentenautorisierung, Tool-Schemata, vollständige
Fachabdeckung und gespeicherte Mutationsquittungen. Die Servervalidierung
schützt hier Zeilenform, vorhandene Datenbankbedingungen und Berechtigungen;
sie ersetzt noch nicht sämtliche gemeinsamen Fachregeln. Paginierter Vollpull
ist kein Transaktionssnapshot über mehrere gleichzeitige Leseanfragen. Der
komfortable Export-/Wiederaufnahmeweg für gesicherte abgelehnte Eingaben bei
entzogenen Rechten bleibt ebenfalls offen.

Das nächste UI-Paket bleibt die neue Gesamt-/Listenansicht mit Editor und
„Abgehakt“, nach den kleinen offenen Produktregeln aus §11. Weitere allgemeine
Vorbereitung ist dafür nicht erforderlich. Vor Veröffentlichung gehört die
koordinierte Cloud-Umschaltung dazu; der komplette MCP-Server, Matrix und
Hierarchie müssen den Beginn des neuen UI nicht aufhalten.

## 13. Erneuter Anforderungsabgleich nach der Korrektur

Der Nutzer hat darauf hingewiesen, dass „Abgehakt“ eine Listeneinstellung und
kein neuer Default ist. Anschließend wurden alle Features erneut gegen den
ursprünglichen Auftrag und die ausdrücklich beantworteten Rückfragen geprüft.
Die Freigabe, weiterzuarbeiten, bestätigt keine danebenstehenden Produktvorschläge.

### Zwei voreilig angenommene Defaults zurückgenommen

1. **„Abgehakt“ für jede Liste:** Falsch. Der zunächst ausgeschaltete Schalter
   bestimmt, welche Listen den dauerhaften Bereich bekommen. Er ersetzt den
   bisherigen Wiederherstellen-Ablauf nur für die dafür aktivierten Listen.
2. **Alle Listen automatisch in der Gesamtansicht:** Nicht beauftragt.
   Bestätigt ist jetzt der umgekehrte Default: bestehende und neue Listen sind
   zunächst ausgeschlossen und werden ausdrücklich persönlich aktiviert.

Die dazu begonnenen, noch nicht angeschlossenen Typen und Helfer wurden
zurückgenommen. Insbesondere gibt es keinen neuen „alle Listen außer …“-Default
im Datenmodell, keine angeschlossene Rückkehrlogik und kein aktiviertes neues
UI-Verhalten. Die bereits geprüften Grundlagen aus §11–12 bleiben erhalten.
Es wurden keine Produktionsdaten, Migrationen oder Veröffentlichungen ausgeführt.

### Vollständiger Abgleich der geplanten Features

| Feature | Verbindliche Vorgabe / bestätigte Ergänzung | Noch nicht entschieden; vor Umsetzung klären |
| --- | --- | --- |
| Gesamtansicht | Beim Start geöffnet; Aufgaben aus dafür aktivierten Listen. Aufnahme persönlich und synchronisiert, für bestehende und neue Listen zunächst aus. Beide Modi: nach Ursprungsliste gruppiert oder gemeinsam neueste zuerst. Gruppierung nur als erste Voreinstellung; gewählte Ansicht persönlich speichern, wiederverwenden und synchronisieren. Erstellungsziel ausdrücklich wählen bis zur manuell gesetzten, persönlich synchronisierten Standardliste. Alle zugänglichen Ziellisten erlaubt, bei ausgeschlossenen Listen mit Hinweis. | Prioritätssortierung erst nach Festlegung der Formel; eine globale manuelle Reihenfolge ist eigener Umfang. |
| Prioritäten je Liste | Nutzung ist einstellbar, gemeinsam für die Liste, vom Besitzer bestimmt. Bewertung bleibt optional. | Default des Schalters; welche Bewertungs-, Anzeige- und Sortiermöglichkeiten bei ausgeschalteter Nutzung bleiben. Der Erhalt gespeicherter Bewertungen ist ein Vorschlag, kein bestätigtes Verhalten. |
| „Abgehakt“ | Listeneinstellung, gemeinsam vom Besitzer bestimmt, zunächst aus. An: dauerhafter, zunächst eingeklappter Bereich am Listenende mit Anzahl; ausschließlich dort erreichbar. Aus: automatische Löschung nach sieben Tagen ohne weitere Wiederherstellungsfrist. Bei Einführung/Abschalten erhalten bereits erledigte Aufgaben sieben Tage ab Umstellung. Beim Verschieben erledigter Aufgaben gilt die Zielregel, gegebenenfalls mit sieben Tagen ab Verschieben. Abhakzeitpunkt bleibt erhalten. | Produktionsumstellung und Prüfung des tatsächlich eingespielten Jobs stehen noch aus; lokal geprüfter Ausführungsweg in §15. |
| Gleiche Aufgabennamen | Erlaubnis ist einstellbar, gemeinsam für die Liste, vom Besitzer bestimmt. Der heutige Code erlaubt sie bereits. | Schalterdefault, Titelvergleich, betroffene Aufgabenstatus, Aktivierung bei vorhandenen Doppelungen, Wiederöffnen/Verschieben/Serien bei Namenskonflikt. Der vorgeschlagene Vergleich nur offener Aufgaben ist nicht bestätigt. |
| Einfache Checklisten | Schritte innerhalb einer Aufgabe. Als eigenes geplantes Feature erhalten. | Verhalten der Hauptaufgabe beim letzten abgehakten Schritt; genaue Schrittaktionen. Eigene Prioritäten/Termine und die Gleichsetzung mit echten Kindaufgaben sind nicht beauftragt. |
| Eltern-Kind-Aufgaben / Bereiche | Optional und offen; möglicherweise anstelle der heutigen Bereiche. Falls eingeführt: ursprüngliche Gruppe und Elternreferenz beim Wiederöffnen erhalten; zuerst geöffnetes Kind vorübergehend als Wurzel darstellen und später zuordnen können. | Ob das Feature kommt; Bereiche ersetzen oder ergänzen; automatische/manuelle Wiederzuordnung; Tiefe, Abschluss/Löschen/Verschieben und Serien. Keine Vorfestlegung auf ein Baum-Datenmodell. |
| Wiederöffnen / Reihenfolge | Rückkehr zur ursprünglichen Gruppe: nach gültigem offenen Vorgänger, sonst vor gültigem offenen Nachfolger, sonst Gruppenende. Bei entfernter Gruppe ungruppiert. Vorgänger hat auch bei vertauschten Nachbarn Vorrang; Nachbarn nicht in andere Gruppen/Listen verfolgen. Bearbeitete oder verschobene Seriennachfolger bleiben erhalten; nachweislich unveränderte offene Nachfolger werden zurückgenommen. | Ausdrücklich geänderter Ort als neuer Rückkehrort; Details einer eventuellen Elternzuordnung. |
| Aufgabenwerte / Icon | Erstellzeitpunkt, Aufwand, Wichtigkeit, Dringlichkeit und Icon. Drei Zahlenwerte von 0 bis 10 mit Nachkommastellen, jeweils Default 0; Icon-Default Punkt. | Dezimalpräzision und Auswahl der Icons. Eine Nachkommastelle wurde nur vorgeschlagen; keine Begrenzung auf ganze Zahlen oder stilles Bewerten vorhandener Aufgaben. |
| Slider / Fälligkeitseinfluss | Breite Slider setzen per einzelnem Klick/Tap einen Wert. Fälligkeitsdatum kann Dringlichkeit optional beeinflussen. | Aktivierung und genaue Ableitung, Verhältnis zur manuellen Dringlichkeit, überfällige Aufgaben und Zeitzone. Keine automatische Aktivierung des Fälligkeitseinflusses. |
| Matrix-Zulassung | Aufgaben mit Aufwand = Wichtigkeit = Dringlichkeit = 0 und Punkt-Icon sind ausgeschlossen. Das macht Bewertungen optional. | Zulassung bei ausschließlich anderem Icon, ausschließlich Aufwand oder nur datumsgesteuerter Dringlichkeit. Die Ausschlussvorgabe wird nicht still durch ein weiteres Pflichtfeld „bewertet“ ersetzt. |
| Matrix-Darstellung | Achsen: Dringlichkeit und Wichtigkeit. Icon-Größe: Aufwand. Farbe: Alter seit Erstellung. | Größenabbildung, Altersfarben/Legende, Überschneidungen und Interaktion. Priorität oder Dringlichkeit ersetzen nicht die angeforderte Altersfarbe. |
| Eindimensionale Priorität | Aus Wichtigkeit und Dringlichkeit berechnet, Wertebereich 0–10. Formel ausdrücklich offen. | Formel anhand konkreter Aufgaben; Einbeziehung der optional effektiven Dringlichkeit. Keine zusätzliche Abhängigkeit von Aufwand oder Alter als stilles Ranking-Kriterium. |
| Visuelle Hervorhebung | Abhängig von Priorität, nach konsistenten und verständlichen Regeln. | Stufen, Schwellen und Darstellung nach Entscheidung der Formel. Drei Hervorhebungsstufen sind ein Vorschlag und keine bestätigte Vorgabe. |
| MCP | Komfortabler Lese- und Schreibzugriff auf alle fachlichen Funktionen; funktioniert bei geschlossener Prio-App. Zunächst synchronisierter Cloud-Bestand, ausdrücklich bestätigt. | Betrieb/Transport, Benutzer- und Agentenzugriff, vollständige Fachbefehle und Transaktions-/Wiederholungsverträge. Ein nur lesender Server, eine Bindung an die offene UI oder nur ein Zugriff auf drei Rohdatentabellen erfüllt den Gesamtauftrag nicht. |

Die vier Listenschalter bleiben vier fachlich unterschiedliche Entscheidungen.
Die persönliche Aufnahme gehört nicht auf eine gemeinsam geänderte Listenzeile.
Die drei anderen Regeln gelten gemäß Antwort für alle Teilnehmer der Liste;
auch MCP-Schreiboperationen müssen sie einhalten. Eine derzeit fehlende Funktion
wird im UI erst dann als benutzbarer Schalter angeboten, wenn ihr Verhalten
tatsächlich vorhanden ist.

### Prüffälle der neu bestätigten Aufbewahrung

- Eine Liste beginnt mit ausgeschaltetem „Abgehakt“; ihre Aufnahme in die
  Gesamtansicht ist ebenfalls zunächst aus. Ein Mitglied kann die persönliche
  Aufnahme ändern, aber nicht die gemeinsamen Listenregeln.
- Bei eingeschaltetem „Abgehakt“ bleibt eine erledigte Aufgabe auch nach mehr
  als sieben Tagen am Listenende erreichbar.
- Bei ausgeschaltetem „Abgehakt“ kann eine frisch erledigte Aufgabe vor Ablauf
  der sieben Tage wieder geöffnet werden. Nach Ablauf gibt es weder eine
  offene Aufgabe noch eine weitere Wiederherstellungsfrist oder eine
  Wiederherstellung über MCP.
- Bei Einführung der Löschfunktion bleibt eine vor Monaten erledigte Aufgabe
  zunächst im Wiederherstellen-Ablauf erreichbar und bekommt sieben Tage ab
  der Umstellung. Dasselbe gilt
  beim Abschalten von „Abgehakt“. Ihr ursprünglicher Abschlusszeitpunkt wird
  nicht auf das Umstellungsdatum umgeschrieben.
- Die Löschfrist wird auch mit geschlossener App durchgesetzt. Ein verspäteter
  Offline-Upload kann eine abgelaufene Aufgabe nicht wiederbeleben.
- Erneutes Aktivieren der Aufbewahrung vor Fristablauf schützt die noch
  vorhandenen erledigten Aufgaben; bereits endgültig abgelaufene Aufgaben
  werden nicht durch einen Einstellungswechsel neu erstellt.

Erstellungsziel, beide Darstellungsmodi mit gemerkter bevorzugter Ansicht,
persönlich synchronisierte Standardliste, genauer Rückkehr-Rückfall und der
Schutz bearbeiteter Seriennachfolger sind jetzt ausdrücklich geklärt.
Dezimalpräzision, Namensvergleich, Checklistenabschluss und Matrix-Randfälle
werden vor ihrem jeweiligen Feature gefragt. Sie erzwingen keine vollständige
Vorabspezifikation und kein umfangreicheres Grundgerüst.

**Arbeitsstand dieser Korrektur, vor §14:** Die Korrektur ergänzt den Plan und bereinigt die
voreiligen Datenmodell-Entwürfe. Die neuen Listeneinstellungen und die neue
automatische Löschung sind noch nicht implementiert oder aktiviert.

**Validierung dieser Korrektur:** `npm run ci` ist erneut grün mit 502 Tests
in 59 Dateien, Typecheck, Lint und Produktionsbuild. Die drei zuvor begonnenen
Domänen-Dateien entsprechen wieder ihrem Stand vor dem UI-Anlauf; der nicht
angeschlossene Platzierungshelfer ist entfernt. `git diff --check` ist grün.
Der UI-Code wurde in dieser Korrektur nicht verändert; deshalb wurden die
bereits grünen 89 E2E-Fälle und die unveränderten Telefonbilder nicht erneut
erzeugt. Keine Produktionsdaten wurden gelöscht.

## 14. Erster Gesamtansicht-Ablauf mit persönlichen Einstellungen

Die Fortsetzung baut einen begrenzten Teil der neuen Grundoberfläche: die
Start-Gesamtansicht, ihre persönliche Auswahl und Darstellung sowie Anlegen
und Bearbeiten von Aufgaben aus dieser Ansicht. Sie ist ein erster konkreter
Austauschablauf; Stufe 3 ist damit noch nicht vollständig abgeschlossen.

### Verhalten und technische Grenze

- Die App öffnet die Gesamtansicht. Vorhandene und neue Listen sind zunächst
  ausgeschlossen. Aufnahme und Ausschluss erfolgen ausdrücklich über die
  jeweilige Listeneinstellung oder „Gesamtansicht einstellen“.
- Die Auswahl gehört dem Benutzer, auch bei geteilten Listen. Zwei kleine
  Tabellen halten Aufnahme je Benutzer/Liste sowie manuelle Standardliste und
  bevorzugte Ansicht. Dadurch überschreiben unabhängige Listenauswahlen kein
  gemeinsames Auswahl-Array. Es gibt keinen neuen globalen Aufgabenstore,
  kein Navigationsframework und keine neue Bibliothek.
- Beide Darstellungen sind vorhanden: nach Ursprungsliste mit bestehender
  Aufgaben-/Bereichsreihenfolge oder gemeinsam nach Erstellzeit, neueste zuerst.
  Die Herkunft bleibt erkennbar. **Gruppierung gilt nur vor der ersten anderen
  Auswahl. Die bevorzugte Ansicht wird persönlich gespeichert, nach Neustart
  verwendet und zwischen Geräten synchronisiert.**
- Erstellen verlangt eine ausdrückliche Zielliste, solange keine manuelle
  Standardliste existiert. Mit weiterhin zugänglicher Standardliste öffnet der
  Editor direkt und zeigt das Ziel; „Zielliste ändern“ ist erreichbar. Eine
  bloße Erstellungsauswahl ersetzt den Default nicht. Alle zugänglichen Listen
  sind erlaubt; ausgeschlossene Ziele erhalten einen sichtbaren Hinweis.
- Der Gesamtansicht-Editor verwendet die vorhandene gemeinsame Formularlogik.
  Seine Kennungen liegen über der Ansichtsverzweigung. Fensterbreitenwechsel
  behalten den offenen Editor und Eingaben; gleichnamige Aufgaben werden über
  ihre IDs bearbeitet. Ein Wechsel der Zielliste behält Entwürfe bei ihrer
  jeweiligen Liste, statt sie still in die andere zu übertragen.
- Lesen bleibt in den App-Hooks, Schreiben in den Repositories. Ladefehler
  liefern einen erneuten Versuch und werden nicht als leere Auswahl oder
  neuer Default behandelt. Ein nicht mehr verfügbares Standardziel wird
  kenntlich gemacht; eine beliebige andere Liste wird nicht vorausgewählt.
- Persönliche Änderungen verwenden den geschützten Cloud-Schreibweg aus §12.
  RLS trennt Benutzer; der Server prüft Rechte, Ausgangsstand und unveränderliche
  Erstellzeiten. Unabhängige Felder werden zusammengeführt; echte Konflikte
  erhalten auch für persönliche Einstellungen verständliche Vergleichswerte.
- Dexie-Version 8 ergänzt die Tabellen ohne Bestandsdaten umzuschreiben.
  Migration 0015 muss vor der neuen Cloud-App eingespielt sein. Sie und der
  vorhandene Schreibschutz werden gemeinsam geprüft; die Produktionscloud
  wurde während der Umsetzung nicht verändert.

### Abnahmefälle

- Bestehende Datenbanken behalten Listen/Aufgaben und beginnen ohne automatische
  Aufnahme. Besitzer und Mitglied behalten voneinander unabhängige Auswahl.
- Gruppierung zeigt die bestehende Listenreihenfolge; „Neueste zuerst“ zeigt
  Herkunft und Erstellreihenfolge. Die Moduswahl überlebt Neustart und ein
  zweites Gerät. Gleichzeitig gesetzte Standardliste und Modus gehen nicht
  verloren; widersprechende Standardlisten werden ausdrücklich geklärt.
- Ohne Default bleibt die Zielauswahl bei jeder neuen Aufgabe leer. Ein
  ausgeschlossener Zielbestand wird gespeichert, aber nicht plötzlich in die
  Gesamtansicht aufgenommen. Ein manueller Default spart den Auswahlschritt.
- Gleichnamige Aufgaben aus verschiedenen Listen ändern die richtige Zeile.
  Der offene Editor und sein Entwurf überleben den Breitenwechsel.
- Alte Bestätigungen machen eine inzwischen geänderte persönliche Einstellung
  auch bei gleicher Millisekunde nicht sauber. Fremde Einstellungen sind
  weder lesbar noch schreibbar; konkurrierende Datenbankverbindungen liefern
  Schreiben/Konflikt statt stiller Überschreibung.
- Beide Ansichten haben Aufnahme, Darstellung und Standardziel. Telefonbilder
  in Hoch-/Querformat werden angesehen; vorhandene Kernabläufe und der
  Offline-PWA-Start bleiben Teil der Prüfung.

### Verbleibender Umfang

Bei Abschluss dieses Gesamtansicht-Pakets blieben der gemeinsame Schalter
„Abgehakt am Listenende“, endgültiger Ablauf und Nachbar-Rückkehr eigene Arbeit.
Die anschließende Umsetzung steht in §15. Ihre nachträglich beantworteten
Produktfragen ergänzen §7/§13; die hier dokumentierte erste Gesamtansicht hat
die Aufbewahrung nicht pauschal für alle Listen eingeschaltet.

Die bestehende Listenansicht bleibt vorerst erhalten. Ihr vollständiger
Austausch, Rollenparität bei Verwaltungsaktionen und die endgültige Gestaltung
werden an den nächsten konkreten Abläufen abgeschlossen. Bewertungen,
Checklisten, Matrix, optionaler Aufgabenbaum und vollständiger MCP-Server
bleiben die abgegrenzten folgenden Stufen. Das erste echte UI darf diese
Featureentscheidungen nicht still vorwegnehmen.

### Abschlussprüfung und Auslieferungsgrenze

Die lokale Abschlussprüfung umfasst Typecheck, Lint, Unit-/Integrationstests
und Produktionsbuild über `npm run ci`. Alle **101 E2E-Fälle** bestehen,
einschließlich beider Oberflächen, eines zweiten Geräts und des Offline-Starts
aus dem Produktionscache. Die Telefonbilder in Hoch- und Querformat wurden
angesehen; die Gesamtansicht läuft ohne horizontalen Überlauf.

Der echte, lokale PostgreSQL-Test besteht mit **21 Fällen**, einschließlich
wiederholbarer Migrationen, Berechtigungen, gleichzeitiger Schreibvorgänge und
persönlicher Einstellungen. Die lesende Datenbankprüfung bestätigt alle
erwarteten Spalten und den Schreibschutz. Diese Prüfung betrifft eine
wegwerfbare Testdatenbank; die Produktionscloud wurde nicht verändert.

Der Arbeitsbranch `feature/ui-foundation` basiert auf dem frisch geprüften,
unveränderten Stand von `main`/`origin/main`. Die Sammlung bleibt lokal und
unveröffentlicht. Vor Auslieferung müssen 0014/0015 gemeinsam in die Cloud
eingespielt und die Geräte abgestimmt aktualisiert werden. App-Version, Tag
und Release bleiben bis dahin unverändert.

## 15. Fortsetzung: Aufbewahrung, endgültiger Ablauf und Nachbar-Rückkehr

Das nächste begrenzte Paket ergänzt den bestätigten Listenablauf. Der Besitzer
stellt „Abgehakt am Listenende“ gemeinsam für die Liste ein; bestehende und
neue Listen beginnen weiterhin mit ausgeschalteter Aufbewahrung.

### Umgesetzt und fachlich begrenzt

- **Aufbewahrung an:** Erledigte Aufgaben bleiben unbegrenzt am Listenende.
  Der gemeinsame Bereich beginnt eingeklappt, zeigt die Anzahl und bietet
  „Wieder öffnen“. Diese Aufgaben erscheinen ausschließlich dort, ohne
  zusätzlichen Eintrag unter „Aufgaben wiederherstellen“. Besitzer/Mitglied
  können Aufgaben öffnen; nur der Besitzer kann die Listenregel umstellen.
- **Aufbewahrung aus:** Sieben Tage ab Abschluss, dann endgültiger Ablauf.
  Einführung und Abschalten gewähren bestehenden Abschlüssen sieben Tage ab
  der bestätigten Umstellung. `completed_at` bleibt historisch richtig;
  `completed_expires_at` ist die davon getrennte Frist. Bereits Abgelaufenes
  erhält durch erneutes Einschalten keine neue Lebenszeit.
- **Erledigtes Verschieben:** Es gilt die Zielliste. Ohne Aufbewahrung beginnen
  sieben Tage ab dem bestätigten Listenwechsel, mit Aufbewahrung entfällt die
  Frist. Der Abschlusszeitpunkt bleibt erhalten. Ein Wechsel des Bereichs in
  derselben Liste oder gewöhnliches Bearbeiten verlängert die Frist nicht.
- **Geschlossene App:** Ein benannter minütlicher Datenbankjob führt den Ablauf
  aus. Er entfernt den fachlichen Inhalt und behält einen endgültigen
  Löschvermerk für den Abgleich. Lesen und Schreiben prüfen die Frist zusätzlich;
  es entsteht weder ein zweiter Papierkorb noch eine Wahl, mit einem alten
  Offline-Stand den Ablauf rückgängig zu machen. Die tatsächlich ausgeführte
  lokale Cron-Prüfung ist von Mock-/Zeitreise-Tests getrennt.
- **Neue Nachbar-Rückkehr:** Beim Abhaken werden Gruppe, Vorgänger und
  Nachfolger gesichert. Wiederöffnen benutzt die bestätigte A–B–C-Regel:
  nach gültigem A, sonst vor gültigem C, sonst Gruppenende. Bei entfernter Gruppe
  ungruppiert; fremden Listen/Gruppen wird nicht gefolgt. Nur wenn numerisch kein
  Zwischenplatz darstellbar ist, wird diese Gruppe atomar neu nummeriert.
  Alte Abschlüsse ohne gesicherte Anker behalten die vorhandene relative
  Position; ihre verlorene frühere Nachbarschaft wird nicht erfunden.
- **Bestehende Architektur:** Reine Frist-/Platzierungsfunktionen, bestehende
  Repositories, bestehende App-Hooks und zwei gemeinsame kleine UI-Bausteine.
  Kein allgemeiner Lebenszyklusdienst, Aufgabenbaum oder zusätzlicher Store.
  Der bestehende Zeitgeber aktualisiert die Fristanzeige auch offline, ohne
  dadurch einen zusätzlichen Cloud-Abgleich anzustoßen.

### Bestätigt und umgesetzt: nächste Termine wiederkehrender Aufgaben

Am 10. Oktober wurde bestätigt: Ein inzwischen bearbeiteter oder verschobener
nächster Termin bleibt beim Wiederöffnen erhalten. Ein nachweislich unveränderter,
noch offener nächster Termin wird weiterhin weich zurückgenommen. Umsortieren
zählt ebenfalls als Änderung; bereits erledigte nächste Termine bleiben erhalten.
Beide Aufgaben dürfen dann offen sein. Der Vergleich benutzt den vollständigen
gesicherten Stand ohne das lokale Upload-Flag und schützt auch Änderungen bei
identischen Zeitstempeln. Erzeugen, Prüfen und Wiederöffnen bleiben lokal atomar.

Bei alten Abschlüssen ohne gesicherten Ausgangsstand ist Unverändertheit nicht
nachweisbar: Der nächste Termin bleibt erhalten. Beim erneuten Abhaken nach
einem Rückgängig wird dessen ursprüngliche Erstellzeit bewahrt und der tatsächlich
wieder angelegte Stand gesichert. Eine weitere Wiederöffnung nimmt diesen
unveränderten nächsten Termin korrekt zurück.

### Abnahme und Update-Weg

Geprüft werden beide Aufbewahrungsmodi, Besitzerrechte, historische Zeitpunkte,
Fristgrenzen, Umstellung und erledigtes Verschieben. Weitere Fälle sichern
veränderte/fehlende Nachbarn, entfernte Gruppen, erschöpfte Positionsabstände,
abweichende Geräteuhren und alte Offline-Uploads. Alte lokale Zeilen ohne neue
Felder bleiben lesbar. Ausschließlich serverseitig berechnete Fristen führen
zum automatischen Abgleich und erzeugen keinen zusätzlichen Benutzerdialog.

Für die neuen nicht indexierten Felder genügt die bestehende Dexie-Version 8.
Die Abfragen verwenden ihre vorhandenen Listen-/Abschlussindizes; ein zunächst
ergänzter, ungenutzter Fristindex wurde vor Auslieferung entfernt. Alte lokale
Fristen werden ohne geratenen Backfill erst durch die Cloud-Umstellung bestätigt.
Migration 0016 ergänzt die Felder und erweitert die Positionsspalte für
Zwischenplätze, ohne bestehende Positionen zu verändern. 0017 vergibt die Einführungsgnade einmalig
mit einem privaten Marker. Die Listenumstellung bleibt außerdem gespeichert,
damit damals ungesendete Altabschlüsse dieselbe Übergangsfrist erhalten. 0018
richtet den Datenbankjob ein. Fehlendes `pg_cron` führt zu einem sichtbaren
Migrationsfehler. Erneutes Einspielen verändert keine Fristen und erzeugt
keinen zweiten Job. Die Empfehlungen der
[Supabase-Dokumentation](https://supabase.com/docs/guides/cron) sind im konkreten
Job umgesetzt: ein kurzer SQL-Lauf mit 30-Sekunden-Grenze, benannte Planung,
Bereinigung nur des eigenen Verlaufs.

Die lokale Gesamtprüfung ist mit **549 Unit-/Integrationstests**, Typecheck,
Lint, Skriptprüfung und Produktionsbuild grün. Die gezielten neuen
Browserabläufe und der alte Update-Weg sind grün; die Telefonbilder in Hoch-
und Querformat wurden angesehen. Alle **109 Browserfälle** einschließlich
Offline-PWA-Start bestehen. Die echte lokale PostgreSQL-Prüfung umfasst **33 Fälle**, darunter
der unabhängig ausgeführte Datenbankjob; die lesende Datenbankprüfung bestätigt
neue Spalten, Rechte und aktiven Job.

Die Sammlung liegt weiterhin unveröffentlicht auf `feature/ui-foundation`.
`main` und `origin/main` sind frisch abgeglichen und unverändert auf dem
Ausgangscommit. Die Produktionscloud wurde nicht angefasst. Vor Veröffentlichung
braucht es die vollständige Sammelmigration bis 0018, abgestimmte App-Updates
und die Prüfung des tatsächlich eingespielten Produktionsjobs. Es wurden
weder Version noch Tag oder Release erstellt. Das vollständige neue Aussehen,
Prioritäten, Checklisten, Matrix, optionale Hierarchie und der MCP-Server bleiben
die nachfolgenden, gesondert abgegrenzten Lieferumfänge.

### Nächste Etappe

Das Grundlagenpaket ist lokal geprüft. Die nächste Etappe gestaltet einen
zusammenhängenden Kernablauf: Listen-/Gesamtansicht, Aufgabenzeile, Aufgabeneditor
und Listeneinstellungen, jeweils breit und auf dem Telefon. Die bestehenden
Fachoperationen und Bausteine reichen als Ausgangspunkt; weitere allgemeine
Vorbereitung ist dafür nicht nötig. Abschlusskriterien sind die bestehenden
Kernabläufe, erhaltene Entwürfe und Auswahl beim Ansichtswechsel, vollständige
Erreichbarkeit auf beiden Oberflächen sowie die visuelle Prüfung in Telefon-
Hoch- und Querformat. Neue Prioritäts-, Checklisten- oder Hierarchieregeln werden
erst im jeweiligen Lieferumfang entschieden.

## 16. Erste zusammenhängende UI-Fassung und unabhängige Kritik

Die begonnene Etappe verbindet Listen-/Gesamtansicht, Aufgabenzeile,
Aufgabeneditor und Listeneinstellungen. Der Hintergrund ist auf ausdrücklichen
Nutzerwunsch vollständig schwarz; Flächen, Linien, Schrift und Akzente werden
als zusammenhängende Gestaltung beurteilt. Der sichtbare Produktname lautet
**Prio**. Farbwerte und Rundungen dieser Fassung sind weiterhin veränderbar.

### Konkreter Umbau

- Gemeinsamer Aufgabeneditor und gemeinsame Listeneinstellungen liegen über
  der Verzweigung in Telefon-/breite Ansicht. Ein Breitenwechsel erhält das
  offene Formular und seinen Entwurf. Neue Aufgaben bleiben ihrer ausdrücklich
  gewählten Zielliste zugeordnet.
- Aufgabenzeilen zeigen Titel, vorhandene Metadaten, Beschreibung und Abhaken.
  Bearbeitung und Zusatzaktionen stehen im gemeinsamen Editor, Listenaktionen
  in der gemeinsamen Verwaltung. Die Abhakfläche misst 44 × 44 CSS-Pixel.
- „Reihenfolge ändern“ bietet auf beiden Oberflächen einen einfachen Weg ohne
  verpflichtendes Ziehen. Er ordnet nur die Aufgaben der gewählten Gruppe;
  die bestehenden Fachoperationen reichen dafür aus.
- Dialoge sperren den Hintergrund auch bei verschachtelten Ebenen. Schließen
  gibt den Fokus an den Auslöser oder seinen fachlich gleichen Gegenpart nach
  einem Breitenwechsel zurück. Behalten, Verwerfen und Weiterbearbeiten gelten
  für geänderte Aufgabenentwürfe auf beiden Oberflächen.
- `DESIGN.md` trennt jetzt begründete Verhaltensregeln mit Nachweisen von
  veränderbaren Stilwerten. Frühere Befundnummern bleiben als ausdrücklich
  historischer Anhang für vorhandene Verweise erhalten.

### Fachliche Grenze

Diese Fassung benutzt die vorhandenen Fachoperationen. Sie entscheidet weder
Prioritätsformel noch Matrixdarstellung, Bewertung, Checklisten oder optionale
Eltern-Kind-Hierarchie. Der MCP-Server wird damit nicht vorweggenommen. Die
bestätigten Aufbewahrungs-, Wiederöffnungs-, Auswahl- und Entwurfsregeln gelten
weiter; „Abgehakt“ bleibt eine zunächst ausgeschaltete Listeneinstellung.

### Prüfstand und Designkritik

Typecheck, Lint, Skriptprüfung, Produktionsbuild und **551 Unit-/Integrationstests**
sind grün. Zwei neue Dialogtests prüfen verschachtelte Hintergrundsperren,
vorherige Sperren und die Fokusübergabe nach einem Austausch des Auslösers.
Die neuen Browserfälle prüfen den gemeinsamen Kernablauf, Entwürfe,
Breitenwechsel und Umsortieren ohne Ziehen. Alle **122 Browserfälle** einschließlich
Offline-PWA und Update alter Daten bestehen. Die Abnahme umfasst außerdem den
Editorzugang und erledigtes Verschieben unter „Abgehakt“, Fokusübergabe der
Einstellungen nach Breitenwechsel, kurze breite Fenster sowie den Editor bei
200 % Schrift auf beiden Oberflächen. Die zugehörigen Telefon-, Querformat-
und vergrößerten Schriftbilder wurden angesehen.

Auf ausdrücklichen Nutzerwunsch prüft Impeccables `critique` diese Fassung mit
zwei voneinander isolierten Subagenten: Designbewertung und technische
Detektor-/Browser-Evidenz. Die Designbewertung wird vor den Detektorbefunden
gelesen. Reale lokale Mockdaten und aktuelle Telefon-/Querformat-/Desktopbilder
gehören zur Prüfung; ein grüner Funktionstest ist keine visuelle Freigabe.

Die unabhängige Designbewertung des zunächst geprüften Stands beträgt
**27/40** nach den zehn Nielsen-Heuristiken. Sie bewertet die schwarze Basis,
kühle Flächen und Violett als zusammenhängend, bemängelt aber die Dominanz
leerer Formulare und Verwaltungsflächen. Weitere P2-Befunde betreffen die
Erreichbarkeit der mobilen Erfassung nach dem Scrollen und zu viele sofort
sichtbare Zusatzfelder. Diese Gestaltungsentscheidungen bleiben für die nächste
Verfeinerung ausdrücklich offen.

Zwei P1-Befunde wurden unmittelbar im bestehenden Lieferumfang korrigiert:
Bei kurzen breiten Browserfenstern war die innere Aufgaben-Scrollfläche null
Pixel hoch. Jetzt scrollt der zusammenhängende Arbeitsbereich, sodass die
Aufgaben auch bei 844 × 390 und 1280 × 390 erreichbar bleiben. Aufbewahrte
abgehakte Aufgaben öffnen über ihre ID den gemeinsamen Editor; Beschreibung,
Bearbeitung und erledigtes Verschieben stehen damit zur Verfügung. Der
schnelle Weg „Wieder öffnen“ bleibt erhalten. Ein zusätzlicher technischer
Codebefund ergänzt Fokuskennungen für Listen-/Gesamteinstellungen, damit auch
diese Dialoge nach einem Breitenwechsel ihren passenden Auslöser wiederfinden.

Der Detektor für `src/ui` meldete **0 Befunde**. Der Browserzugriff des zweiten
Subagenten wurde von der Freigabeprüfung abgelehnt. Er umging diese Ablehnung
nicht und erzeugte weder Browserbilder noch ein Live-Overlay. Seine zusätzliche
Evidenz besteht aus Quelltext, Komponentenprüfung und berechneten Farbkontrasten;
sie ersetzt keine unabhängige Browser-Abnahme. Die echten Bilder und gemessenen
Querformatbefunde stammen von Assessment A. Ein zwischenzeitlich roter
Dialogtest beruhte auf jsdoms fehlender nativer `inert`-Eigenschaft; die Prüfung
fragt inzwischen nach dem gesperrten/entsperrten Zustand und bleibt im aktuellen
551er-Lauf grün.

Die ergänzende Schriftprüfung maß bei 200 % eine 459 Pixel breite Feldgruppe
im 390-Pixel-Fenster sowie überlaufende Kopfaktionen. Eine schrumpfbare
Feldgruppe und umbrechende Kopfaktionen beheben die gemessene Ursache;
Speichern und Lesen des gespeicherten Inhalts bestehen danach auf beiden
Oberflächen. Weitere visuelle Änderungen folgen erst der gewählten Richtung.

Der unveränderte Bewertungspunktestand wird nicht als Bewertung dieser
Korrekturen ausgegeben. Der archivierte Bericht liegt unter
[Impeccable-Kritik](.impeccable/critique/2026-10-09T23-18-42Z__src-ui-workspacescreen-tsx.md).
Für einen Trendvergleich existiert bislang nur dieser erste Snapshot.

Der Stand bleibt eine unveröffentlichte Arbeitsfassung auf
`feature/ui-foundation`. Für eine Auslieferung gelten die bisherigen Tore.
