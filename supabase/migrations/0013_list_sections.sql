-- Abschnitte innerhalb einer Liste: „Obst", „Getränke" und so weiter.
--
-- Warum als Feld an der Liste und nicht als eigene Tabelle: Ein Abschnitt
-- besteht aus Name und seiner Stelle in der Reihenfolge – beides steht in einem
-- Array beisammen. Eine eigene Tabelle bräuchte eigene Policies, eigene Grants
-- und einen eigenen Abgleichsweg; für ein paar Namen ist das viel Maschinerie.
--
-- Der Preis steht hier ausdrücklich: Der Abschnittsplan einer Liste wird als
-- Ganzes abgeglichen (Last Write Wins), genau wie der Listenname. Zwei Personen,
-- die gleichzeitig Abschnitte derselben Liste ändern, sehen am Ende den Stand
-- des späteren Schreibens.
--
-- Kein neuer Grant nötig: Die Rechte hängen an der Tabelle, nicht an ihren
-- Spalten – `lists` und `tasks` sind `authenticated` bereits gewährt, und die
-- bestehenden Policies decken die Zeilen ab.

alter table public.lists
  add column if not exists sections jsonb not null default '[]'::jsonb;

-- Aufgaben zeigen auf einen Abschnitt **ihrer** Liste; `null` heißt „ohne
-- Bereich". Bewusst kein Fremdschlüssel: Der Abschnitt lebt in einem JSON-Array,
-- ein Fremdschlüssel darauf ginge nicht. Ein Verweis ins Leere wird wie „ohne
-- Bereich" behandelt (siehe `src/domain/sections.ts`); beim Löschen eines
-- Abschnitts räumt die App die Verweise selbst weg.
alter table public.tasks
  add column if not exists section_id text;

comment on column public.lists.sections is
  'Abschnitte der Liste in Anzeigereihenfolge: [{"id": "…", "name": "Obst"}]';

comment on column public.tasks.section_id is
  'Abschnitt innerhalb der Liste; null = ohne Bereich';
