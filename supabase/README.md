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

## Anwenden

**Reihenfolge ist wichtig** – die Policies setzen die Tabellen voraus.

### Variante A: SQL-Editor im Supabase-Dashboard

1. *SQL Editor → New query*
2. Inhalt von `0001_schema.sql` einfügen und ausführen
3. Dasselbe mit `0002_rls.sql`
4. Dasselbe mit `0003_share_list.sql`

### Variante B: Supabase CLI

```bash
supabase link --project-ref <projekt-id>
supabase db push
```

## Security Advisor

Der Security Advisor von Supabase meldet `SECURITY DEFINER`-Funktionen, die über
`/rest/v1/rpc/...` aufrufbar sind. Für prio gilt:

| Funktion | Status | Begründung |
| --- | --- | --- |
| `private.is_list_owner` / `is_list_member` / `can_access_list` | **erledigt** (0004) | Liegen im Schema `private`, das nicht als API-Schema exponiert ist. Die Policies brauchen sie, die API nicht. |
| `handle_new_user` | **erledigt** (0004) | Trigger-Funktion; `EXECUTE` ist entzogen. Trigger laufen mit den Rechten ihres Eigentümers. |
| `rls_auto_enable` | **erledigt** (0004) | Von Supabase angelegt (Option „Enable automatic RLS", Vorlage aus der [Dokumentation](https://supabase.com/docs/guides/database/postgres/event-triggers)). `EXECUTE` ist entzogen. |
| `share_list_by_email` | **bleibt absichtlich** | Das ist der RPC der App. Er prüft selbst, dass nur der Besitzer teilen darf und dass die Adresse zu einem registrierten Nutzer gehört. |

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
| `list_members` | die eigene Mitgliedschaft **auch wenn sie gelöscht ist**, sonst alle Zeilen der eigenen Listen | nur der Besitzer der Liste |
| `tasks` | Aufgaben aller zugänglichen Listen | Besitzer und Mitglieder |

Zwei Details, die leicht zu übersehen sind:

1. **`SECURITY DEFINER` für die Hilfsfunktionen.** Eine Policy auf
   `list_members`, die wieder `list_members` abfragt, führt in PostgreSQL zu
   „infinite recursion detected in policy“. `is_list_owner`, `is_list_member`
   und `can_access_list` umgehen die RLS intern und brechen den Zyklus.

2. **Tabellenrechte werden ausdrücklich vergeben.** RLS allein genügt nicht:
   Ohne `GRANT` kommt man gar nicht bis zur Policy und PostgREST antwortet mit
   „permission denied for table …“. In einem Standardprojekt sind diese Rechte
   über die Default-Privileges vorhanden; `0002_rls.sql` vergibt sie trotzdem
   explizit an `authenticated` (und bewusst **nicht** an `anon`), damit die
   Einrichtung nicht von den Projekteinstellungen abhängt.

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
