# Arbeitsregeln für prio

Verbindlich für alle Änderungen in diesem Ordner. Die fachliche Dokumentation
steht in `README.md`, die der Datenbank in `supabase/README.md` – hier stehen
nur die Regeln, die man beim Arbeiten kennen muss.

## Repository

* Eigenes Git-Repository in `prio/`, **nicht** Teil des gemeinsamen
  Codex-Repos im übergeordneten Ordner.
* Remote: <https://github.com/krischimk/prio> (privat). `main` ist der stabile
  Branch, für Größeres `feature/…` bzw. `fix/…`.
* Commit-Nachrichten nach Conventional Commits, kleine thematische Commits.
* Version in `package.json` und das Release gehören zusammen: Version erhöhen,
  committen, Tag `v*` setzen und pushen. Der Release-Workflow baut und
  veröffentlicht die APK.

## Nach jeder Änderung

```bash
npm run ci          # Typecheck, Lint, Tests, Produktionsbuild
npm run test:e2e    # echter Browser gegen den Mock-Server
```

Beides muss grün sein. Bei Oberflächenänderungen zusätzlich in Telefongröße
rendern und die Screenshots **anschauen** (siehe Tests).

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

* **Migrationen sind append-only.** Eine bereits eingespielte Datei wird nicht
  nachträglich geändert; es kommt eine neue dazu (`0006_…`). Bestehende
  Datenbanken sollen sich durch erneutes Ausführen aktualisieren lassen.
* Migrationen sind wiederholbar (`if not exists`, `create or replace`,
  `drop policy if exists`) und laufen in einer Transaktion, wenn sie Policies
  anfassen.
* Neue Migrationen landen automatisch in der Sammeldatei (`npm run db:sql`).
* **Erst die Migration, dann die App-Version, die sie braucht.** Sendet die App
  eine Spalte, die es serverseitig nicht gibt, scheitert jeder Sync mit
  `PGRST204`.
* Row Level Security bleibt Pflicht. Neue Tabellen brauchen Policies **und**
  explizite `grant`s an `authenticated` – nicht auf die Vorgaben des Projekts
  verlassen.
* Zeitstempel kommen vom Client. Kein Trigger, der `updated_at` überschreibt –
  das würde Last Write Wins aushebeln.

## Android

* JDK 17–21 verwenden (das System-JDK ist zu neu für das Android Gradle Plugin).
* `.safe-top`/`.safe-bottom` **niemals** mit `py-*`/`px-*` auf demselben Element:
  Die Safe-Area-Klassen stehen ungelayert im CSS und überschreiben Tailwind.
* `.safe-bottom` bewusst ohne `env()`-Rückfall – bei sichtbarer Tastatur liefert
  `env(safe-area-inset-bottom)` falsche Werte.
* Der Service Worker wird in der App **nicht** registriert.
* Änderungen am Erscheinungsbild immer in Telefongröße gegenprüfen; das
  Querformat gehört dazu.

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
