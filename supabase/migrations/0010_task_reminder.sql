-- =============================================================================
-- prio – 0010_task_reminder.sql
-- Erinnerung und Fälligkeit trennen.
-- =============================================================================
--
-- Bisher war die Erinnerung keine eigene Angabe: Jede Aufgabe mit einem
-- Fälligkeitsdatum in der Zukunft erinnerte, und zwar genau zur Fälligkeit.
-- Abschalten ging nicht, vorverlegen auch nicht.
--
-- Ab jetzt trägt die Aufgabe die **Absicht** – wann erinnert werden soll –,
-- und die Erinnerungs-Buchhaltung bleibt weiterhin lokal (`reminders`-Tabelle
-- im Gerät). Zwei Spalten, weil es zwei Formen gibt:
--
--   * `remind_at` – ein **absoluter** Zeitpunkt. Gilt für einmalige Aufgaben:
--     Der gewählte Moment bleibt der gewählte Moment, auch wenn sich die
--     Fälligkeit später verschiebt. So ist auch eine Erinnerung *nach* der
--     Fälligkeit möglich („in zwei Stunden nachfassen").
--
--   * `reminder_offset_minutes` – ein **Vorlauf** in Minuten, vorzeichen-
--     behaftet. Gilt für wiederkehrende Aufgaben: Eine absolute Erinnerung
--     feuerte einmal und wäre ab der zweiten Ausführung falsch. Der Wert rückt
--     mit jeder Ausführung von selbst mit.
--
--       positiv  = vor der Fälligkeit  (90  = 1 Std 30 Min vorher)
--       null     = zur Fälligkeit
--       negativ  = nach der Fälligkeit (-240 = 4 Std danach, ein Nachempfinden
--                  für Aufgaben, die noch offen sind)
--
-- Welche Spalte gilt, entscheidet `recurrence` – die beiden können sich also
-- nie widersprechen. `NULL` in beiden heißt „keine Erinnerung".
--
-- Wiederholbar und atomar.
-- =============================================================================

begin;

alter table public.tasks
  add column if not exists remind_at timestamptz;

alter table public.tasks
  add column if not exists reminder_offset_minutes integer;

comment on column public.tasks.remind_at is
  'Absoluter Erinnerungszeitpunkt für einmalige Aufgaben; NULL bedeutet keine Erinnerung.';

comment on column public.tasks.reminder_offset_minutes is
  'Vorlauf in Minuten vor der Fälligkeit für wiederkehrende Aufgaben; negativ = danach, NULL = keine Erinnerung.';

-- -----------------------------------------------------------------------------
-- Kassenbuch für einmalige Schritte
-- -----------------------------------------------------------------------------
--
-- Schemaänderungen sind wiederholbar und dürfen deshalb in ihrer Datei geändert
-- werden. Ein `update` ist das nicht: Es liefe beim nächsten Einspielen erneut
-- und überschriebe neuere Daten – hier würde es eine bewusst gelöschte
-- Erinnerung wiederbeleben.
--
-- Deshalb merkt sich diese Tabelle, welche einmaligen Schritte schon gelaufen
-- sind. Der `exists`-Test auf die CTE sorgt dafür, dass das `update` nur beim
-- allerersten Lauf etwas tut, auch wenn die Datei danach noch zehnmal
-- eingespielt wird.
--
-- Kein `grant` und keine Policy: hier hat kein Client etwas zu suchen.

create table if not exists public.prio_migrations (
  name text primary key,
  applied_at timestamptz not null default now()
);

alter table public.prio_migrations enable row level security;
revoke all on public.prio_migrations from anon, authenticated;

-- Einmalig: Bestehende einmalige Aufgaben erinnern weiterhin zur Fälligkeit.
with neu as (
  insert into public.prio_migrations (name) values ('0010_erinnerung_einmalig')
  on conflict (name) do nothing
  returning name
)
update public.tasks
   set remind_at = due_at
 where deleted_at is null
   and completed = false
   and due_at is not null
   and recurrence is null
   and remind_at is null
   and exists (select 1 from neu);

-- Einmalig: dasselbe für wiederkehrende Aufgaben, dort als Vorlauf von 0.
with neu as (
  insert into public.prio_migrations (name) values ('0010_erinnerung_wiederkehrend')
  on conflict (name) do nothing
  returning name
)
update public.tasks
   set reminder_offset_minutes = 0
 where deleted_at is null
   and completed = false
   and due_at is not null
   and recurrence is not null
   and reminder_offset_minutes is null
   and exists (select 1 from neu);

commit;
