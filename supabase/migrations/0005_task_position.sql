-- =============================================================================
-- prio – 0005_task_position.sql
-- Vom Benutzer bestimmte Reihenfolge der Aufgaben innerhalb einer Liste.
-- =============================================================================
--
-- Ohne dieses Feld wäre die Reihenfolge nach dem nächsten Sync wieder weg:
-- Die App lädt die Aufgaben vom Server und würde sie dort in der alten Ordnung
-- vorfinden.
--
-- `default 0` für bestehende Zeilen ist Absicht: Alle vorhandenen Aufgaben
-- bekommen dieselbe Position. Die App fällt bei Gleichstand auf die früheren
-- Regeln zurück (Erledigt-Status, Fälligkeit, Erstellzeit), sodass eine
-- bestehende Liste nach dem Update stabil bleibt. Sobald jemand zum ersten Mal
-- umsortiert, werden die Positionen auf 1 … n gesetzt – ohne Lücken, damit
-- keine Genauigkeit verloren geht.
--
-- Wiederholbar und atomar.
-- =============================================================================

begin;

alter table public.tasks
  add column if not exists position integer not null default 0;

comment on column public.tasks.position is
  'Vom Benutzer bestimmte Reihenfolge innerhalb der Liste (kleiner = weiter oben).';

commit;
