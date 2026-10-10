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
* **Ein Push auf `main` veröffentlicht zweierlei:** die Web-Fassung nach
  Cloudflare Pages (nach grünen Tests, Zugang siehe README) und, mit einem Tag,
  die APK. `main` ist damit Produktion an zwei Stellen – was dort landet, ist
  sichtbar.
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

**Bauteile ansehen statt raten:** `npm run dev`, dann
<http://localhost:5173/?kueche=1> – die Übersicht in `src/ui/dev/Kitchen.tsx`
zeigt jeden Knopf, jedes Feld, jede Fläche und beide Dialogformen in allen
Zuständen. Sie läuft nur im Entwicklungslauf. `tests/e2e/kitchen.spec.ts` hält
sie am Leben.

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

### Erst messen, dann ändern – und fragen statt raten

Zwei Fehler aus der Praxis, beide teuer:

* **Bei einem Verhaltensfehler wird erst die Ursache gemessen, dann geändert.**
  Auslöser: „Die Einfügelinie blitzt beim Langdruck nur kurz auf." Die erste
  Änderung verkleinerte eine Toleranz – geraten, nicht gemessen. Falsch. Die
  zweite Runde hat auf dem Emulator gezählt (`gehoben`, `abgebrochen`,
  `uebernommen`) und die wirkliche Ursache gefunden. Messen heißt hier:
  `npm run android:emu:eval` auf dem laufenden Gerät, ein Zähler oder eine
  Ausgabe im Code, oder ein Test, der den Fall nachstellt. **Wenn nach einer
  Änderung dasselbe gemeldet wird, wird nicht erneut geraten.**
* **Mehrdeutige Anforderungen werden gefragt, nicht ausgelegt.** Auslöser: „Die
  Bereichsköpfe müssen verschiebbare Elemente werden." Umgesetzt wurde „Ziel",
  gemeint war „Ziel **und** umsortierbar". Ein Satz Rückfrage hätte einen
  ganzen Durchlauf gespart. Fragen kostet eine Minute, Raten einen Auftrag.

Dazu gehört die Reihenfolge: Ein Zug am Gerät oder ein Test gegen die echte
Ursache kommt **vor** dem nächsten Release, nicht danach.

### Bibliotheken: erst die Empfehlungen lesen, dann einbauen

Wer eine Bibliothek einsetzt, liest **vor** dem Einbau ihren Abschnitt
„Recommendations"/„Requirements" und hakt jede Empfehlung einzeln an der Stelle
ab, an der sie umgesetzt ist. Auslöser: Bei dnd-kit habe ich nur die API
uebernommen (`useSortable`, `DragOverlay`) und meine eigene Regel
`touch-action: pan-y` auf der Ziehflaeche mitgeschleppt. Die Dokumentation
verlangt `touch-action` auf **jedem** ziehbaren Element und dort `none`, wenn
nicht gescrollt werden soll – auf dem Telefon nahm der Browser die Geste
deshalb als Scrollen an, und das Ziehen brach nach Millimetern ab. Beim
tatsaechlichen Nachlesen kamen drei weitere uebergangene Empfehlungen heraus
(Messstrategie, Kollisionserkennung, Breite der schwebenden Kopie).
Kurz: Nicht „ich richte mich an der Bibliothek" heisst die API abschreiben,
sondern ihre Bedingungen einhalten.

### Keine Regex-Chirurgie an Markup

Aenderungen an JSX werden mit **exakten Textankern** gemacht (oder von Hand),
nicht mit regulaeren Ausdruecken ueber Tags. Auslöser: Ein Muster wie
`<button[^>]*>` endet am ersten `>` – bei `onClick={(event) => {` mitten im
Attribut. Die Datei war danach kaputt, und der Fehler fiel erst beim
Typecheck auf. Dasselbe gilt fuer mehrzeilige `replace`-Ketten: erst den
Treffer pruefen, dann schreiben.

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
* **Bei rotem Lauf zuerst `npm run ci:log`** (Log und Prüf-Vermerke der
  gescheiterten Jobs; `npm run ci:rerun` startet sie neu). Ohne Schlüssel geht
  `ci:status`. Ein lokaler Nachbau ist erst nötig, wenn das Log nichts hergibt –
  er kostet Minuten und beweist nur, dass es lokal läuft.
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
* **Ein neues Feld oder eine Migration braucht den Update-Weg in der Prüfung.**
  Tests legen ihre Daten mit dem *aktuellen* Code an – sie prüfen nur „frisch
  installiert". Dazu gehören zwei Fälle: eine Zeile **ohne** das neue Feld
  (`tests/e2e/update.spec.ts`, E2E 7, stellt sie her) und die tatsächlich
  eingespielte Migration (`npm run db:check`). Nach dem Veröffentlichen der
  Web-Fassung `npm run smoke:live`. Auslöser: der schwarze Bildschirm von
  0.18.0 (fehlendes `sections` in alten Zeilen) und der `PGRST204` danach
  (Migration nie eingespielt) – beide nur beim *Bestandsnutzer* sichtbar.
* **Erst `main` pushen, die CI abwarten, dann taggen.** Der Release-Workflow
  führt kein E2E aus, die CI tut es bei jedem Push auf `main`. Ist sie grün, ist
  E2E für genau den Commit bewiesen, aus dem die APK entsteht – und die Wartezeit
  kostet nichts, weil GitHub währenddessen arbeitet. Entfällt, wenn genau dieser
  App-Code schon einen grünen E2E-Lauf hat.
* **Warten ist kein Arbeitsschritt.** Der Nutzer wartet *mit*, wenn ein Auftrag
  auf einen grünen Lauf, ein Log oder einen Release-Bau blockiert. Deshalb:
  erst lokal `npm run ci` und die betroffenen E2E-Dateien (bzw. vor einem
  Release alle), dann handeln; die CI läuft als Rückversicherung im
  Hintergrund. Wer lokal dieselben Tore gesehen hat, muss nicht auf sie warten.
* **Ein Push je Auftrag, nicht je Änderung.** Jeder Push startet die volle
  Suite und veröffentlicht die Web-Fassung. Kleine Änderungen sammeln und am
  Ende des Auftrags in einem Zug pushen; reine Text-Änderungen (README, AGENTS,
  Kommentare) brauchen keinen Lauf – `[skip ci]` in die Commit-Nachricht, und
  lokal `npm run ci` genügt.

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
* **Der Upload entscheidet je Zeile, und abgelehnte Zeilen blockieren nichts.**
  `SyncTransport.push` gruppiert die Zeilenergebnisse je Tabelle; nur was angekommen
  ist, wird als hochgeladen markiert. Was der Server dauerhaft ablehnt, wandert
  nach ein paar Anläufen in ein Ablagefach (`syncStore`) und zählt nicht mehr als
  „warten“. Vorher war der Upload alles-oder-nichts: eine abgelehnte Zeile hielt
  den ganzen Bestand zurück, und der Zähler wurde nie leer. Auslöser:
  `DESIGN.md` §15.5 C1.
* **Cloud-Schreiben prüft die bestätigte Basis atomar.** `sync_push` prüft
  Benutzerrechte und Ausgangsstand unter Sperren; direkte App-Schreibrechte
  bleiben entzogen, auch beim Wiederholen der Sammelmigration. Die lokale
  Bestätigung vergleicht den vollständigen Inhalt. Geräteuhren entscheiden
  keinen Gewinner. Auslöser: Ein späterer alter Upload überschrieb einen
  neueren Cloudstand; Prüfungen in `cloudWrites.test.ts` und `npm run db:test`.
* **Die Datenschicht hat einen Bereich je Datei.** `src/db/repositories/`:
  `listen`, `aufgaben`, `mitglieder`, `einstellungen`, dazu `context.ts` für die
  gemeinsamen Helfer, `types.ts` für die Schnittstelle und `index.ts` als
  Zusammensetzung. Eine neue Methode gehört in ihren Bereich; nach außen bleibt
  `createRepositories` aus `src/db/repositories`. Auslöser: `DESIGN.md`
  §15.5 C3.
* **Jede Zeile geht durch den Leserand.** Neue Felder erreichen nicht alle
  Zeilen gleichzeitig (alte lokale Zeilen, ältere Geräte, fehlende Migration).
  `src/domain/normalize.ts` macht eine Zeile vollständig – beim Anwenden einer
  Serverantwort **und** beim Lesen aus der Datenbank. Wer danach `task.reminders`
  oder `list.sections` anfasst, braucht keine eigene Vorsicht mehr. Auslöser: der
  schwarze Bildschirm von 0.18.0 (`DESIGN.md` §15.5 C4).
* **Neue Felder stehen im Katalog.** `src/domain/fields.ts` führt die Felder je
  Entität; zur Übersetzungszeit ist die Vollständigkeit erzwungen, im Test die
  Übereinstimmung mit der Server-Umwandlung und den Migrationen. Vergisst man
  die Migration, scheitert jeder Abgleich mit `PGRST204`. Auslöser:
  `DESIGN.md` §15.5 C2.
* **Der Schlüssel-Wert-Speicher ist neutral, die Schlüssel gehören ihrem
  Schreiber.** Zugriffe über `src/db/metaStore.ts`; welche Schlüssel es gibt,
  weiß `repositories`, `reminderService` bzw. `syncStore`. Vorher lagen sie alle
  in `syncStore`, und `db` wie `reminders` hingen damit an der Sync-Schicht.
* **Die Sync-Engine verlangt nur `SyncTransport`** (`pull`/`push`); wer teilen
  will, braucht `ShareDirectory`. `RemoteGateway` ist die Summe für die
  Zusammensetzung, nicht die kleinste gemeinsame Schnittmenge. Auslöser:
  `DESIGN.md` §15.5 C7.
* **Lokale Eingabehilfen lösen keinen Abgleich aus.** Vorgemerkte Vorlaufzeiten
  und schon geteilte Adressen liegen nur lokal (`meta`) und werden nie
  hochgeladen. Wer sie wie eine Datenänderung zählt, lässt den Abgleich sich
  selbst anstoßen – die App synchronisiert dann im Sekundentakt. Deshalb hat
  `withChangeTracking` zwei Rückrufe, und `tests/e2e/shared-list.spec.ts`
  (E2E 5) zählt die Abrufe nach.
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
* Zeitstempel kommen vom Client; Konflikte werden über die bestätigte Basis
  entschieden. Ein Trigger darf `updated_at` nicht unbemerkt überschreiben.
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
Wenn die Arbeitsumgebung keinen KVM-Zugriff bietet, übernimmt der gezielte
CI-Lauf dieselbe Prüfung des tatsächlichen APK-Codes:
`gh workflow run ci.yml --ref <branch> -F android_smoke=true`.
Er prüft native Kernabläufe und liefert das Artefakt `android-smoke` mit
Telefonbildern in Hoch- und Querformat. Diese Bilder vor dem Tag herunterladen
und ansehen. Auslöser: Die lokale Software-Emulation startete Android zwar,
aber Systemdienst-Abstürze verhinderten eine belastbare Prüfung der App.

Der lokale Emulator läuft auf demselben Rechner. Ist eine Anzeige vorhanden (`DISPLAY`
gesetzt), erscheint sein Fenster auf dem Desktop und lässt sich wie ein Handy
bedienen; ohne Anzeige – etwa auf einem Server – startet das Skript ihn
fensterlos, und es bleibt der Screenshot zur Beurteilung.

```bash
npm run android:emu          # Emulator starten (mit Fenster, ohne Anzeige fensterlos)
npm run android:emu:install  # Debug-APK gegen den Mock bauen, installieren, öffnen
npm run android:emu:echt     # dasselbe gegen das echte Supabase-Projekt
npm run android:emu:shot     # Screenshot ablegen (Ziel siehe unten)
npm run android:emu:stop     # Emulator und Mock beenden

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
* **Zwei Ziele, ein Standard.** `android:emu:install` baut gegen den lokalen
  Mock: kein Konto, keine Daten im echten Projekt, beliebig wiederholbar. Das
  ist der Weg für die Frage „läuft die App, geht die Oberfläche?" – genau die,
  die 0.12.0 mit dem schwarzen Bildschirm beantwortet hat. `android:emu:echt`
  baut gegen das echte Projekt aus der privaten `.env` und ist für das da, was
  der Mock nicht beantworten kann: echte Anmeldung, echte Zugriffsregeln,
  Benachrichtigungen. Was dort entsteht, liegt dort wirklich.
* **Welches Ziel läuft, steht in der App** – Kopfzeile (breit) bzw. Menü,
  als `Mock · 127.0.0.1:54321` oder als Host des Projekts. Ohne diese Anzeige
  wäre nach einem Wechsel nicht erkennbar, wogegen man prüft; ein grüner Lauf
  gegen den Mock sagt nichts über die echten Zugriffsregeln.
* **Ein sauberer Mock-Lauf beginnt mit `adb shell pm clear de.krischi.prio`.**
  Sonst stehen lokale Daten aus einem früheren Lauf gegen einen leeren Mock –
  ein anderer Test als der, den man sehen will. Die Anmeldung ist dabei weg,
  im Mock aber in Sekunden neu erstellt.
* **Was der Emulator nicht kann:** echte Benachrichtigungszustellung, die
  Tastatur des Geräts, dessen Systemleisten und Hersteller-Eigenheiten. Dafür
  bleibt das echte Telefon nötig – aber nur dafür.
* Nach dem Test `android:emu:stop`, der Emulator belegt sonst CPU und RAM.
* **Anmeldung und Daten müssen erhalten bleiben.** Debug-Builds werden mit dem
  Release-Schlüssel signiert (`~/.prio-android/emulator.env`), und der
  Emulator benutzt einen dauerhaften Datenträger. Ein `adb uninstall` ist damit
  nie nötig – es würde die Anmeldung des Nutzers löschen. Ein bewusstes
  `pm clear` im Mock-Weg ist die Ausnahme, siehe oben.

## Oberfläche: eine Sprache, zwei Bedienmodelle

Es gibt zwei Ansichten – breit (Web/Tablet, Seitenleiste) und mobil (Telefon,
App-Leiste mit Menü). Sie dürfen sich im **Bedienmodell** unterscheiden, nicht
im **Aussehen**.

**Regel:** Gleiche Information wird gleich dargestellt und gleich formatiert –
unabhängig davon, in welcher Ansicht sie erscheint.

Konkret:

* **Farben, Schriftgrößen und Rundungen sind Rollen, keine Palettenwerte.** Die
  Werte stehen in `src/index.css` (`@theme`: `--color-ink-muted`, `--text-meta`,
  `--radius-card`); in Komponenten stehen nur die daraus erzeugten Klassen
  (`text-ink-muted`, `text-meta`, `rounded-card`) – keine Palettenschritte
  (`text-neutral-500`), keine Hex-Werte, keine Pixel-Schriftgrößen. Die
  Bedeutungen ordnet `src/ui/styles.ts` zu; Zustandsfarben gibt es genau einmal
  (`SyncTone → Farbe`). Durchgesetzt von `tests/unit/uiConventions.test.ts`, das
  ganz `src` liest. Auslöser: rund 230 Palettenschritte in 26 Dateien machten
  jeden zweiten Modus zum Umbau jeder Komponente (`DESIGN.md` §15.2 A2).
* **Knopfgrößen und -arten werden gewählt, nicht angehängt.** Statt
  `` `${ghostButton} px-2 py-1 text-xs` `` heißt es `buttonClass('ghost', 'sm')`.
  Grund: Tailwind ordnet die Utilities nach der Reihenfolge des **Stylesheets**,
  ein angehängtes `px-2` verdrängt das `px-3` der Konstante deshalb nicht – es
  wirkt schlicht nicht. So sind 22 „kompakte“ Knöpfe entstanden, die nie kompakt
  waren (nur ihre Schrift war kleiner). Angehängt werden dürfen weiterhin
  Layout-Klassen (Breite, Außenabstand, Ausrichtung); Größe, Farbe und Radius
  kommen aus der Variante. `tests/unit/uiConventions.test.ts` hält es fest.
  Auslöser: `DESIGN.md` §15.1 F3.
* **Dialoge und Blätter kommen aus den Bausteinen, nicht aus eigenem Markup.**
  `Sheet` (Blatt von unten, breit mittig), `Screen` (ganze Fläche) und
  `useDialog` (Verhalten: Rolle, Name, Escape, Zurück-Taste, Fokus) in
  `src/ui/components/`. Ein neuer Dialog ist eine Form plus Inhalt; Rahmen,
  Schleier, Fokusführung und Ebene (`layer.*`) sind schon da. Vorher war der
  Rahmen viermal von Hand geschrieben – eine Fassung hatte 70 % Höhe statt
  85 vh, eine keinen Namen für Vorleseprogramme, und Escape kannte nur einer.
  Auslöser: `DESIGN.md` §15.2 A4.
* **Die Ansicht entscheidet `useIsDesktop`, nicht `md:`.** Ein `md:` wäre eine
  zweite Schwelle (768 px), während die App die breite Ansicht erst ab 1024 px
  nimmt – ein Telefon im Querformat bekäme die mobile Ansicht mit
  Desktop-Klassen. Inhaltsraster (wie viele Kacheln nebeneinander passen) dürfen
  sich weiter nach der Breite richten; die **Ansicht** nicht. Auslöser:
  `DESIGN.md` §15.3 Z2.
* **Ansichtszustand liegt über der Verzweigung.** Welche Liste gewählt ist und
  was offen ist, gehört in `ViewProvider`/`useView` – nicht in beide Bäume.
  Sonst fällt die Auswahl beim Wechsel der Fensterbreite auf die erste Liste
  zurück, weil React den Baum austauscht (§15.3 Z3).
* **Der Arbeitsbereich ist eine React-freie Laufzeit.** Datenbank, Abgleich,
  Erinnerungen und Zeitgeber stecken in `createWorkspaceRuntime`
  (`src/app/workspaceRuntime.ts`); `WorkspaceProvider` öffnet sie und abonniert
  ihre Momentaufnahme (`useSyncExternalStore`). Eine Änderung an der Oberfläche
  muss diese Datei nicht mehr anfassen, und die Laufzeit ist ohne React
  prüfbar. Auslöser: `DESIGN.md` §15.4 B1.
* **Anzeigetexte gehören in die Oberfläche.** `src/sync`, `src/reminders`,
  `src/updates` und `src/auth` liefern Zustände (`kind`) und Daten – keine
  Sätze. Die Formulierungen stehen in `src/ui/status/`. Vorher trug die
  Sync-Engine die Offline-Meldung und die Statusmodule lagen in den
  Fachschichten. Auslöser: `DESIGN.md` §15.4 B2.
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
* **Der PWA-Weg hat einen eigenen Lauf.** `tests/e2e/pwa.spec.ts` ist ein
  eigenes Playwright-Projekt gegen den **Produktionsbuild** (`vite preview`),
  weil sich der Service Worker nur dort registriert. Er prüft, dass der Cache
  alles enthält, was das HTML zum Start braucht, und dass die App offline
  startet. Läuft bei `npm run test:e2e` mit; wer am Service Worker, am Manifest
  oder an `playwright.config.ts` arbeitet, sieht die Wirkung nur dort.
* Fehlschläge ernst nehmen: Wenn ein Test etwas aufdeckt, wird die Ursache
  behoben, nicht die Erwartung angepasst.

## Niemals committen

* `.env`, `*.keystore`, `*.jks`, `android/local.properties`
* Der `service_role`- bzw. Secret-Key gehört nicht in die App. Der Publishable
  Key ist öffentlich und darf (muss) im Bundle landen.
