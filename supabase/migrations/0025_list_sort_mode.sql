-- Persönliche Listensortierung; bestehende Reihenfolgen bleiben manuell.
begin;
alter table public.list_preferences add column if not exists sort_mode text not null default 'manual';
do $$ begin
  if not exists(select 1 from pg_constraint where conname='list_preferences_sort_mode_check' and conrelid='public.list_preferences'::regclass) then
    alter table public.list_preferences add constraint list_preferences_sort_mode_check check (sort_mode in ('manual','priority','priority_flat'));
  end if;
end $$;
notify pgrst, 'reload schema';
commit;
