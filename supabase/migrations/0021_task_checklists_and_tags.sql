-- Aufgabeneigene Checklisten und Tags, ohne separate Rollen oder Task-Hierarchie.
-- Rein additive Struktur; alte Zeilen erhalten leere Sammlungen.
begin;
alter table public.tasks add column if not exists checklist jsonb not null default '[]'::jsonb;
alter table public.tasks add column if not exists tags jsonb not null default '[]'::jsonb;

create or replace function private.valid_task_details(p_checklist jsonb, p_tags jsonb)
returns boolean language sql immutable set search_path = '' as $$
  select case when jsonb_typeof(p_checklist)='array' and jsonb_typeof(p_tags)='array' then
    not exists (select 1 from jsonb_array_elements(p_checklist) item where
      jsonb_typeof(item) is distinct from 'object'
      or jsonb_typeof(item->'id') is distinct from 'string' or btrim(item->>'id')=''
      or jsonb_typeof(item->'text') is distinct from 'string' or (item->'deleted_at'='null'::jsonb and btrim(item->>'text')='')
      or jsonb_typeof(item->'completed') is distinct from 'boolean'
      or not (item ? 'deleted_at') or jsonb_typeof(item->'deleted_at') not in ('null','string'))
    and (select count(*)=count(distinct item->>'id') from jsonb_array_elements(p_checklist) item)
    and not exists (select 1 from jsonb_array_elements(p_tags) tag where jsonb_typeof(tag) is distinct from 'string' or btrim(tag#>>'{}')='')
  else false end;
$$;
revoke all on function private.valid_task_details(jsonb,jsonb) from public,anon,authenticated;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='tasks_valid_details' and conrelid='public.tasks'::regclass) then
    alter table public.tasks add constraint tasks_valid_details check (private.valid_task_details(checklist,tags));
  end if;
end $$;

-- Endgültiger Ablauf entfernt auch die neu eingeführten fachlichen Inhalte.
create or replace function private.expire_completed_in_list(p_list uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare changed integer; moment timestamptz;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('prio:retention:' || p_list::text,0));
  moment := clock_timestamp();
  update public.tasks set expired_at=moment, deleted_at=moment, updated_at=moment,
    title='Abgelaufene Aufgabe', description=null, due_at=null, reminders='[]'::jsonb,
    checklist='[]'::jsonb, tags='[]'::jsonb, recurrence=null, successor_id=null,
    section_id=null, reopen_context=null, available_from=null
  where list_id=p_list and completed and expired_at is null and completed_expires_at <= moment;
  get diagnostics changed = row_count;
  return changed;
end; $$;
revoke all on function private.expire_completed_in_list(uuid) from public,anon,authenticated;
notify pgrst, 'reload schema';
commit;
