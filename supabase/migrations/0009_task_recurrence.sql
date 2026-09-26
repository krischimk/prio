-- =============================================================================
-- prio – 0009_task_recurrence.sql
-- Wiederkehrende Aufgaben.
-- =============================================================================
--
-- Eine wiederkehrende Aufgabe wird beim Abhaken nicht verschoben, sondern
-- **ersetzt**: Es entsteht eine neue Aufgabe mit dem nächsten Termin. Der
-- alte Eintrag bleibt als erledigt stehen – so bleibt nachvollziehbar, wann
-- etwas zuletzt getan wurde.
--
-- `successor_id` verweist von der abgehakten Aufgabe auf ihren Nachfolger.
-- Daran hängen zwei Regeln:
--
--   * Solange ein Nachfolger existiert, taucht die abgehakte Aufgabe **nicht**
--     in „Aufgaben wiederherstellen" auf – sie ist ja bereits fortgeschrieben.
--   * „Rückgängig" erkennt daran, was es wieder entfernen muss.
--
-- Eine Fremdschlüssel-Bedingung gibt es bewusst nicht: Beim Abhaken auf zwei
-- Geräten entsteht auf beiden dieselbe Nachfolge-Kennung (sie wird berechnet,
-- siehe `src/domain/recurrence.ts`). Ein Fremdschlüssel würde den zweiten
-- Upload ablehnen, statt ihn zu verschmelzen.
--
-- `recurrence` ist freier Text und keine Aufzählung: Eine neue Wiederholungsart
-- soll keine Datenbankänderung brauchen. Unbekannte Werte behandelt die App wie
-- „keine Wiederholung". Erlaubt sind zurzeit daily, weekly, monthly, yearly.
--
-- Wiederholbar und atomar.
-- =============================================================================

begin;

alter table public.tasks
  add column if not exists recurrence text;

alter table public.tasks
  add column if not exists successor_id uuid;

comment on column public.tasks.recurrence is
  'Wiederholung: daily, weekly, monthly oder yearly; NULL bedeutet keine.';

comment on column public.tasks.successor_id is
  'Nachfolgeaufgabe, die beim Abhaken entstanden ist; NULL, wenn es keine gibt.';

commit;
