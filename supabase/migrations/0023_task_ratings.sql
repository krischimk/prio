-- Vorhandene Listen bleiben unbewertet; nur neu angelegte Listen sind an.
-- ADD COLUMN füllt ausschließlich beim erstmaligen Anlegen mit false.
begin;
alter table public.lists add column if not exists ratings_enabled boolean not null default false;
alter table public.lists alter column ratings_enabled set default true;
alter table public.tasks add column if not exists rating jsonb default null;

create or replace function private.valid_task_rating(value jsonb)
returns boolean language sql immutable set search_path = '' as $$
  select case when value is null or value='null'::jsonb then true
    when jsonb_typeof(value)='object' then
      value ?& array['importance','urgency','effort','urgencyMode','effortFromChecklist']
      and (select count(*)=5 from jsonb_object_keys(value))
      and jsonb_typeof(value->'effortFromChecklist')='boolean'
      and jsonb_typeof(value->'urgencyMode')='string' and value->>'urgencyMode' in ('auto','manual')
      and not exists (select 1 from unnest(array['importance','urgency','effort']) key
        where case when jsonb_typeof(value->key)='number' then (value->>key)::numeric not between 0 and 10 else true end)
    else false end;
$$;
revoke all on function private.valid_task_rating(jsonb) from public,anon,authenticated;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='tasks_valid_rating' and conrelid='public.tasks'::regclass) then
    alter table public.tasks add constraint tasks_valid_rating check (private.valid_task_rating(rating));
  end if;
end $$;

create or replace function private.expire_completed_in_list(p_list uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare changed integer; moment timestamptz;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('prio:retention:' || p_list::text,0));
  moment := clock_timestamp();
  update public.tasks set expired_at=moment, deleted_at=moment, updated_at=moment,
    title='Abgelaufene Aufgabe', description=null, due_at=null, reminders='[]'::jsonb,
    checklist='[]'::jsonb, tags='[]'::jsonb, rating=null, recurrence=null, successor_id=null,
    section_id=null, reopen_context=null, available_from=null
  where list_id=p_list and completed and expired_at is null and completed_expires_at <= moment;
  get diagnostics changed = row_count;
  return changed;
end; $$;
revoke all on function private.expire_completed_in_list(uuid) from public,anon,authenticated;
notify pgrst, 'reload schema';
commit;
