# prio

**Offline-first To-do-App – Version 0.5.0 (technischer Prototyp).**

Ziel dieser Version ist ausdrücklich **kein fertiges Produkt**, sondern eine
schlanke Grundlage, mit der die Kernarchitektur zuverlässig getestet werden
kann: lokale Datenhaltung in IndexedDB, Cloud-Synchronisation mit Supabase,
Anmeldung per E-Mail und Passwort, gemeinsame Listen für mehrere Nutzer,
Installierbarkeit als PWA – und eine automatisierte Testsuite von Anfang an.

Die App arbeitet **primär lokal**. Supabase wird für Anmeldung und
Synchronisation gebraucht, ist aber zu keinem Zeitpunkt Voraussetzung für die
Bedienung: Fällt der Dienst aus, bleibt die App vollständig nutzbar und alle
Änderungen warten in der lokalen Sync-Queue.

```
┌──────────────────────────── Browser / Capacitor-WebView ────────────────────────────┐
│                                                                                     │
│   UI (React)                                                                        │
│      │  liest/schreibt                                                              │
│      ▼                                                                              │
│   Repositories (Geschäftslogik)  ──────────►  Sync-Queue = `dirty`-Flag an der Zeile │
│      │                                                                              │
│      ▼                                                                              │
│   Dexie / IndexedDB  ◄───── übernimmt ─────  Sync-Engine                            │
│      (Quelle der Wahrheit                     │        ▲                            │
│       für die Oberfläche)                     │ push   │ pull                       │
│                                               ▼        │                            │
│                                        RemoteGateway (Interface)                    │
│                                               │                                     │
└───────────────────────────────────────────────┼─────────────────────────────────────┘
                                                ▼
                                    Supabase (Auth + PostgreSQL mit RLS)
```

---

## Inhaltsverzeichnis

1. [Funktionsumfang](#funktionsumfang)
2. [Technischer Aufbau](#technischer-aufbau)
3. [Voraussetzungen](#voraussetzungen)
4. [Schnellstart (lokale Entwicklung)](#schnellstart-lokale-entwicklung)
5. [Supabase konfigurieren](#supabase-konfigurieren)
6. [Tests](#tests)
7. [Verfügbare Befehle](#verfügbare-befehle)
8. [Projektstruktur](#projektstruktur)
9. [Datenmodell](#datenmodell)
10. [Wie die Synchronisation funktioniert](#wie-die-synchronisation-funktioniert)
11. [Erinnerungen](#erinnerungen)
12. [Mobile Oberfläche](#mobile-oberfläche)
13. [Bewusste Entscheidungen und Grenzen von 0.1](#bewusste-entscheidungen-und-grenzen-von-01)
12. [Deployment (Cloudflare Pages)](#deployment-cloudflare-pages)
13. [Android-App (Capacitor)](#android-app-capacitor)
14. [Git-Workflow, Commits und Releases](#git-workflow-commits-und-releases)
15. [Definition of Done – Stand](#definition-of-done--stand)

---

## Funktionsumfang

### Benutzer

* Registrierung mit E-Mail und Passwort
* Anmeldung und Abmeldung
* Persistente Sitzung (die Sitzung liegt lokal und wird beim Start wiederverwendet)
* Nach der Anmeldung sieht jede Person ausschließlich ihre eigenen und die mit
  ihr geteilten Listen

### Listen

* Zwei Arten: **private Listen** und **gemeinsame Listen**
* Liste erstellen, umbenennen, löschen (löschen ist ein Soft Delete)
* Gemeinsame Listen: Besitzer lädt Mitglieder **per E-Mail-Adresse** ein und
  kann sie wieder entfernen
* Berechtigungen in 0.1: **Besitzer** (verwaltet die Liste und die Mitglieder)
  und **Mitglied** (darf Aufgaben lesen und bearbeiten)

### Aufgaben

* Felder: `id`, `list_id`, `title`, optionale `description`, optionales
  `due_at` (mit Uhrzeit), `completed`, `created_at`, `updated_at`, `deleted_at`
* Erstellen, bearbeiten, erledigen, in eine andere Liste verschieben, löschen
* Abgehakte Aufgaben verschwinden aus der Liste und sind sieben Tage lang unter
  *Einstellungen → Aufgaben wiederherstellen* auffindbar
* Nach dem Abhaken erscheint unten kurz eine Leiste mit „Rückgängig“
* Erinnerungen: Hat eine Aufgabe ein Fälligkeitsdatum in der Zukunft, plant
  die Android-App eine Benachrichtigung. Details unter
  [Erinnerungen](#erinnerungen)
* Bewusst nicht enthalten: Prioritäten, Tags, Unteraufgaben, Wiederholungen,
  Anhänge, Kommentare

### Offline und Synchronisation

* Alle Änderungen gehen zuerst in die lokale Datenbank und sind sofort sichtbar
* Nicht übertragene Änderungen sind als `dirty` markiert
* Synchronisation: erst hochladen, dann herunterladen, dann zusammenführen
* Löschungen werden als Soft Delete übertragen
* Konflikte: **Last Write Wins anhand `updated_at`** (bewusste Vereinfachung)
* Statusanzeige u. a.: „Offline – Änderungen werden später synchronisiert.“

### PWA

* Manifest, Icons und Service Worker
* Der Service Worker speichert **nur die Anwendung** (HTML/JS/CSS/Icons).
  Aufgaben und Listen liegen in IndexedDB und werden dort nicht angefasst;
  Aufrufe an Supabase werden gar nicht abgefangen.

---

## Technischer Aufbau

| Bereich | Umsetzung | Ort |
| --- | --- | --- |
| UI | React 19, Tailwind CSS 4, Dark Mode als einziger Modus | `src/ui`, `src/App.tsx` |
| Lokale Datenbank | Dexie 4 auf IndexedDB, eine Datenbank pro Benutzer | `src/db` |
| Geschäftslogik | Validierung, Soft Delete, `dirty`-Markierung | `src/db/repositories.ts` |
| Sync-Engine | Orchestrierung Push/Pull, Fehlerbehandlung, Status | `src/sync/syncEngine.ts` |
| Konfliktlogik | Last Write Wins, reine Funktion | `src/domain/merge.ts` |
| Cloud-Schnittstelle | Interface `RemoteGateway`, Implementierung mit Supabase | `src/sync/remoteGateway.ts`, `src/sync/supabaseGateway.ts` |
| Auth | Interface `AuthPort`, Implementierung mit Supabase Auth | `src/auth` |
| Datenbanksicherheit | Row Level Security, SQL-Migrationen | `supabase/migrations` |
| PWA | Manifest, Icons, Service Worker | `public` |

**Wichtige Trennlinie:** Die Sync-Engine kennt weder React noch Supabase. Sie
arbeitet gegen das Interface `RemoteGateway` und eine Dexie-Datenbank. Deshalb
laufen alle Sync-Tests gegen einen In-Memory-Server, und ein Wechsel des
Backends würde nur `supabaseGateway.ts` betreffen.

**Keine zusätzlichen Bibliotheken für:** Zustandsverwaltung (React-Kontext plus
ein Änderungszähler genügt), Datumsformatierung (Intl), PWA-Build (Service
Worker ist handgeschrieben), Testserver (nur `node:http`).

---

## Voraussetzungen

* **Node.js ≥ 22.12** (entwickelt und getestet mit Node 26)
* **npm** (Lockfile ist eingecheckt)
* Optional: **Supabase-Konto** für echte Cloud-Synchronisation. Für Tests und
  die reine Offline-Nutzung ist kein Konto nötig.
* Optional: **Supabase CLI** zum Anwenden der Migrationen

---

## Schnellstart (lokale Entwicklung)

```bash
# 1. Repository klonen
git clone https://github.com/krischimk/prio.git
cd prio

# 2. Abhängigkeiten installieren
npm install

# 3. .env aus der Vorlage erstellen und ausfüllen
cp .env.example .env
#    VITE_SUPABASE_URL=...
#    VITE_SUPABASE_PUBLISHABLE_KEY=...

# 4. Datenbankmigrationen anwenden (siehe nächster Abschnitt)

# 5. Entwicklungsserver starten
npm run dev            # http://localhost:5173
```

Ohne `.env` startet die App ebenfalls, zeigt dann aber einen Hinweis, dass
Supabase noch nicht konfiguriert ist.

---

## Supabase konfigurieren

1. **Projekt anlegen** auf <https://supabase.com/dashboard>.
2. **Zugangsdaten kopieren:** *Project Settings → API Keys* → Tab
   **„Publishable and secret API keys"**
   * `Project URL` → `VITE_SUPABASE_URL`
   * **Publishable key** (`sb_publishable_…`) → `VITE_SUPABASE_PUBLISHABLE_KEY`

   > **Nicht** den Tab „Legacy anon, service_role API keys" verwenden. Supabase
   > schafft `anon` und `service_role` bis Ende 2026 ab; der Publishable Key ist
   > der direkte Ersatz für `anon` mit identischen Rechten.
   >
   > Der **Secret key** (`sb_secret_…`, früher `service_role`) darf
   > **niemals** in `.env` oder ins Repository. Er umgeht jede
   > Sicherheitsregel und wird von dieser App nicht benötigt.
   >
   > Der alte Variablenname `VITE_SUPABASE_ANON_KEY` wird weiterhin
   > akzeptiert, falls du noch einen Legacy-Key im Einsatz hast.

3. **Migrationen anwenden.** Zwei Wege:

   **a) SQL-Editor** (ohne CLI): die Dateien in `supabase/migrations/` in
   Reihenfolge des Dateinamens vollständig einfügen und ausführen (aktuell
   `0001` bis `0005`). Am einfachsten die Sammeldatei (siehe unten).

   Einfacher geht es mit der Sammeldatei – ein einziger Einfüge-Vorgang:

   ```bash
   npm run db:sql   # erzeugt supabase/all-migrations.sql
   ```

   Dann den kompletten Inhalt von `supabase/all-migrations.sql` in den
   SQL-Editor einfügen und einmal ausführen.

   **b) Supabase CLI:**

   ```bash
   supabase link --project-ref <projekt-id>
   supabase db push
   ```

4. **E-Mail-Anmeldung prüfen:** *Authentication → Providers → Email* muss aktiv
   sein. Für schnelles Ausprobieren ist es praktisch, *Confirm email*
   abzuschalten – sonst muss nach der Registrierung erst die E-Mail bestätigt
   werden (die App weist darauf hin).

5. **Row Level Security ist Pflicht.** Die Migrationen aktivieren sie und legen
   alle Policies an. Ohne sie könnte jeder angemeldete Nutzer alle Daten lesen.

Details zu den Policies und zu den Hinweisen des Supabase Security Advisors:
[`supabase/README.md`](supabase/README.md).

---

## Tests

Die Testsuite ist bewusst dreigeteilt und läuft vollständig **ohne Cloud und
ohne Secrets**.

```bash
npm test                 # Unit- und Integrationstests (Vitest)
npm run test:unit        # nur Unit-Tests
npm run test:integration # nur Integrationstests
npm run test:e2e         # E2E im echten Browser (Playwright, startet Mock-Server)

npm run test:watch       # Vitest im Watch-Modus
```

**Beim ersten E2E-Lauf** wird ein Browser benötigt:

```bash
npx playwright install chromium
```

### Unit-Tests (`tests/unit`)

| Datei | Inhalt |
| --- | --- |
| `merge.test.ts` | Last-Write-Wins in allen Varianten inkl. Soft Delete |
| `mapping.test.ts` | Umwandlung lokal ↔ Supabase, Zeitstempel-Normalisierung |
| `repositories.test.ts` | Aufgabe erstellen/bearbeiten/erledigen/löschen, Listen, Mitglieder, `dirty`-Markierung |
| `syncStore.test.ts` | Aufbau und Bereinigung lokaler Sync-Einträge |
| `syncStatus.test.ts` | Texte der Statusanzeige, u. a. die Offline-Meldung |
| `supabaseGateway.test.ts` | Supabase-Zugriffe gegen einen gemockten Client, Fehlerklassifikation |

### Integrationstests (`tests/integration`)

| Datei | Inhalt |
| --- | --- |
| `syncScenarios.test.ts` | Die Szenarien 1–6 aus der Aufgabe (offline erstellen, online hochladen, Serverausfall, Serverversion neuer, lokale Version neuer, offline löschen) |
| `multiDevice.test.ts` | Gerät A → Gerät B → Bearbeitung zurück → Konfliktfall → Löschung |
| `sharedLists.test.ts` | Gemeinsame Liste: teilen, Aufgaben beider Seiten, Mitglied entfernen, unberechtigte Änderung |
| `appFlow.test.tsx` | Die echte App in jsdom: Registrieren, Liste anlegen, Aufgabe speichern, Sync auslösen, Serveränderung übernehmen, Offline-Zustand |

Alle Integrationstests nutzen **echtes Dexie** über `fake-indexeddb` und einen
In-Memory-Ersatz für Supabase, der auch die RLS-Sichtbarkeitsregeln nachbildet.

### E2E-Tests (`tests/e2e`)

| Test | Inhalt |
| --- | --- |
| `tasks.spec.ts` | E2E 1: registrieren, Aufgabe erstellen und sehen; erneut anmelden; E2E 2: bearbeiten, erledigen, löschen |
| `offline.spec.ts` | E2E 3: Netzwerk aus, Aufgabe erstellen, Netzwerk an, Sync, zweites Gerät sieht die Aufgabe |
| `shared-list.spec.ts` | E2E 4: A teilt mit B, B erstellt Aufgabe, A sieht sie; E2E 4b: B wird entfernt und verliert den Zugriff |

Die E2E-Tests starten automatisch zwei Server:

* `tests/mock-supabase/server.mjs` – Mock von GoTrue (Auth) und PostgREST
  inklusive RPC und RLS-Regeln, ohne Abhängigkeiten, nur `node:http`
* den Vite-Dev-Server mit Zeiger auf diesen Mock

Damit laufen die Tests gegen den **echten** Supabase-Client und echte
HTTP-Aufrufe – aber ohne Cloud.

---

## Verfügbare Befehle

| Befehl | Zweck |
| --- | --- |
| `npm run dev` | Entwicklungsserver mit Hot Reload |
| `npm run build` | Typecheck + Produktionsbuild nach `dist/` |
| `npm run preview` | Produktionsbuild lokal ansehen |
| `npm run typecheck` | TypeScript prüfen (`tsc -b`) |
| `npm run lint` | Linting mit oxlint |
| `npm test` | Unit- und Integrationstests |
| `npm run test:e2e` | E2E-Tests |
| `npm run icons` | PWA-Icons neu erzeugen |
| `npm run db:sql` | Die drei Migrationen zu `supabase/all-migrations.sql` zusammenfügen (für den SQL-Editor) |
| `npm run android:sync` | Web-Bundle bauen und ins Android-Projekt kopieren |
| `npm run android:apk` | Debug-APK für Android bauen |
| `npm run android:release` | Signierte Release-APK bauen (braucht den Keystore) |
| `npm run ci` | Typecheck, Lint, Tests und Build in einem Durchlauf |

---

## Projektstruktur

```
prio/
├── .github/workflows/ci.yml        CI-Pipeline (Typecheck, Lint, Tests, Build, E2E)
├── public/
│   ├── manifest.webmanifest        PWA-Manifest
│   ├── sw.js                       Service Worker (nur App-Shell, keine Daten!)
│   ├── favicon.svg
│   └── icons/                      generierte PNG-Icons
├── scripts/generate-icons.mjs      erzeugt die Icons ohne Bildbibliothek
├── src/
│   ├── app/                        Zusammensetzung: Services, Provider, Hooks
│   ├── auth/                       AuthPort, Supabase-Umsetzung, AuthProvider
│   ├── db/                         Dexie-Schema, Repositories (Geschäftslogik)
│   ├── domain/                     Typen, Mapping, Konfliktlogik, IDs, Uhr
│   ├── pwa/                        Registrierung des Service Workers
│   ├── sync/                       Sync-Engine, Gateways, Queue-Helfer, Status
│   ├── ui/                         React-Komponenten (Dark Mode)
│   │   └── mobile/                 eigene Ansicht für Telefone
│   ├── App.tsx                     Wurzelkomponente
│   └── main.tsx                    Einstiegspunkt, setzt die Services zusammen
├── supabase/migrations/            SQL-Migrationen inkl. RLS
├── tests/
│   ├── unit/                       Unit-Tests
│   ├── integration/                Integrations- und Szenariotests
│   ├── e2e/                        Playwright-Tests
│   ├── mock-supabase/server.mjs    Mock für Auth + PostgREST
│   └── support/                    Fakes, Fabriken, Harness
├── .env.example                    Vorlage für die Umgebungsvariablen
└── README.md
```

---

## Datenmodell

Lokal (Dexie) und in der Cloud (PostgreSQL) gibt es dieselben drei Entitäten.
Der einzige Unterschied: lokal existiert zusätzlich das Feld `dirty`.

```ts
interface Task {
  id: string            // UUID, auf dem Client erzeugt
  list_id: string
  title: string
  description: string | null
  due_at: string | null // ISO-8601 mit Uhrzeit (UTC) – Basis für spätere Erinnerungen
  completed: boolean
  created_at: string
  updated_at: string    // Grundlage für Last Write Wins
  deleted_at: string | null // Soft Delete
  dirty?: 0 | 1         // nur lokal: noch nicht hochgeladen
}
```

`lists` ergänzt `owner_id` und `is_shared`; `list_members` hat den
zusammengesetzten Schlüssel `(list_id, user_id)`. Eine Mitgliedschaft bedeutet
immer „Mitglied“ – der Besitzer ergibt sich aus `lists.owner_id`.

**Lokale Datenbank pro Benutzer** (`prio-user-<uuid>`): Meldet sich auf einem
Gerät ein anderes Konto an, entstehen keine Vermischungen und der Sync kann
niemals fremde, noch nicht hochgeladene Datensätze übertragen.

---

## Wie die Synchronisation funktioniert

Ein Durchlauf (`src/sync/syncEngine.ts`):

1. **Offline?** Dann sofort abbrechen – es wird nichts angefasst.
2. **Push:** alle Zeilen mit `dirty = 1` sammeln und per Upsert hochladen
   (Reihenfolge: Listen → Mitgliedschaften → Aufgaben).
3. **Aufräumen:** erfolgreich übertragene Zeilen als sauber markieren – aber nur,
   wenn sie sich währenddessen nicht erneut geändert haben.
4. **Pull:** den sichtbaren Serverbestand vollständig herunterladen.
5. **Merge:** pro Datensatz entscheidet `resolveMerge` (siehe `src/domain/merge.ts`):
   * kein lokaler Datensatz → Serverversion übernehmen
   * lokale Version jünger → lokal behalten und hochladen
   * Serverversion jünger → Serverversion übernehmen
   * gleicher Zeitstempel → die noch nicht hochgeladene lokale Änderung gewinnt

Erst pushen, dann pullen: Dadurch gewinnt bei gleichem Zeitstempel die lokale
Änderung, weil sie bereits auf dem Server liegt.

Ausgelöst wird ein Sync:

* einmal direkt nach dem Anmelden,
* 400 ms nach jeder lokalen Änderung (entprellt),
* alle 30 Sekunden,
* sobald das Gerät wieder online ist,
* und jederzeit über „Jetzt synchronisieren“.

**Entfernte Mitglieder:** Wer aus einer gemeinsamen Liste entfernt wird, erfährt
davon über die eigene, soft-gelöschte Mitgliedschaftszeile. Die lokale Kopie der
fremden Liste wird daraufhin vollständig entfernt – sie gehört dem Benutzer
nicht, und jede weitere Schreiboperation würde der Server ohnehin ablehnen.
Wird dieselbe Person später erneut hinzugefügt, kommen die Daten beim nächsten
Sync frisch vom Server zurück.

---

## Erinnerungen

Hat eine Aufgabe ein Fälligkeitsdatum mit Uhrzeit in der Zukunft, plant die
Android-App eine Benachrichtigung. Sie kommt auch an, wenn die App geschlossen
ist – die Termine liegen beim Betriebssystem (Android: AlarmManager), nicht in
einem Timer der Web-Oberfläche.

### Wie es funktioniert

| Datei | Aufgabe |
| --- | --- |
| `src/reminders/reminderPlan.ts` | Reine Funktion: Welche Aufgaben sollen erinnern? |
| `src/reminders/reminderReconciler.ts` | Reine Funktion: Was muss geplant, verschoben, abgebrochen werden? |
| `src/reminders/localNotificationsPort.ts` | Schnittstelle zu den Benachrichtigungen des Systems |
| `src/reminders/capacitorNotifications.ts` | Umsetzung mit `@capacitor/local-notifications` |
| `src/reminders/reminderService.ts` | Ablauf: Berechtigung, lesen, abgleichen, schreiben |

Der Abgleich läuft nach jedem Sync, nach jeder lokalen Änderung und beim Start.
Er ist **idempotent**: Unveränderte Termine werden nicht angefasst, ein zweiter
Lauf berührt das Betriebssystem gar nicht.

Geplant wird, wenn eine Aufgabe

* nicht gelöscht und nicht erledigt ist,
* ein Fälligkeitsdatum hat und
* dieses in der Zukunft liegt.

Wird eine Aufgabe erledigt, gelöscht oder ihr Datum entfernt, wird die
Erinnerung abgebrochen. Wird ein Datum verschoben, wird der Termin unter
derselben Nummer neu geplant.

### Grenzen

* **Zustellung kann sich verzögern.** Die App fordert bewusst keine Berechtigung
  für *exakte* Alarme an (`SCHEDULE_EXACT_ALARM` verlangt auf Android 12+ einen
  Umweg über die Systemeinstellungen). Im Energiesparmodus kann eine Erinnerung
  deshalb um einige Minuten später kommen. Für Aufgaben ist das vertretbar.
* **Vergangene Termine lösen nichts aus.** Eine Aufgabe, die während einer
  Offline-Phase fällig geworden ist, erzeugt beim nächsten Start keine
  Benachrichtigung – das wäre Lärm statt Nutzung.
* **Erinnerungen sind lokal.** Sie werden nicht synchronisiert. Jedes Gerät
  plant die Erinnerungen für seine eigenen Aufgaben.
* **Nach einem Geräteneustart** stellt Android die Termine selbst wieder her
  (`LocalNotificationRestoreReceiver`).

## Mobile Oberfläche

Auf Bildschirmen unter 768 px zeigt die App eine eigene, für das Telefon
gebaute Ansicht. Ab 768 px bleibt die breite Ansicht mit Seitenleiste.

```
┌──────────────────────────────┐
│ ☰        Haushalt          ● │  ← App-Leiste: Menü, Liste, Sync-Zustand
├──────────────────────────────┤
│ 2 offene Aufgaben   3 gesamt │
│ ☐  Rechnung Strom bezahlen   │
│    Abschlag Q2               │  ← Titel, darunter Beschreibung,
│    15.02.2027, 18:30         │    darunter Fälligkeit
│ ☑  Wohnung saugen            │
├──────────────────────────────┤
│             (+)              │  ← neuer Eintrag
└──────────────────────────────┘
```

**Bedienung**

| Geste | Wirkung |
| --- | --- |
| Tippen auf eine Aufgabe | Detailansicht: bearbeiten, erledigt, verschieben, löschen |
| **Gedrückt halten und ziehen** | Aufgabe innerhalb der Liste umsortieren |
| Tippen auf die Checkbox | erledigt / wieder offen – ohne die Detailansicht zu öffnen |
| ☰ oben links | Menü mit Listen, Konto, Sync-Zustand und Erinnerungen |
| Punkt oben rechts | Sync-Zustand; Antippen synchronisiert sofort |
| Zurück-Taste | schließt zuerst Detailansicht oder Menü, sonst Hintergrund |

In der Liste selbst gibt es **keine** Bedienelemente und **keine** Gesten außer
dem Antippen: keine Bearbeiten- oder Löschen-Knöpfe, kein Kontextmenü. Die
Zeile ist der Knopf. Alles Weitere – auch das Verschieben in eine andere Liste –
liegt gebündelt in der Detailansicht.

### Erledigen und Wiederherstellen

Abhaken lässt die Aufgabe sofort aus der Liste verschwinden – in beiden
Ansichten. Damit ein versehentliches Abhaken nicht ärgerlich wird, gibt es zwei
Wege zurück:

* **Die Leiste unten** erscheint direkt nach dem Abhaken für fünf Sekunden mit
  einem „Rückgängig“-Knopf. Hakst du mehrere Aufgaben kurz hintereinander ab,
  zeigt sie die zuletzt abgehakte.
* **Einstellungen → Aufgaben wiederherstellen** zeigt alles, was in den letzten
  **sieben Tagen** abgehakt wurde, zuletzt abgehaktes zuerst, mit der Liste und
  dem Zeitpunkt. Auf dem Telefon über das Menü, in der breiten Ansicht über
  „Wiederherstellen“ im Kopfbereich.

Grundlage ist das Feld `completed_at`: Es wird beim Abhaken gesetzt und beim
Wiederöffnen wieder geleert (`setTaskCompleted` in `src/db/repositories.ts`).
Das Fenster ist `RESTORE_WINDOW_DAYS` an derselben Stelle.

Nach den sieben Tagen ist eine Aufgabe **nicht gelöscht**, nur nicht mehr über
die Oberfläche erreichbar. Sie bleibt in der Datenbank und wird weiterhin
synchronisiert.

> **Wiederkehrende Aufgaben** gibt es noch nicht. Sobald sie dazukommen, gilt
> zusätzlich: Eine wiederkehrende Aufgabe bleibt nur so lange im
> Wiederherstellen-Fenster, bis ihr Nachfolger existiert. Das ist dann eine
> Ergänzung im Filter von `listRestorableTasks`.

### Reihenfolge

Die Reihenfolge steckt im Feld `position` der Aufgabe und wird mitsynchronisiert –
sonst wäre sie nach dem nächsten Abgleich wieder weg. Neue Aufgaben bekommen die
höchste Position und landen unten.

**Umsortieren:** Zeile gedrückt halten (rund 0,4 s), dann ziehen. Eine blaue
Linie zeigt, wo die Aufgabe landen würde. Bewegt sich der Finger vorher um mehr
als zehn Pixel, war es ein Wischversuch und die Liste scrollt wie gewohnt.

Beim Umsortieren werden die Positionen der betroffenen Liste auf 1 … n
neu vergeben (`reorderTasks`). Geschrieben werden nur Aufgaben, deren Position
sich tatsächlich ändert – der Rest bleibt unangetastet und wird auch nicht
erneut hochgeladen.

Datensätze aus der Zeit vor dieser Funktion haben die Position 0. Bei
Gleichstand greifen die früheren Regeln (Erledigt-Status, Fälligkeit,
Erstellzeit), damit eine bestehende Liste nach dem Update stabil bleibt.

**Systemleisten (Edge-to-Edge).** Android 15+ erzwingt Edge-to-Edge für Apps ab
`targetSdk 35`. Die App aktiviert deshalb in `MainActivity.onCreate`
`EdgeToEdge.enable(this)` und hält über die CSS-Klassen `.safe-top`/`.safe-bottom`
Abstand zu Status- und Navigationsleiste. Capacitor setzt dafür bei
`insetsHandling: 'css'` die Variablen `--safe-area-inset-*`; der Web-Standard
`env(safe-area-inset-*)` wird zusätzlich abgefragt, weil er in Android-WebViews
vor Version 140 falsche Werte liefert ([Chromium-Bug 40699457](https://issues.chromium.org/issues/40699457)).

> **Nicht kombinieren:** `.safe-*` steht ungelayert im CSS und überschreibt
> Tailwinds `py-*`/`px-*`. Beide auf demselben Element heißt: der Abstand fällt
> auf 0. Deshalb nie `className="safe-bottom py-4"` schreiben.

**Tastatur.** Zwei Fallen, beide behoben:

1. `interactive-widget=overlays-content` im Viewport-Meta (`index.html`).
   Capacitor verkleinert die Ansicht bereits selbst um die Tastaturhöhe
   (`SystemBars` setzt Padding auf die DecorView). Die Android-WebView tut das
   standardmäßig zusätzlich – der Inhalt würde zweimal verkleinert.
2. `.safe-bottom` verwendet **kein** `env(safe-area-inset-bottom)` als Rückfall.
   Dieser Wert ist bei sichtbarer Tastatur falsch und liefert statt der
   Navigationsleiste die Tastaturhöhe
   ([Chromium-Bug 457682720](https://issues.chromium.org/issues/457682720)).
   Capacitor setzt die Variable bei sichtbarer Tastatur korrekt auf 0.

**Fensterhintergrund muss dunkel sein.** Capacitor legt bei WebViews vor
Version 140 selbst Padding um die Ansicht, damit der Inhalt nicht unter den
Systemleisten liegt. Der freie Streifen zeigt den Fensterhintergrund. Erbt das
Theme dabei von `Theme.AppCompat.Light` oder `DayNight`, ist dieser Streifen
**weiß** und liegt als heller Balken über der App-Leiste. Deshalb setzen
`AppTheme.NoActionBar` und `AppTheme.NoActionBarLaunch` in
`android/app/src/main/res/values/styles.xml` explizit
`android:windowBackground` und `windowSplashScreenBackground` auf
`@color/prioBackground`. Das Start-Theme erbt bewusst **nicht** mehr von
`Light.DarkActionBar`.

## Bewusste Entscheidungen und Grenzen von 0.1

Diese Punkte sind Absicht, nicht Versehen. Sie sind auch im Code an der
jeweiligen Stelle kommentiert.

1. **Last Write Wins anhand von Client-Zeitstempeln.** Bearbeiten zwei Geräte
   denselben Datensatz, geht die ältere Änderung verloren. Zusätzlich ist die
   Uhr des Geräts die Konfliktquelle: Geht eine Uhr falsch, gewinnt dieses
   Gerät dauerhaft. Keine CRDTs, kein 3-Wege-Merge, kein Feld-Merge.
   *Ausbau:* Server-Zeitstempel oder Versionsnummer pro Zeile – betrifft nur
   `src/domain/merge.ts` und die Spalten.

2. **Vollständiger Pull statt Delta.** Ein inkrementeller Sync über
   `updated_at > cursor` hätte eine heikle Lücke: Wird jemand zu einer bereits
   existierenden Liste hinzugefügt, deren `updated_at` älter ist als der Cursor,
   würde die Liste nie nachgeladen. Bei den kleinen Datenmengen eines Prototyps
   ist der vollständige Pull die robustere und deutlich einfachere Variante.

3. **`updated_at` kommt vom Client, nicht aus einem Trigger.** Sonst wäre der
   Server immer „neuer“ und lokale Änderungen könnten nie gewinnen.

4. **Teilen erfordert eine Verbindung.** Nur der Server kennt die Zuordnung
   E-Mail → Benutzer-ID. Vor dem Teilen wird deshalb erst synchronisiert, damit
   die Liste auf dem Server existiert. Das *Entfernen* eines Mitglieds
   funktioniert dagegen auch offline, weil die Mitgliedschaftszeile lokal
   vorliegt.

5. **Mitglieder werden ohne E-Mail-Adresse angezeigt.** E-Mail-Adressen anderer
   Nutzer werden nicht synchronisiert (Datensparsamkeit); die Oberfläche zeigt
   deshalb eine Kurzform der Benutzer-ID.

6. **Abgelehnte Zeilen bleiben in der Queue.** Lehnt der Server einen Datensatz
   dauerhaft ab (z. B. weil der Zugriff auf eine gemeinsame Liste entzogen
   wurde), bleibt er `dirty` und wird bei jedem Sync erneut versucht. Es geht
   nichts verloren; schöner wäre ein getrenntes Ablagefach für solche Fälle.

7. **Keine Echtzeit.** Änderungen erscheinen auf anderen Geräten erst beim
   nächsten Sync. Supabase Realtime ist bewusst nicht eingebunden.

8. **Kein Hard Delete.** Gelöschte Zeilen bleiben als Tombstone erhalten.
   Ein Aufräumen alter Tombstones fehlt noch.

9. **Der Service Worker cached keine Daten.** Er behandelt ausschließlich
   Anfragen an die eigene Herkunft. Würde er Supabase-Antworten cachen, käme
   veralteter Cloud-Zustand zurück – genau das würde die Sync-Logik brechen.

10. **`react/set-state-in-effect` ist abgeschaltet** (`.oxlintrc.json`). Die
    Effekte in `WorkspaceProvider` und `AuthProvider` spiegeln den Zustand
    externer Systeme (IndexedDB, Netzwerk, Auth) nach React – ein legitimer
    Einsatz von Effekten, den die Regel pauschal meldet.

11. **Bekannte Kleinigkeiten:** Die Datenbankverbindung bleibt beim Abmelden
    geöffnet (die Daten bleiben lokal erhalten, das ist gewollt). Das
    Produktionsbundle ist rund 570 kB groß, überwiegend `@supabase/supabase-js`;
    Code-Splitting wäre der nächste Schritt, ist für 0.1 aber ohne Nutzen.

---

## Deployment (Cloudflare Pages)

Geplantes Hosting ist Cloudflare Pages:

| Einstellung | Wert |
| --- | --- |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Node-Version | ≥ 22.12 (z. B. `NODE_VERSION=24`) |
| Umgebungsvariablen | `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` |

Die Variablen müssen **zur Build-Zeit** gesetzt sein – Vite schreibt sie in das
Bundle. Der Publishable Key ist dafür vorgesehen und öffentlich; der Schutz
kommt aus den RLS-Policies.

Für eine Single-Page-App ohne eigene Routen ist kein SPA-Fallback nötig; die App
läuft unter `/`. Der Service Worker wird nur bei einem Produktionsbuild
registriert.

---

## Android-App (Capacitor)

Capacitor ist eingerichtet; die Web-App wird als `dist/` in eine Android-App
verpackt und im WebView geladen.

### Voraussetzungen auf dem Rechner

| | Anforderung | Warum |
| --- | --- | --- |
| JDK | **17 – 21** | Das Android Gradle Plugin 8.13 unterstützt kein JDK 22+. Ein zu neues System-JDK führt zu „Unsupported class file major version". |
| Android SDK | Platform **36**, Build-Tools **36.0.0**, Platform-Tools | `android/variables.gradle` legt `compileSdk = 36` fest. |
| Gradle | wird vom Wrapper selbst geladen (8.14.3) | – |

Damit Gradle ohne Umgebungsvariablen das richtige JDK nimmt, genügt ein Eintrag
in der **benutzereigenen** Gradle-Konfiguration (nicht im Repository):

```properties
# ~/.gradle/gradle.properties
org.gradle.java.home=/usr/lib/jvm/java-21-openjdk
```

Das SDK wird über `android/local.properties` gefunden (auch nicht versioniert):

```properties
sdk.dir=/home/<benutzer>/Android/Sdk
```

### Bauen

```bash
npm run android:apk
```

Das baut das Web-Bundle, kopiert es in das Android-Projekt und ruft Gradle auf.
Ergebnis:

```
android/app/build/outputs/apk/debug/app-debug.apk
```

Einzelne Schritte, falls du sie getrennt brauchst:

```bash
npm run build          # Web-Bundle nach dist/
npx cap sync android   # dist/ + Plugins ins Android-Projekt kopieren
cd android && ./gradlew assembleDebug
```

### Aufs Handy bringen

**Per USB** (USB-Debugging aktivieren, Handy anschließen):

```bash
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

**Ohne Kabel:** die APK aufs Handy kopieren, antippen und „Installation aus
unbekannten Quellen" für die Datei-App erlauben.

Es ist eine **Debug-APK** – für den eigenen Gebrauch völlig ausreichend. Der
bequemere Weg ist aber der Download über die GitHub-Releases (siehe unten); dort
gibt es eine signierte Release-APK.

### APK-Releases über GitHub

Jede neue Version entsteht durch einen Tag. GitHub baut und veröffentlicht die
APK dann automatisch:

```bash
git tag -a v0.2.0 -m "prio 0.2.0"
git push origin v0.2.0
```

Nach etwa zwei Minuten liegt `prio-0.2.0.apk` unter **Releases** im Repository
und lässt sich direkt am Handy herunterladen. Der Workflow
(`.github/workflows/release.yml`) prüft zuerst Typecheck, Linting und Tests,
baut dann das Web-Bundle, signiert die APK und erstellt das Release. Ein
fehlschlagender Test verhindert die Veröffentlichung. Über
*Actions → Release → Run workflow* lässt sich die APK auch ohne Tag probeweise
bauen; sie landet dann nur als Artefakt und nicht als Release.

**Signatur – wichtig zu wissen.** Android lässt ein Update nur zu, wenn die
Signatur zur bereits installierten App passt. Deshalb wird nicht mit der
flüchtigen Debug-Signatur gearbeitet, sondern mit einem festen Schlüssel:

| | |
| --- | --- |
| Keystore | `~/.prio-android/prio-release.keystore` |
| Zugangsdaten | `~/.prio-android/ZUGANGSDATEN.txt` |
| GitHub-Secrets | `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD` |

Geht der Keystore verloren, lässt sich keine neue Version mehr über die
installierte App legen – sie müsste zuerst deinstalliert werden (die Daten
kommen danach aus der Cloud zurück). Den Ordner also sichern. Der Keystore ist
über `.gitignore` ausgeschlossen und darf nie ins Repository.

`versionName` entspricht dem Tag ohne führendes `v`, `versionCode` kommt aus der
Workflow-Laufnummer und ist damit bei jedem Release höher.

> **Debug-APK und Release-APK sind unterschiedlich signiert.** Wer zuerst die
> lokal gebaute Debug-APK installiert hat, muss sie einmal deinstallieren, bevor
> sich die Release-APK aus GitHub installieren lässt. Danach funktionieren alle
> weiteren Releases als normales Update.

**Voraussetzung im Repository.** Vite schreibt die Supabase-Konfiguration zur
Build-Zeit in das Bundle. Im CI gibt es keine `.env`, deshalb müssen beide Werte
als **Repository-Variablen** hinterlegt sein (*Settings → Secrets and variables
→ Actions → Variables*). Beide sind öffentlich und stecken ohnehin in jeder
ausgelieferten App:

| Variable | Wert |
| --- | --- |
| `VITE_SUPABASE_URL` | `https://<projekt-id>.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_…` |

Der Workflow bricht mit einer klaren Meldung ab, wenn ein Wert fehlt oder nicht
im Bundle landet – lieber kein Release als eine App, die nicht synchronisieren
kann.

### Was für Capacitor angepasst wurde

* **Service Worker wird in der App nicht registriert.** Capacitor liefert die
  Dateien unter `https://localhost` aus; ein Service Worker würde dort nach
  einem App-Update veraltete Dateien aus dem Cache weiterreichen.
* **`androidScheme: 'https'`** – Supabase erlaubt genau diese Herkunft per CORS
  (geprüft), und ein sicherer Kontext ist Voraussetzung für
  `crypto.randomUUID` und `navigator.onLine`.
* **`detectSessionInUrl: false`** war bereits gesetzt, deshalb braucht die App
  keine Deep-Link-Behandlung für Magic-Links.
* **Die Sitzung liegt in `localStorage`** und übersteht damit App-Neustarts.
* **Systemleisten** werden über `SystemBars` (`insetsHandling: 'css'`) und
  `EdgeToEdge.enable()` in `MainActivity` berücksichtigt – siehe
  [Mobile Oberfläche](#mobile-oberfläche).

### Zurück-Taste

Die Android-Zurück-Taste schließt zuerst, was offen ist (Bearbeitungsformular,
Teilen-Panel, Löschbestätigung). Ist nichts offen, wird die App in den
Hintergrund geschickt statt hart beendet.

Umgesetzt über einen kleinen Back-Stack (`src/app/backStack.ts`): Die
Oberfläche meldet schließbare Ebenen über `useBackLayer(aktiv, onBack)` an, die
zuletzt geöffnete zuerst. Der Stack ist React-frei und einzeln getestet
(`tests/unit/backStack.test.ts`).

Im Browser passiert nichts – dort gibt es keine Hardware-Taste, und der
Browser-Zurück-Knopf gehört dem Browser.

### Bewusst noch nicht umgesetzt

* **Horizontale Safe-Area-Insets.** Linker und rechter Rand werden nicht
  berücksichtigt. Sie sind nur im Querformat auf Geräten mit Aussparung
  relevant; die App ist auf Hochformat ausgelegt. Ein sauberer Ausbau bräuchte
  `calc()`-Abstände statt der aktuellen Klassen.
* **`@capacitor/network`.** Die App nutzt weiterhin `navigator.onLine`. Das ist
  im WebView ausreichend, weil die Sync-Engine jeden fehlgeschlagenen
  Netzwerkzugriff zusätzlich als offline behandelt. Der Austausch betrifft nur
  `src/sync/network.ts`.
* **Wiederkehrende Erinnerungen** (z. B. „täglich"). Es gibt genau eine
  Erinnerung pro Aufgabe, zum Fälligkeitszeitpunkt.
* **Erinnerungen im Browser.** Dort gibt es keine geplanten Benachrichtigungen;
  die Anzeige entfällt und der Dienst meldet `unsupported`.

---

## Git-Workflow, Commits und Releases

**Branch-Strategie** (bewusst einfach):

* `main` ist der stabile Hauptbranch
* Feature-Branches für größere Änderungen, z. B. `feature/offline-sync`,
  `feature/shared-lists`, `feature/android`, `fix/sync-conflict`

**Commit-Nachrichten** folgen Conventional Commits:

```
feat: add local task storage
feat: add supabase authentication
feat: add offline sync queue
test: add sync engine tests
fix: preserve offline deletes during sync
docs: update setup instructions
```

**Vorgehen bei jeder größeren Änderung:** aktuellen Stand committen, Tests
laufen lassen, erst dann die neue Funktion umsetzen – und danach erneut Tests,
Build und Commit. So ist jederzeit ein Rücksprung auf einen funktionierenden
Stand möglich.

**Versionierung** nach Semantic Versioning. Start ist `0.1.0`; stabile Stände
werden getaggt:

```bash
git tag -a v0.1.0 -m "prio 0.1.0"
git push origin v0.1.0
```

Die CI läuft bei jedem Push und Pull Request und führt Typecheck, Linting,
Unit-Tests, Integrationstests, Produktionsbuild und die E2E-Tests aus. Ein
fehlschlagender Test oder Build lässt die Pipeline fehlschlagen.

---

## Definition of Done – Stand

| Kriterium | Stand |
| --- | --- |
| Registrieren und Anmelden | erfüllt |
| Private Aufgaben erstellen, bearbeiten, erledigen, löschen | erfüllt |
| Diese Funktionen offline | erfüllt (E2E-Test 3) |
| Spätere Synchronisation mit Supabase | erfüllt |
| Dieselben Daten auf einem zweiten Gerät | erfüllt (`multiDevice.test.ts`, E2E 3) |
| Zwei Benutzer, eine gemeinsame Liste | erfüllt (`sharedLists.test.ts`, E2E 4) |
| Serverausfall ohne Datenverlust | erfüllt (Szenario 3, `OfflineGateway`) |
| Sync- und Offline-Szenarien automatisiert getestet | erfüllt (Szenarien 1–6) |
| Als PWA installierbar | erfüllt (Manifest, Icons, Service Worker) |
| Simples Dark-Mode-UI | erfüllt |
| Git-Versionierung, GitHub-Repository, CI, Tag `v0.1.0` | siehe Repository und Actions |

### Nicht Teil von 0.1

Prioritäten, Tags, Suche, Filter, Wiederholungen, Anhänge, Kommentare,
Benachrichtigungen, Echtzeit-Synchronisation, Light Mode, Offline-Anmeldung
ohne vorherige Sitzung, Rollen jenseits von Besitzer/Mitglied.
