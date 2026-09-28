-- =============================================================================
-- prio – 0011_task_reminders.sql
-- Mehrere Erinnerungen pro Aufgabe.
-- =============================================================================
--
-- Bisher trug eine Aufgabe genau eine Erinnerung, verteilt auf zwei Spalten
-- (`remind_at` für einmalige, `reminder_offset_minutes` für wiederkehrende
-- Aufgaben). Jetzt ist es eine **Liste**:
--
--   [{"form": "offset",   "minutes": 1440},
--    {"form": "offset",   "minutes": 60}]
--
--   [{"form": "absolute", "at": "2027-02-15T09:00:00Z"},
--    {"form": "absolute", "at": "2027-02-15T17:00:00Z"}]
--
-- Die Regel bleibt dieselbe: Bei einer wiederkehrenden Aufgabe stehen Vorläufe
-- in der Liste, bei einer einmaligen absolute Zeitpunkte. Die Form steht
-- ausdrücklich mit im Eintrag, damit ein Datensatz auch dann eindeutig zu
-- lesen ist, wenn er von Hand verbogen wurde.
--
-- **Warum eine Spalte und keine eigene Tabelle.** Erinnerungen sind Teil der
-- Absicht einer Aufgabe und werden immer zusammen mit ihr gelesen. Eine zweite
-- Tabelle bräuchte Policies, `grant`s, einen vierten Sync-Pfad und eigenes
-- `dirty`-Tracking – viel Apparat für eine kurze, geordnete Liste, die mit der
-- Aufgabe zusammen im Last-Write-Wins wandert. Dieselbe Überlegung wie bei
-- `recurrence`.
--
-- Wiederholbar und atomar.
-- =============================================================================

begin;

alter table public.tasks
  add column if not exists reminders jsonb not null default '[]'::jsonb;

comment on column public.tasks.reminders is
  'Erinnerungen der Aufgabe als Liste: {"form":"absolute","at":…} oder {"form":"offset","minutes":…}. Leer heißt keine.';

-- -----------------------------------------------------------------------------
-- Einmaliger Umzug der bisherigen Einzelwerte
-- -----------------------------------------------------------------------------
--
-- Bedingt, damit die Datei wiederholbar bleibt: Nach dem Entfernen der alten
-- Spalten läuft der Block nicht mehr an, statt an einem fehlenden Feld zu
-- scheitern.
do $$
begin
  if exists (
    select 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'tasks'
       and column_name = 'remind_at'
  ) then
    update public.tasks
       set reminders = case
             when recurrence is not null
              and due_at is not null
              and reminder_offset_minutes is not null
               then jsonb_build_array(
                      jsonb_build_object('form', 'offset', 'minutes', reminder_offset_minutes)
                    )
             when remind_at is not null
               then jsonb_build_array(
                      jsonb_build_object(
                        'form', 'absolute',
                        'at', to_char(remind_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
                      )
                    )
             else '[]'::jsonb
           end
     where remind_at is not null
        or reminder_offset_minutes is not null;
  end if;
end $$;

alter table public.tasks drop column if exists remind_at;
alter table public.tasks drop column if exists reminder_offset_minutes;

commit;
