# Supabase-Migrationen

Die Dateien in `migrations/` sind die vollständige Datenbank-Einrichtung der
App. Sie sind so geschrieben, dass sie sich gefahrlos erneut ausführen lassen
(`create ... if not exists`, `create or replace`, `drop policy if exists`).

| Datei | Inhalt |
| --- | --- |
| `0001_schema.sql` | Tabellen `profiles`, `lists`, `list_members`, `tasks`, Indizes und der Trigger, der bei einer Registrierung ein Profil anlegt |
| `0002_rls.sql` | Row Level Security: Hilfsfunktionen und alle Policies |
| `0003_share_list.sql` | Funktion `share_list_by_email` zum Teilen über eine E-Mail-Adresse |
| `0004_harden_functions.sql` | Hilfsfunktionen ins private Schema, Trigger-Funktionen aus der API nehmen |
| `0005_task_position.sql` | Spalte `position` für die vom Benutzer bestimmte Reihenfolge |
| `0006_task_completed_at.sql` | Spalte `completed_at` für „Aufgaben wiederherstellen“ |
| `0007_list_leave.sql` | Richtlinie, damit Mitglieder eine geteilte Liste verlassen können |
| `0008_list_icon.sql` | Spalte `icon` für das Listensymbol |
| `0009_task_recurrence.sql` | Spalten `recurrence` und `successor_id` für wiederkehrende Aufgaben |
| `0010_task_reminder.sql` | Spalten `remind_at` und `reminder_offset_minutes`; trennt die Erinnerung von der Fälligkeit |
| `0011_task_reminders.sql` | Spalte `reminders` (jsonb) – mehrere Erinnerungen je Aufgabe. Zieht die Einzelwerte aus 0010 einmalig um und entfernt die alten Spalten |
| `0012_co_member_contacts.sql` | Funktion `co_member_contacts()` – Adressen und Benutzernamen der Personen aus gemeinsamen Listen. Gibt nur diesen Kreis heraus, ohne Parameter |
| `0013_list_sections.sql` | Spalte `lists.sections` (jsonb, Abschnitte in Anzeigereihenfolge) und `tasks.section_id` (Abschnitt innerhalb der Liste; `null` = ohne Bereich). Keine neuen Policies nötig – die Rechte hängen an den bestehenden Tabellen |
| `0014_guarded_sync.sql` | Geschützter `sync_push` mit Basisvergleich, Sperren, Rechteprüfung und Antwort je Zeile. Sperrt direkte App-Schreibrechte. Keine Datenumschreibung und keine neuen Spalten |
| `0015_personal_overview.sql` | Persönliche Aufnahme je Liste, zuletzt verwendete Gesamt-Zielliste (`default_list_id`), Ansicht einschließlich Prioritätssortierung und appweite Detailanzeige der Bewertungen (`detailed_ratings`, zunächst aus). Eigene Tabellen mit RLS; geschützte Änderungen über denselben `sync_push`. Keine automatische Aufnahme von Listen |
| `0016_completion_retention.sql` | Gemeinsame Aufbewahrung, letzte Umstellung, gesonderte Abschlussfrist, endgültiger Ablauf und Rückkehrkontext; private Ablauffunktionen. Erweitert die Positionsspalte für Zwischenplätze, ohne bestehende Werte zu verändern |
| `0017_completion_grace.sql` | Einmaliger, mit Marker gesicherter Datenumbau: Altabschlüsse erhalten sieben Tage ab Einführung; erneutes Einspielen verlängert nichts |
| `0018_completion_cron.sql` | Benannter minütlicher Datenbankjob, unabhängig von App/MCP; setzt `pg_cron` voraus |
| `0019_usernames.sql` | Eindeutige Benutzernamen, atomarer Auth-/Profil-Trigger, reine Verfügbarkeitsabfrage und Freigabe per Name mit Besitzprüfung und optionaler erwarteter Benutzer-ID |
| `0020_navigation_and_recurrence.sql` | Persönliche Listenposition und Verstecken; `tasks.available_from` kennzeichnet den noch zurückgenommenen nächsten Serientermin. Wiederholbare Spaltenergänzung ohne Umschreiben bestehender Daten |
| `0021_task_checklists_and_tags.sql` | Aufgabenfelder `checklist` und `tags` mit leeren Defaults und Formprüfung; endgültiger Ablauf entfernt auch diese Inhalte |
| `0022_incremental_sync.sql` | Privater letzter Schreibstand je Zeile und paginierter `sync_pull` mit PostgreSQL-Snapshot; erkennt neue Freigaben und Rechteentzug ohne Geräteuhren |
| `0023_task_ratings.sql` | Gekoppelte optionale Aufgabenbewertung, Besitzer-Schalter `ratings_enabled` (Bestand aus, neue Listen an), Inhaltsprüfung und Entfernen der Bewertung beim endgültigen Ablauf |
| `0024_unique_task_titles.sql` | Besitzer-Regel `allow_duplicate_titles` (zunächst an), stabile `recurrence_series_id` und einmaliges Backfill alter Serien. Namensprüfung in `sync_push` unter Listensperre, einschließlich erledigter Aufgaben; vorhandene Duplikate bleiben erhalten |
| `0025_list_sort_mode.sql` | Persönliche Sortierung je Liste (`manual`, `priority` mit Bereichen, `priority_flat` gemeinsam); bestehende Zeilen starten manuell |
| `0026_task_expansions.sql` | Persönliche aufgeklappte Notizen und Checklisten (`task_expansions`); pro Aufgabe zwei Schalter, durch RLS privat und über `sync_push` abgeglichen |

### Bewertungen und Checklistenanteile

`tasks.rating` ist `null` oder ein atomarer Satz aus `importance`, `urgency`,
`effort` (endliche Zahlen 0–10), `urgencyMode` (`auto`/`manual`) und
`effortFromChecklist` (boolesch, im Client standardmäßig an). Der Server akzeptiert
nur vollständige gültige Sätze. Abgeleitete Dringlichkeit, Restaufwand und Priorität
werden lokal aus Fachwerten und aktueller Zeit berechnet und nicht geschrieben.
`lists.ratings_enabled` kann ausschließlich der Besitzer ändern. Die Migration
füllt beim ersten Anlegen der Spalte Bestandslisten mit `false`, setzt anschließend
nur den Default neuer Zeilen auf `true`; Wiederholung ändert keinen Listenwert.

Checklistenpunkte dürfen `weight` enthalten. Aktive Punkte sind entweder alle
ungewichtet (gleich groß) oder alle gewichtet mit Werten 0–1 und Summe 1
(Toleranz für Gleitkomma). Gelöschte Punkte zählen nicht mit. Gewicht und Häkchen
werden wie andere Punktfelder zusammengeführt; widersprüchliche Gewichtungen
bleiben Konflikte. Der Gesamtaufwand wird beim Abhaken nicht überschrieben.

### Checklisten und Tags

`tasks.checklist` enthält geordnete Punkte mit stabiler Kennung, Text, Häkchen
und internem Löschvermerk. `tasks.tags` ist ein Array lesbarer Namen. Beide
Sammlungen gehören zur bestehenden Aufgabenzeile und verwenden deren Lese- und
Schreibrechte. Zusätzliche Freigaben oder öffentliche Tagverzeichnisse entstehen
nicht. Verschiedene Punktänderungen und Tags werden clientseitig anhand der
bestätigten Basis zusammengeführt; der Server prüft die vollständige Basis
weiterhin atomar. Konflikte bleiben sichtbar, statt eine ganze alte Checkliste
blind zu übernehmen. Schema und geschützter Schreibweg werden gemeinsam durch
die vollständige Sammelmigration einschließlich 0021 aktualisiert.

### Inkrementelles Lesen

`sync_pull(p_since,p_lists,p_after,p_limit)` gibt höchstens 500 Änderungen je
Seite, einen Checkpoint und entzogene Listenkennungen zurück. Der erste
Seiten-Checkpoint gilt für den gesamten Durchlauf. Ein Client bestätigt ihn
zusammen mit allen Zeilen atomar in seiner lokalen Datenbank. Änderungen
während weiterer Seiten erscheinen nötigenfalls beim nächsten Pull erneut.

`private.sync_row_versions` enthält pro Geschäftszeile die letzte Haupttransaktion
als `xid8`. Ein Trigger ändert ausschließlich diese privaten Metadaten, niemals
`updated_at`. `pg_visible_in_snapshot` erkennt auch beim letzten Lesen noch
laufende Transaktionen; ein einfaches Sequenzmaximum wäre dafür nicht ausreichend.
Neue Listenberechtigungen veranlassen einen vollständigen Abgleich. Entzogene
Berechtigungen liefern keine fremden Inhalte; die Meldung entfernt lokale fremde
Kopien auch dann, wenn nur die Liste selbst gelöscht wurde.

Die private Tabelle hat RLS und keine App-Rechte. Die öffentliche Funktion läuft
als Aufrufer; ihre private Definer-Funktion hat einen leeren Suchpfad, verlangt
`auth.uid()` und bildet die SELECT-Regeln aller fünf Geschäftstabellen ab.
`anon` erhält kein Ausführungsrecht. `db:test` vergleicht die gelieferten Kennungen
mit echten RLS-Abfragen und prüft späte Commits über zwei Datenbankverbindungen.
`db:check` prüft die Funktion und die gesperrten Metadatenrechte.

Die [PostgreSQL-Snapshot-Funktionen](https://www.postgresql.org/docs/current/functions-info.html#FUNCTIONS-PG-SNAPSHOT)
und die [STABLE-Sichtbarkeit](https://www.postgresql.org/docs/current/xfunc-volatility.html)
begründen den Cursorvertrag: die Leseanfrage verwendet eine einheitliche Sicht;
Gerätezeitstempel bestimmen den Download nicht.

### Persönliche Navigation und kommende Wiederholungen

`list_preferences.position` und `hidden` gehören dem jeweiligen Benutzer;
sie verändern weder die Liste noch deren Aufnahme in die Gesamtansicht.
Alte Zeilen entsprechen Position `null` und `hidden = false`. Der Leserand
ergänzt dieselben Werte. Der geschützte Schreibweg akzeptiert auch eine vor
der Erweiterung bestätigte Basis, ohne konkurrierende neue Einstellungen zu
überschreiben. Die Positionsspalte erlaubt ausschließlich endliche Zahlen.

Wird ein Serientermin vor seiner Fälligkeit erledigt, trägt der Nachfolger
in `available_from` die ursprüngliche Fälligkeit. Bis dahin wird er dezent
gedämpft, danach normal dargestellt. Er bleibt als offene Aufgabe vollständig
bedienbar; das Feld verschiebt keine Erinnerung und sperrt keine Fachoperation.
Eine Änderung an Fälligkeit oder Wiederholung hebt die Kennzeichnung auf.
Alte Aufgaben erhalten `null`; bereits erzeugte Nachfolger werden nicht
rückwirkend geraten. Die vollständige Sammelmigration einschließlich `0020`
wird vor dem neuen Client eingespielt.

### Benutzernamen

`profiles.username` bleibt für noch nicht umgestellte Konten `null`. Die App
verlangt bei Registrierung und vor dem Öffnen eines bestehenden Arbeitsbereichs
einen Namen. Der private Auth-Trigger normalisiert ihn, prüft das Format und
schreibt das Profil in derselben Transaktion. Der Unique-Index entscheidet
gleichzeitige Vergaben; ein gewählter Name kann geändert, aber nicht entfernt
werden. Es gibt keinen erfundenen Backfill-Namen für Bestandskonten.

Die anonym erlaubte `username_available(text)` gibt nur ein Boolean zurück.
`share_list_by_username(uuid,text,uuid)` erfordert Anmeldung und Listenbesitz;
ein bekannter Kontakt wird zusätzlich gegen die erwartete Benutzer-ID geprüft.
Namen in `co_member_contacts()` sind ausschließlich für den Kreis gemeinsamer
Listen lesbar. Das frühere Feld `email` enthält nur noch einen leeren Text;
private Adressen werden nicht an andere Konten geliefert. Der Client behält
Vorschläge über `user_id` und `username` und entfernt alte Cloud-Adressen beim
Auffrischen. Bereits selbst eingegebene Adressen bleiben als Eingabe möglich.
Exponierte Funktionen sind `SECURITY INVOKER`, die eigentliche
Rechteprüfung steht im privaten Schema. Die Sammelmigration meldet ihren neuen
API-Stand an den PostgREST-Schemacache und wird vor der App eingespielt.

## Anwenden

Die vollständige Sammeldatei wird in Dateireihenfolge wiederholt eingespielt:

```bash
npm run db:sql     # supabase/all-migrations.sql neu erzeugen
npm run db:apply   # per psql an SUPABASE_DB_URL aus supabase/.env.local senden
npm run db:check   # nur lesen: Spalten, RLS und geschützten Schreibweg prüfen
```

Die Verbindungsdatei bleibt privat. Alternativ die erzeugte **vollständige**
Sammeldatei im Supabase SQL-Editor ausführen. Das Projekt verwendet keine
CLI-Migrationshistorie; auch geänderte alte Dateien werden erneut ausgeführt.
`0002` bewahrt dabei einen bereits aktivierten Schreibschutz, statt direkte
Schreibrechte bis zum Erreichen von `0014` vorübergehend wieder zu erteilen.

### Übergang zu Migrationen 0014 bis 0018

Die neue App braucht die vollständige Sammeldatei einschließlich `0022`,
bevor ihr neuer Cloud-Zugriff benutzt wird. `0014`
entzieht `authenticated`, `anon` und `PUBLIC` direkte
INSERT-/UPDATE-/DELETE-/TRUNCATE-Rechte an Listen, Mitgliedschaften und Aufgaben.
Eine unveränderte App bis zum Ausgangsstand 0.23.4 kann danach noch lesen,
aber ihre alten Upserts werden abgewiesen. Ein bloßer API-Austausch bei
weiterhin erlaubten alten Upserts würde den Schutz umgehen.

Aktuell gibt es einen Nutzer. Dafür genügt ein gemeinsamer Wechsel seiner
Web- und Android-Fassung; eine Ankündigung oder längere Unterstützung alter
Schreiber ist nicht erforderlich. Ausstehende Daten auf seinen Geräten bleiben
beim Update erhalten.

1. Eine kompatible App-Fassung fertig bauen. Version und Tag erst für die
   tatsächliche Veröffentlichung festlegen. Diese Entwicklung erhöht die
   Versionsnummer noch nicht.
2. Ziel und bestehenden Cloud-Stand prüfen. App-Bereitstellung und Migration
   als gemeinsame Umschaltung planen; eine kurze Schreibpause ist möglich.
   Der neue Client fällt bei fehlendem RPC ausdrücklich nicht auf alte Upserts
   zurück und bewahrt ausstehende lokale Eingaben.
3. `pg_cron` bereitstellen, die Sammeldatei einschließlich `0022` einspielen,
   `db:check` einschließlich aktivem Ablaufjob durchführen,
   kompatible App ausliefern und den echten Update-/Schreibweg prüfen.
4. Ältere Offline-Eingaben auf der kompatiblen App prüfen. Saubere Zeilen
   übernehmen die Cloud. Schmutzige Zeilen ohne bekannte Basis überschreiben
   nichts; unterschiedliche Fassungen erscheinen zur bewussten Wahl.
   Quarantänevermerke aus alten Apps ohne vollständigen Zeileninhalt werden im
   neuen Protokoll erneut geprüft. Lokale Daten dafür nicht löschen.

Ein Rückwechsel auf eine alte UI darf diesen Schreibschutz nicht entfernen.
Ein Rückweg braucht eine weiterhin kompatible App. Direkte Schreibrechte
wieder zu erteilen würde die zugesagte Konfliktsicherheit zurücknehmen.

### Echte lokale Datenbankprüfung

`PRIO_DB_TEST_URL=postgresql://localhost/prio_test_local npm run db:test`
prüft die tatsächlichen Migrationen, Rechte, Wiederholung, Zeilenfehler,
idempotente Retries und konkurrierende Verbindungen. Das Skript setzt die
Schemas dieser wegwerfbaren Testdatenbank zurück und erlaubt ausschließlich
lokale Hosts und Namen `prio_test_*`. Die CI verwendet einen eigenen
PostgreSQL-Dienst. Eine grüne lokale Prüfung belegt nicht den eingespielten
Stand der Produktionscloud.
Die Test-URI enthält keine Queryparameter, die das geprüfte Verbindungsziel
überschreiben könnten.
Für diese Prüfung muss `pg_cron` installiert und vorgeladen sein,
`cron.database_name` auf die Testdatenbank zeigen. Die CI richtet das in ihrem
eigenen PostgreSQL-Dienst ein. Ein tatsächlich ausgeführter Testjob prüft den
Ablauf ohne Aufruf durch App oder MCP; eine bloß vorhandene Jobzeile reicht
dafür nicht.

### Aufbewahrung und endgültiger Ablauf

`lists.keep_completed` ist zunächst `false` und nur vom Besitzer veränderbar.
An bedeutet dauerhaftes Aufbewahren. Aus bedeutet sieben Tage ab Abschluss;
bei Einführung beziehungsweise Abschalten erhalten bestehende Abschlüsse
sieben Tage ab der bestätigten Umstellung. Deren `completed_at` bleibt erhalten.
`completion_retention_started_at` hält die Umstellung auch für damals noch
ungesendete Abschlüsse fest. Der einmalige Backfill steht in `0017`, seine
Ausführung in `private.data_migrations`; wiederholte Sammelmigrationen setzen
weder die Liste noch die Frist erneut zurück.

`sync_push` berechnet `completed_expires_at`, während er die Listenregel und
betroffene Zeilen schützt. Eine erledigte Aufgabe, die ihre Liste wechselt,
übernimmt die Zielregel: dauerhaft oder sieben Tage ab dem bestätigten
Verschieben. Andere Bearbeitungen verändern weder Abschlusszeitpunkt noch Frist.
Serverseitig erzeugte Werte werden als tatsächlicher Stand zurückgegeben und
automatisch abgeglichen; daraus entsteht kein Benutzerkonflikt.

Ab Ablauf ist weder Öffnen, Verschieben noch Wiederherstellen zulässig.
`expired_at` wird ausschließlich vom Server gesetzt. Die private Ablauffunktion
entfernt Titel, Notiz, Termin, Erinnerungen, Wiederholung und
Rückkehrkontext. Identität und notwendige Synchronisationsdaten bleiben als
endgültiger Löschvermerk erhalten. Ein alter Upload oder das erneute
Einschalten von „Abgehakt“ kann ihn nicht zurücknehmen.

`0018` verwendet [Supabase Cron](https://supabase.com/docs/guides/cron): ein
benannter SQL-Job pro Minute, ohne externe Netzwerkaufrufe, mit 30 Sekunden
Ausführungsgrenze. Das bleibt unter den dokumentierten Empfehlungen von
höchstens acht gleichzeitigen Jobs und zehn Minuten Laufzeit. Die
[benannte Planung](https://supabase.com/docs/guides/cron/quickstart) ersetzt
beim erneuten Einspielen denselben Job. Er bereinigt außerdem nur seinen eigenen
Verlauf nach sieben Tagen. Diese sieben Tage betreffen Betriebsprotokolle,
keinen weiteren Papierkorb für Aufgaben.

Für Supabase muss die [Erweiterung bereitstehen](https://supabase.com/docs/guides/cron/install).
Fehlt sie, scheitert die Migration sichtbar. `db:check` prüft Spalten,
gesperrte direkte Schreibwege, private Ablauffunktionen und genau einen aktiven
Job. Die Frist gilt auch zwischen zwei Jobläufen: App-Abfragen filtern sie und
der geschützte Schreibweg prüft den Ablauf vor jeder betroffenen Änderung.
Ein späterer MCP-Adapter muss denselben Leserand verwenden.

## Security Advisor

Der Security Advisor von Supabase meldet `SECURITY DEFINER`-Funktionen, die über
`/rest/v1/rpc/...` aufrufbar sind. Für prio gilt:

| Funktion | Status | Begründung |
| --- | --- | --- |
| `private.is_list_owner` / `is_list_member` / `can_access_list` | **erledigt** (0004) | Liegen im Schema `private`, das nicht als API-Schema exponiert ist. Die Policies brauchen sie, die API nicht. |
| `handle_new_user` | **erledigt** (0004) | Trigger-Funktion; `EXECUTE` ist entzogen. Trigger laufen mit den Rechten ihres Eigentümers. |
| `rls_auto_enable` | **erledigt** (0004) | Von Supabase angelegt (Option „Enable automatic RLS", Vorlage aus der [Dokumentation](https://supabase.com/docs/guides/database/postgres/event-triggers)). `EXECUTE` ist entzogen. |
| `share_list_by_email` | **bleibt absichtlich** | Das ist der RPC der App. Er prüft selbst, dass nur der Besitzer teilen darf und dass die Adresse zu einem registrierten Nutzer gehört. |
| `sync_push` | **öffentlicher Einstieg als INVOKER** (0014) | Die privilegierte Arbeit liegt in `private`; nur angemeldete Benutzer dürfen den Einstieg aufrufen. `private.sync_write` ist für App-Rollen nicht direkt ausführbar |

Zusätzlich meldet der Advisor **„Leaked Password Protection Disabled"**. Das
ist keine Datenbankeinstellung, sondern ein Schalter unter *Authentication →
Settings → Password Security*. **Dieser Schalter ist an den Pro-Tarif
gebunden** ([Doku](https://supabase.com/docs/guides/auth/password-security)) und
im kostenlosen Tarif nicht verfügbar – die Warnung bleibt dort also bestehen.

Als Ersatz im Free-Tarif lohnt es sich, an derselben Stelle die
**Mindest-Passwortlänge** auf 8 und die geforderten Zeichenklassen zu erhöhen.
Die App prüft clientseitig `minLength={6}` in `src/ui/AuthScreen.tsx`; das ist
nur eine Bequemlichkeitsprüfung, verbindlich ist die Einstellung im Dashboard.
Wer die Mindestlänge dort ändert, sollte sie hier angleichen.

## Sicherheitsmodell

Die zentrale Frage lautet: **Wer darf welche Zeilen sehen und ändern?**

| Tabelle | Lesen | Schreiben |
| --- | --- | --- |
| `profiles` | nur das eigene Profil | ausschließlich über den Trigger |
| `lists` | eigene Listen und gemeinsame Listen mit aktiver Mitgliedschaft | Anlegen/Ändern/Löschen nur durch den Besitzer |
| `list_members` | die eigene Mitgliedschaft **auch wenn sie gelöscht ist**, sonst alle Zeilen der eigenen Listen | Besitzer; ein Mitglied darf seine bestehende eigene Mitgliedschaft beenden |
| `tasks` | Aufgaben aller zugänglichen Listen | Besitzer und Mitglieder |

Die Tabellen bleiben für Lesen RLS-geschützt. `sync_push` führt privilegierte
Schreiboperationen nach einer ausdrücklichen eigenen Rechteprüfung aus:
Listen nur als Besitzer, Mitgliedschaften als Besitzer oder zum eigenen
Verlassen, Aufgaben nur mit Zugriff auf Quell- und Zielliste. Basisprüfung und
Schreiben halten dieselben Sperren; die Geräteuhr kann den Vergleich nicht
umgehen. Ein Ergebnis bestätigt den tatsächlich gespeicherten Inhalt.

Details, die leicht zu übersehen sind:

1. **`SECURITY DEFINER` für die Hilfsfunktionen.** Eine Policy auf
   `list_members`, die wieder `list_members` abfragt, führt in PostgreSQL zu
   „infinite recursion detected in policy“. `is_list_owner`, `is_list_member`
   und `can_access_list` umgehen die RLS intern und brechen den Zyklus.

2. **Tabellenrechte werden ausdrücklich vergeben.** RLS allein genügt nicht:
   Ohne `GRANT` kommt man gar nicht bis zur Policy und PostgREST antwortet mit
   „permission denied for table …“. In einem Standardprojekt sind diese Rechte
   über die Default-Privileges vorhanden; `0002_rls.sql` vergibt sie trotzdem
   explizit an `authenticated` (und bewusst **nicht** an `anon`). Nach `0014`
   bleiben die Leserechte bestehen; Schreiben geht ausschließlich über die
   selbst prüfenden Serverfunktionen.

3. **Die eigene Mitgliedschaftszeile bleibt lesbar, auch wenn sie gelöscht ist.**
   Nur so erfährt ein entferntes Mitglied, dass es keinen Zugriff mehr hat. Die
   Zugriffsprüfung für Listen und Aufgaben verlangt dagegen eine nicht
   gelöschte Mitgliedschaft.

## Was ein Benutzer niemals kann

* private Listen oder Aufgaben eines anderen lesen,
* Aufgaben in Listen sehen oder bearbeiten, in denen er kein Mitglied ist,
* Mitglieder einer fremden Liste verwalten,
* eine fremde Liste umbenennen oder löschen,
* die Liste auf einen anderen Besitzer umschreiben (`owner_id` ist in der
  `WITH CHECK`-Klausel fixiert),
* sich über `profiles` die E-Mail-Adressen anderer Nutzer ansehen.

## Prüfen, ob RLS aktiv ist

```sql
select relname, relrowsecurity
from pg_class
where relname in ('profiles', 'lists', 'list_members', 'tasks');
```

`relrowsecurity` muss überall `true` sein. Ergänzend lohnt ein Blick auf die
angelegten Policies:

```sql
select tablename, policyname, cmd
from pg_policies
where schemaname = 'public'
order by tablename, policyname;
```
