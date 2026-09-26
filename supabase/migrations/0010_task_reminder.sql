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
--       null     = keine Erinnerung
--       negativ  = nach der Fälligkeit (-240 = 4 Std danach, ein Nachempfinden
--                  für Aufgaben, die noch offen sind)
--
-- Welche Spalte gilt, entscheidet `recurrence` – die beiden können sich also
-- nie widersprechen. `NULL` in beiden heißt „keine Erinnerung".
--
-- Beide Spalten starten leer. Eine Fälligkeit setzt **keine** Erinnerung: Wer
-- erinnert werden will, wählt es ausdrücklich. Es gibt deshalb nichts
-- umzurechnen und keinen Backfill – bestehende Aufgaben bleiben, wie sie sind.
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

commit;
