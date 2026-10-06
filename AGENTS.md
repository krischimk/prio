# Arbeitsregeln für prio

Verbindlich für alle Änderungen in diesem Ordner. Die fachliche Dokumentation
steht in `README.md`, die der Datenbank in `supabase/README.md` – hier stehen
nur die Regeln, die man beim Arbeiten kennen muss.

## Repository

* Eigenes Git-Repository in `prio/`, **nicht** Teil des gemeinsamen
  Codex-Repos im übergeordneten Ordner.
* Remote: <https://github.com/krischimk/prio> (**öffentlich** – Voraussetzung
  für die Update-Prüfung in der App). `main` ist der stabile Branch, für
  Größeres `feature/…` bzw. `fix/…`.
* Commit-Nachrichten nach Conventional Commits, kleine thematische Commits.
* Version in `package.json` und das Release gehören zusammen: Version erhöhen,
  committen, Tag `v*` setzen und pushen. Der Release-Workflow baut und
  veröffentlicht die APK.
* **Das Tag bekommt einen Text, und der ist der Changelog.** GitHub kann ihn
  nicht selbst erzeugen: Ohne Pull Requests bleibt bei `--generate-notes` nur
  ein Verweis auf den Vergleich zweier Tags. Also `git tag -a v0.9.0 -m "…"`
  mit einer lesbaren Liste, was sich geändert hat – der Workflow bricht ab,
  wenn der Text fehlt.

## Nach jeder Änderung

```bash
npm run ci          # Typecheck, Lint, Tests, Produktionsbuild
npm run test:e2e    # echter Browser gegen den Mock-Server
```

Beides muss grün sein. Bei Oberflächenänderungen zusätzlich in Telefongröße
rendern und die Screenshots **anschauen** (siehe Tests).

Die billigen Tore hält der Git-Haken `.githooks/pre-commit`: Bei jedem Commit
laufen Typecheck, Lint und Vitest, und bei einem Fehlschlag entsteht kein
Commit. Er wird einmal je Arbeitskopie eingerichtet
(`git config core.hooksPath .githooks`) und bewusst übergangen, sichtbar per
`git commit --no-verify`. Er ist der Boden, nicht das Tor: Produktionsbuild und
E2E bleiben Handarbeit.

### Während der Arbeit nicht jedes Mal alles

`npm run ci` ist billig, aber nicht kostenlos, und ein voller E2E-Lauf und ein
Release sind es erst recht. Faustregel nach Umfang:

| Was geändert wurde | Was laufen muss | Größenordnung |
| --- | --- | --- |
| eine Datei, Logik | `npx vitest run <datei>` | Sekunden |
| mehrere Dateien | `npm run ci` | unter einer Minute |
| ein Ablauf in der Oberfläche | zusätzlich **nur** die betroffene E2E-Datei | ein bis zwei Minuten |
| vor dem Commit | `npm run ci` und alle E2E-Dateien (Typecheck, Lint und Vitest nimmt der Git-Haken schon ab) | eine bis drei Minuten |
| nur Text, Kommentar, README | `npm run ci` | unter einer Minute |

**Größenordnungen, nicht Sekunden.** Wie lange eine Stufe dauert, hängt an der
Maschine. Eine absolute Zahl veraltet still und trägt dann eine Entscheidung
nicht mehr – genau dafür steht hier die Stufe selbst. Nachmessen statt glauben:
`time npm run ci`, `time npm run test:e2e`. Weicht eine Stufe um eine
Größenordnung ab, etwa nach einem Maschinentausch, ist diese Tabelle neu zu
beurteilen.

### Was einen Auftrag wirklich langsam macht

Gemessen, in absteigender Reihenfolge:

1. **Zwei Releases in einem Auftrag.** Ein Release-Workflow baut ein paar
   Minuten, und er lässt sich nicht abkürzen. Wenn nach dem Tag noch etwas
   gefunden wird, kostet das einen zweiten.
2. **Synchron auf GitHub warten.** `gh run watch` blockiert. Als Hintergrund-Job
   starten und weiterarbeiten.
3. **Emulator-Runden.** Jeder `android:emu:eval` ist ein eigener Hin-und-Rückweg,
   jeder Neubau ein Gradle-Lauf. Prüfungen bündeln statt einzeln abzufragen.
4. **Der Emulator zum Schluss.** Ist er der letzte Schritt, findet man Fehler
   nach dem Release statt davor.

### Deshalb gilt

* **Erst im Emulator prüfen, dann taggen.** Nie umgekehrt. Der Emulator ist die
  letzte Prüfung *vor* dem Release, nicht danach – genau so ist 0.12.0 mit
  einem schwarzen Bildschirm veröffentlicht worden.
* **Ein Release je Auftrag.** Was beim Prüfen auffällt, geht in dieselbe
  Fassung.
* **GitHub-Läufe im Hintergrund** starten und währenddessen weiterarbeiten.
* **Shell-Aufrufe bündeln**, wo sie zusammengehören: Dateien lesen, prüfen und
  messen in einem Aufruf statt in fünf.

### Regeln sind Mittel, nicht Selbstzweck

Jede Regel hier hat einen Grund, meistens einen Fehler. Erfüllt sie im konkreten
Fall ihren Zweck nicht, wird sie nicht blind befolgt – der Zweck wird anders
erfüllt oder der Schritt entfällt, **mit einem Satz Begründung**. Weggelassen
wird sichtbar, nicht still; im Zweifel wird der Schritt gemacht.

Dazu gehört, wodurch eine Regel durchgesetzt wird: durch eine Prüfung (Test,
Git-Haken, Workflow) oder allein durch Disziplin. Ist der Fehler maschinell
ausgeschlossen, geht die Regel, sobald die Prüfung den Fall abdeckt – sie wird
dann zur Prüfung. Ist sie ungeprüft, wird sie beim nächsten Anfassen prüfbar
gemacht oder gestrichen, wenn der Fehler strukturell nicht mehr eintreten kann.
Und beim Hinzufügen gehört der Auslöser dazu: welcher Fehler war das?

Die Tore bleiben: `npm run ci` und alle E2E-Dateien vor dem Commit, eine
Emulator-Prüfung des tatsächlichen App-Codes vor dem Tag, Tag und Version
zusammen. Was nur dem Ablauf dient – auf einen grünen Lauf warten, eine Runde
wiederholen, deren Ergebnis schon feststeht –, darf entfallen.

Andere Gegebenheiten, gleicher Zweck: Auf einem Rechner ohne Anzeige und ohne
`~/Desktop` werden Regeln übersetzt, nicht gestrichen. Jede Regel macht eine
Annahme über die Umgebung; wer die Umgebung wechselt, prüft diese Annahme.

### Sammeln, dann ausliefern

Die teuren Schritte – Emulator-Runde und Release – laufen **einmal je Sammlung**,
nicht einmal je Änderung. Drei Stufen:

| Stufe | Wann | Was läuft |
| --- | --- | --- |
| **Bauen** | bei jeder Änderung | eine Datei: `npx vitest run <datei>`; mehrere: `npm run ci` |
| **Sammeln** | mehrfach hintereinander | nichts weiter – committen und weitermachen |
| **Ausliefern** | wenn der Auftrag fertig ist | `npm run ci`, `npm run test:e2e`, **eine** Emulator-Runde für alles Sichtbare, Version, Tag, **ein** Release |

* **Ausprobieren ist nicht Ausliefern.** Zum Ansehen genügt
  `npm run android:emu:install` – ohne Version, ohne Tag, ohne Release. Ein
  Release ist nur nötig, wenn die Fassung aufs Telefon soll.
* **Ein Release ist der Schlussstrich, nicht der Zwischenschritt.** Nicht nach
  jedem Feature taggen; sonst läuft der mehrminütige Bau für jede
  Kleinigkeit.
* **Erst `main` pushen, die CI abwarten, dann taggen.** Der Release-Workflow
  führt kein E2E aus, die CI tut es bei jedem Push auf `main`. Ist sie grün, ist
  E2E für genau den Commit bewiesen, aus dem die APK entsteht – und die Wartezeit
  kostet nichts, weil GitHub währenddessen arbeitet. Entfällt, wenn genau dieser
  App-Code schon einen grünen E2E-Lauf hat.

## Architektur – nicht aufweichen

* `src/sync` kennt **kein React und kein Supabase**. Neue Cloud-Zugriffe gehören
  hinter das Interface `RemoteGateway`.
* `src/reminders` ebenso: Planung und Abgleich sind reine Funktionen, der
  Systemzugriff steckt hinter `LocalNotificationsPort`.
* Die Oberfläche liest ausschließlich über `src/app/hooks.ts` aus Dexie. Kein
  zusätzlicher Zustandsspeicher, keine kopierten Daten.
* Geschrieben wird immer über `src/db/repositories.ts`. Jede schreibende
  Operation setzt `updated_at` und `dirty = 1` – sonst geht sie beim Sync
  verloren.
* Gelöscht wird als Soft Delete (`deleted_at`), nie hart.
* Die Sync-Engine und die Datenbankschicht müssen ohne Cloud und ohne
  Netzwerk testbar bleiben.

## Datenschicht

* **Migrationen sind wiederholbar.** Jede Datei muss sich beliebig oft ausführen
  lassen (`if not exists`, `create or replace`, `drop policy if exists`) und
  liefert dabei dasselbe Ergebnis. Policy-Änderungen laufen in einer Transaktion.
* **Bestehende Dateien dürfen geändert werden.** Es gibt keine
  Versionsverwaltung, die eingespielte Stände festhält: Eingespielt wird die
  Sammeldatei – über `npm run db:apply` oder von Hand im SQL-Editor –, und sie
  wird mit `npm run db:sql` aus den Dateien neu erzeugt. Eine geänderte Migration
  wirkt also beim nächsten Einspielen – auch bei einer Datenbank, die die alte
  Fassung schon kennt. Das ist gewollt: Eine
  falsche Spalte, ein fehlender Index oder ein irreführender Kommentar sollen
  nicht als neue Datei daneben stehen bleiben.
  * Bedingung: Die Datei bleibt wiederholbar, und ein zweiter Lauf ändert
    nichts mehr.
  * Wer eine Datei ändert, spielt die Sammeldatei danach erneut ein.
* **Was Daten anfasst, kommt in eine neue Datei.** Ein `update`, `delete`,
  `drop column` oder ein Backfill in einer bestehenden Datei liefe beim
  nächsten Einspielen erneut und überschriebe neuere Daten. Solche Schritte
  gehören einmalig ausgeführt und datiert (`0010_…`).
* Neue Migrationen landen automatisch in der Sammeldatei (`npm run db:sql`).
* **Einspielen ohne Kopieren:** `npm run db:apply` erzeugt die Sammeldatei und
  schickt sie per `psql` an das Projekt – dieselbe Semantik wie der SQL-Editor
  (immer alles, jedes Mal, wiederholbar), nur ohne Handarbeit. `npm run db:check`
  zeigt rein lesend den Ist-Stand (Spalten von `tasks`, RLS). Einmalig nötig:
  `postgresql-client` und `SUPABASE_DB_URL` in `supabase/.env.local`, verknüpft
  nach `~/.prio-android/db.env` (`python3 scripts/setup_private_data.py`). Fehlt
  die Datei, bleibt der SQL-Editor der Weg.
* **Erst die Migration, dann die App-Version, die sie braucht.** Sendet die App
  eine Spalte, die es serverseitig nicht gibt, scheitert jeder Sync mit
  `PGRST204`.
* Row Level Security bleibt Pflicht. Neue Tabellen brauchen Policies **und**
  explizite `grant`s an `authenticated` – nicht auf die Vorgaben des Projekts
  verlassen.
* Zeitstempel kommen vom Client. Kein Trigger, der `updated_at` überschreibt –
  das würde Last Write Wins aushebeln.
* **Der Supabase-Skill gilt nur für allgemeine Supabase-Fragen.** Seine
  Empfehlungen zu Schemaänderungen (`supabase migration new`, `db pull`,
  `db advisors`, MCP-`execute_sql`) beschreiben das CLI-Modell und gelten hier
  **nicht**: Migrationen werden von Hand geschrieben, bleiben wiederholbar und
  werden als vollständige Sammeldatei eingespielt (siehe oben). Seine
  Sicherheits-Checkliste dagegen gilt – `TO`-Klausel statt `auth.role()`,
  `USING` **und** `WITH CHECK` bei UPDATE, `SECURITY DEFINER` nur außerhalb
  exponierter Schemata.

## Android

* JDK 17–21 verwenden (das System-JDK ist zu neu für das Android Gradle Plugin).
* `.safe-top`/`.safe-bottom` **niemals** mit `py-*`/`px-*` auf demselben Element:
  Die Safe-Area-Klassen stehen ungelayert im CSS und überschreiben Tailwind.
* `.safe-bottom` bewusst ohne `env()`-Rückfall – bei sichtbarer Tastatur liefert
  `env(safe-area-inset-bottom)` falsche Werte.
* Der Service Worker wird in der App **nicht** registriert.
* **Tag und Version müssen zusammenpassen.** Die Update-Prüfung vergleicht den
  Git-Tag der Veröffentlichung mit der installierten Version (`App.getInfo()`).
  Ein Release ohne passenden Tag im Namen macht die Prüfung falsch.
* **Der `versionCode` kommt aus `package.json`, nicht aus der Laufnummer.** Er
  folgt `major*10000 + minor*100 + patch` und ist damit für lokale und
  veröffentlichte Fassungen derselbe. Android lehnt Updates mit kleinerem
  `versionCode` als „Downgrade" ab – mit der Laufnummer ließ sich die
  Release-APK nicht über die Emulator-Fassung legen.
* **Das Repository muss öffentlich bleiben.** Die Update-Prüfung holt die
  Veröffentlichung anonym von GitHub; bei einem privaten Repository antwortet
  GitHub mit `404`. Wird die Sichtbarkeit zurückgestellt, bricht das Feature
  still.
* Änderungen am Erscheinungsbild immer in Telefongröße gegenprüfen; das
  Querformat gehört dazu.

### Prüfen im Emulator (Standardweg)

Neue Versionen werden **im Emulator** geprüft, nicht zuerst auf dem Telefon.
Der Emulator läuft auf demselben Rechner. Ist eine Anzeige vorhanden (`DISPLAY`
gesetzt), erscheint sein Fenster auf dem Desktop und lässt sich wie ein Handy
bedienen; ohne Anzeige – etwa auf einem Server – startet das Skript ihn
fensterlos, und es bleibt der Screenshot zur Beurteilung.

```bash
npm run android:emu          # Emulator starten (mit Fenster, ohne Anzeige fensterlos)
npm run android:emu:install  # Debug-APK bauen, installieren, öffnen
npm run android:emu:shot     # Screenshot ablegen (Ziel siehe unten)
npm run android:emu:stop

# Einen Ausdruck im laufenden WebView ausführen (prüfen ohne Neubau):
npm run android:emu:eval 'JSON.stringify(Object.keys(window.Capacitor.Plugins))'
```

* **Vorher selbst hinsehen.** Erst `android:emu:shot` und den Screenshot
  ansehen, dann den Nutzer fragen. Das hat schon Fehler gefunden, die keine
  Zusicherung erwischt hätte.
* **Ohne Anzeige gibt es kein Fenster.** Ist `DISPLAY` nicht gesetzt, läuft der
  Emulator fensterlos; bedienen lässt er sich dann nicht, beurteilt wird über
  Screenshots. Deren Ziel ist `PRIO_SHOT_DIR`, sonst `~/Desktop` und – wenn es
  den Ordner nicht gibt, auf einem Server der Normalfall – `test-results/` im
  Projekt. Ein Pfad als Argument gilt weiterhin:
  `npm run android:emu:shot -- /pfad/prio-emulator.png`.
* **Bedienen und beurteilen** tut der Nutzer – wo ein Fenster da ist.
* Der Emulator spricht mit dem echten Supabase-Projekt. Wer dort nichts
  anlegen will, meldet sich mit dem eigenen Konto an.
* **Was der Emulator nicht kann:** echte Benachrichtigungszustellung, die
  Tastatur des Geräts, dessen Systemleisten und Hersteller-Eigenheiten. Dafür
  bleibt das echte Telefon nötig – aber nur dafür.
* Nach dem Test `android:emu:stop`, der Emulator belegt sonst CPU und RAM.
* **Anmeldung und Daten müssen erhalten bleiben.** Debug-Builds werden mit dem
  Release-Schlüssel signiert (`~/.prio-android/emulator.env`), und der
  Emulator benutzt einen dauerhaften Datenträger. Ein `adb uninstall` ist damit
  nie nötig – es würde die Anmeldung des Nutzers löschen.

## Oberfläche: eine Sprache, zwei Bedienmodelle

Es gibt zwei Ansichten – breit (Web/Tablet, Seitenleiste) und mobil (Telefon,
App-Leiste mit Menü). Sie dürfen sich im **Bedienmodell** unterscheiden, nicht
im **Aussehen**.

**Regel:** Gleiche Information wird gleich dargestellt und gleich formatiert –
unabhängig davon, in welcher Ansicht sie erscheint.

Konkret:

* **Farben und Flächen kommen aus `src/ui/styles.ts`.** In Komponenten keine
  rohen Farbklassen (`text-neutral-500`) und keine Hex-Werte. Das gilt besonders
  für Zustandsfarben: `SyncTone → Farbe` gibt es genau einmal.
* **Textformate stehen in einer gemeinsamen Funktion.** Fälligkeit, Zähler,
  Statusmeldungen – wenn zwei Ansichten dieselbe Information zeigen, stammt der
  Text aus derselben Quelle (z. B. `formatDueLabel` in `src/ui/datetime.ts`).
* **Jede Funktion ist auf beiden Oberflächen erreichbar.** Was auf dem Telefon
  geht, geht auch in der breiten Ansicht – und umgekehrt. Eine Aktion nur auf
  einem Bildschirm ist ein **Fehler**, kein Zwischenstand. Beim Hinzufügen
  immer fragen: Wo ist die andere Stelle? Wenn die Antwort „nirgends“ lautet,
  ist die Arbeit nicht fertig.
* **Prüfbar:** `tests/e2e/parity.spec.ts` führt eine Tabelle `funktionen` über
  **beide** Ansichten. Jeder Eintrag hat genau einen Weg für die breite Ansicht
  und einen für das Telefon – beide sind Pflichtfelder, ein einseitiger Eintrag
  lässt sich also gar nicht erst anlegen. Eine neue Listen- oder Aufgabenaktion
  bekommt dort ihre zwei Wege; fehlt einer in der Wirklichkeit, scheitert genau
  dieser Test und trägt den Namen der Ansicht davor. Daneben bleiben die
  ausführlichen Abläufe einer einzelnen Ansicht in `tests/e2e/mobile.spec.ts`
  und `tests/e2e/lists.spec.ts` bzw. `tests/e2e/tasks.spec.ts`.
* **Vor jeder UI-Änderung fragen:** Braucht die andere Ansicht das auch? Wenn ja
  → gemeinsam umsetzen. Wenn nein → bewusst dagegen entscheiden.
* **Nichts verdoppeln, was nur zufällig gleich aussieht.** Zwei fast gleiche
  Markups werden zu einer Konstante; zwei Komponenten mit unterschiedlichem
  Verhalten bleiben getrennt – auch wenn sie ähnlich aussehen.

Ausdrücklich **erlaubte** Unterschiede, die nicht angeglichen werden müssen:

* Bedienmodell: Knöpfe auf dem Desktop, Tippen → Detailansicht auf dem Telefon.
* Dichte: Karten auf dem Desktop, flache Zeilen auf dem Telefon.
* `hover:` auf dem Desktop, `active:` auf dem Telefon.
* Safe-Area-Klassen – nur in der App sinnvoll.

> **Eine Regel ohne Prüfung ist ein Wunsch.** Diese Regeln sind erst belastbar,
> wenn ein Test sie durchsetzt. Für die Parität gibt es ihn jetzt
> (`parity.spec.ts`); für alles andere gilt weiter: für neuen Code sofort,
> bestehende Dateien beim nächsten Anfassen umstellen.

## Tests

* **Geschäftslogik** (Sync, Konflikte, Erinnerungen, Verschieben, Reihenfolge):
  gründlich mit Unit- und Integrationstests. Sie sind schnell und nicht an die
  Oberfläche gebunden.
* **Oberfläche:** nur Kernabläufe in E2E. Keine Zusicherungen über Pixel,
  Abstände oder DOM-Struktur – die überleben keinen Umbau.
* **Layout:** Screenshots in Telefongröße ansehen. Das hat schon Fehler
  gefunden, die keine Zusicherung erwischt hätte.
* Neue Sync-Regel ⇒ Fall in `tests/integration/syncScenarios.test.ts` ergänzen.
* Fehlschläge ernst nehmen: Wenn ein Test etwas aufdeckt, wird die Ursache
  behoben, nicht die Erwartung angepasst.

## Niemals committen

* `.env`, `*.keystore`, `*.jks`, `android/local.properties`
* Der `service_role`- bzw. Secret-Key gehört nicht in die App. Der Publishable
  Key ist öffentlich und darf (muss) im Bundle landen.
