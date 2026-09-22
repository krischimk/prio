-- =============================================================================
-- prio – 0006_task_completed_at.sql
-- Zeitpunkt des Abhakens.
-- =============================================================================
--
-- Bisher gab es nur `completed` (ja/nein). Für „Aufgaben wiederherstellen“ in
-- den Einstellungen wird der Zeitpunkt gebraucht: Eine abgehakte Aufgabe
-- verschwindet sofort aus der Liste, bleibt aber sieben Tage lang auffindbar.
--
-- `completed_at` gehört wie `updated_at` dem Client – die Regel „Last Write
-- Wins“ vergleicht `updated_at`, und ein Server-Trigger würde das aushebeln.
--
-- Für bestehende Zeilen wird der letzte bekannte Änderungszeitpunkt
-- angenommen, damit bereits abgehakte Aufgaben nicht aus dem Fenster fallen.
--
-- Wiederholbar und atomar.
-- =============================================================================

begin;

alter table public.tasks
  add column if not exists completed_at timestamptz;

comment on column public.tasks.completed_at is
  'Zeitpunkt des Abhakens; NULL, solange die Aufgabe offen ist.';

update public.tasks
set completed_at = updated_at
where completed = true
  and completed_at is null;

commit;
