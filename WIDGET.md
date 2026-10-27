# Android-Widget

Das vergrößerbare Glance-Widget wird mit der APK installiert. Im Widget-Menü
des Startbildschirms „Prio · Aufgaben“ auswählen. Jedes Exemplar hat seine
eigene Liste oder Gesamtansicht, Sortierung und Tag-Auswahl (UND-Verknüpfung).
Die Deckkraft des Hintergrunds lässt sich je Widget von 0 % (durchsichtig) bis
100 % (deckend) einstellen. Schrift und Bedienelemente bleiben dabei unverändert.
Der Kopf öffnet die Liste, `+` die Erfassung, eine Zeile die Aufgabe. Das
Kästchen erledigt direkt. Der Fortschrittsknopf klappt die Checkliste ein oder
aus; einzelne Punkte lassen sich unabhängig von der Aufgabe abhaken, auch offline.
Die Fälligkeit erscheint bei Aufgaben ohne Prioritätsbewertung. Ein Aktualisieren-Knopf erscheint in großen Widgets,
ansonsten ist der Abgleich in der Widget-Konfiguration erreichbar.

## Daten und Betrieb ohne geöffnete App

`WidgetStore` enthält eine abgeleitete Anzeige und eine SQLite-Warteschlange.
Ein Klick wird vor der sichtbaren Reaktion dauerhaft gespeichert. Nach einem
Prozessende verwendet der nächste Versuch dieselbe Auftragskennung und Zeit.
`WidgetWorker` verarbeitet Aufträge mit einer nativen Sitzung und aktualisiert
danach Anzeige und Quittungen in einer Transaktion. WorkManager versucht den
regelmäßigen Abgleich im Abstand von mindestens 15 Minuten; Android kann ihn
bei Energiesparen und fehlendem Netz verschieben. Eine Aktion fordert sofort
einen zusätzlichen Lauf an. Ein erzwungenes Beenden in Androids App-Einstellungen
stoppt wie üblich auch Hintergrundarbeit bis zum nächsten App-Start.

Die vorhandene Sitzung wird beim Update ohne erneute Anmeldung aus der WebView
in den mit Android Keystore verschlüsselten Speicher übernommen. SDK und Worker
serialisieren Token-Erneuerungen mit derselben Lease. Token liegen weder im
Widget-Modell noch in Sicherungen oder Protokollen. Abmelden und Kontowechsel
löschen Anzeige und ausstehende Aufträge des bisherigen Kontos.

`server/widget.ts` akzeptiert ausschließlich native Benutzersitzungen. Er liest
aktuelle Zeilen und führt ungesicherte lokale Eingaben anhand ihrer bestätigten
Basis zusammen. Konflikte bleiben zur Klärung in der App erhalten. Der Server
plant den Abschluss mit `planTaskCompletion`; Migration 0029 bestätigt den Plan
unter denselben Sperren und Basisprüfungen wie der normale Sync. Änderungen an
Aufgabe und Wiederholungsnachfolger sind atomar. Dauerhaft bleibt nur ein Digest
des Auftrags gespeichert, damit ein alter Retry eine spätere Wiederöffnung nicht
überschreibt. Der private Bestätigungsschlüssel bleibt auf dem Server.

Offline kann das Widget sofort abhaken und die ursprüngliche Erinnerung
unterdrücken. Ein Wiederholungsnachfolger entsteht nach dem Serverabgleich oder
bei lokaler Verarbeitung durch die App. Diese erste Widget-Version führt die
Wiederholungslogik bei vollständig geschlossener App nicht ohne Netz aus.

## Gemeinsame Quellen statt einer zweiten App

| Eigenschaft | Gemeinsame Quelle | Absicherung |
|---|---|---|
| Farben, Schriften, Listensymbole, Aktionssymbole | `src/index.css`, `src/ui/icons.tsx`, `src/ui/listIconsMdi.ts` | Jeder Gradle-Bau erzeugt native Ressourcen; `widgetDesign.test.ts` prüft den Export |
| Priorität, Checklistenfortschritt, Sortierreihenfolgen, Tag-Schlüssel und Anzeige | `src/widgets/model.ts` mit den vorhandenen Domänenfunktionen | Dieselbe Projektion in App und Server; Integrationstests |
| Fälligkeiten und Zeitzonen | `src/ui/datetime.ts`, `relativeTime.ts` | Gemeinsame Formatierung; unter 24 Stunden steht im Widget die genaue Uhrzeit |
| Abschließen und Wiederholungen | `src/domain/taskCompletion.ts` | App-Repository und Widget-Server, Tests einschließlich Zeitumstellung |
| Erinnerungszeiten und Stummschaltung | `src/reminders/reminderPlan.ts` | App und Server erzeugen denselben Plan; native Ablage verwendet den bestehenden Capacitor-Alarmmanager |
| Datenprotokoll | `WIDGET_PROTOCOL` in `src/widgets/model.ts` | Native Konstante wird daraus beim Bau erzeugt |

Die native Oberfläche zeichnet den vorbereiteten Zustand. Sie dupliziert weder
Prioritätsformel noch Wiederholungs-, Tag- oder Erinnerungsregeln. Neue Felder
gehen weiterhin durch die Normalisierung am Leserand.

Persönliche Tagesverfügbarkeit fließt über dieselbe Prioritätsfunktion ein wie
in der App und im MCP-Server. Routinen mit Sichtbarkeitsfenster bleiben bis zum
Start verborgen. Verpasste Durchläufe mit frischem Start werden in der gemeinsamen
Projektion ersetzt und ihre Checkliste zurückgesetzt, auch wenn die App geschlossen
ist. Die Anzeige übernimmt das beim nächsten Widget-Abgleich. Alte, verspätet
übertragene Klicks dürfen niemals den bereits nächsten Durchlauf erledigen.

`checklist_hide_completed` blendet erledigte Punkte in der Vorschau aus; der
Fortschrittszähler berücksichtigt weiterhin alle. Die Punkte bleiben gespeichert
und lassen sich in der App über „Erledigte anzeigen“ erneut öffnen.

Ändert sich eine im Widget sichtbare Information oder Aktion, wird ihre
gemeinsame Quelle angepasst. Änderungen an der nativen Anordnung werden zusätzlich
in `PrioWidget.kt` umgesetzt und über den Widget-Host geprüft. Nicht jede App-Ansicht
wird ins Widget übernommen: Notizen und die Bearbeitung von Checklisten öffnen die App;
Ziehen und freie Texteingabe bleiben dort.

## Prüfungen

`npm run ci` prüft die gemeinsamen Regeln, die Design-Erzeugung und beide Seiten
der Brücke. `npm run db:test` prüft zusätzlich die echte atomare Speicherung,
Parallelität, Berechtigungen, wiederholte Migration und Retry-Quittungen.
`cd android && ./gradlew :app:testDebugUnitTest` prüft SQLite-Persistenz,
Kontentrennung, getrennte Konfigurationen, Deckkraft und den Checklistenknopf bei
fehlendem Netz. Alle exportierten Symbole werden als Android-Vektoren geladen
und gezeichnet, einschließlich kompakter SVG-Bogenparameter. Die Prüfung rendert echte Glance-RemoteViews in
einem Android-Widget-Host. Die Bilder stehen unter `test-results/widget-native/`.
Diese native Prüfung läuft automatisch bei jedem CI- und Release-Bau. Telefon-
und Querformat sowie beide Themen gehören dazu. Die Bedienung im tatsächlichen
Launcher, System-Energiesparen und gerätespezifische Zustellung bleiben zusätzlich
am Telefon zu prüfen.
