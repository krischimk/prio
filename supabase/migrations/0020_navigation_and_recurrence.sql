-- Persönliche Navigation und zurückgenommene, früh erzeugte Wiederholung.
-- Ausschließlich additive Struktur: wiederholbar, ohne Backfill bestehender Daten.
begin;
alter table public.list_preferences add column if not exists position double precision;
alter table public.list_preferences add column if not exists hidden boolean not null default false;
alter table public.tasks add column if not exists available_from timestamptz;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='list_preferences_finite_position' and conrelid='public.list_preferences'::regclass) then
    alter table public.list_preferences add constraint list_preferences_finite_position
      check (position is null or (position > '-Infinity'::double precision and position < 'Infinity'::double precision));
  end if;
end $$;
notify pgrst, 'reload schema';
commit;
