-- Persönliches Aufklappen, nicht Bestandteil der gemeinsam bearbeiteten Aufgabe.
-- Der Leserand nimmt bei alten lokalen Zeilen ein leeres Objekt an.
begin;
alter table public.user_preferences add column if not exists task_expansions jsonb not null default '{}'::jsonb;
create or replace function private.valid_task_expansions(value jsonb)
returns boolean language sql immutable set search_path = '' as $$
  select case when jsonb_typeof(value) is distinct from 'object' then false else
    not exists (select 1 from jsonb_each(value) entry
      where length(entry.key) not between 1 and 128 or entry.value not in ('1'::jsonb,'2'::jsonb,'3'::jsonb)) end
$$;
revoke all on function private.valid_task_expansions(jsonb) from public,anon;
grant execute on function private.valid_task_expansions(jsonb) to authenticated;
alter table public.user_preferences drop constraint if exists user_preferences_task_expansions_check;
alter table public.user_preferences add constraint user_preferences_task_expansions_check
  check (private.valid_task_expansions(task_expansions));
notify pgrst, 'reload schema';
commit;
