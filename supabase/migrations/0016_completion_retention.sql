-- Abschlussfrist und Rückkehrkontext. Schema/Funktionen bleiben wiederholbar.
begin;
alter table public.lists add column if not exists keep_completed boolean not null default false;
alter table public.lists add column if not exists completion_retention_started_at timestamptz;
alter table public.tasks add column if not exists completed_expires_at timestamptz;
alter table public.tasks add column if not exists expired_at timestamptz;
alter table public.tasks add column if not exists reopen_context jsonb;
-- Wiederöffnen kann zwischen zwei Nachbarn einfügen, ohne die ganze Gruppe
-- umzuschreiben. Vorhandene int32-Werte bleiben exakt darstellbar.
alter table public.tasks alter column position type double precision using position::double precision;
create index if not exists tasks_completion_expiry_idx on public.tasks(completed_expires_at)
  where completed and expired_at is null;

create or replace function private.expire_completed_in_list(p_list uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare changed integer; moment timestamptz;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('prio:retention:' || p_list::text,0));
  moment := clock_timestamp();
  -- Der Rest ist ein Synchronisationsvermerk. Fachlicher Inhalt verschwindet.
  update public.tasks set expired_at=moment, deleted_at=moment, updated_at=moment,
    title='Abgelaufene Aufgabe', description=null, due_at=null, reminders='[]'::jsonb,
    recurrence=null, successor_id=null, section_id=null, reopen_context=null
  where list_id=p_list and completed and expired_at is null and completed_expires_at <= moment;
  get diagnostics changed = row_count;
  return changed;
end; $$;
revoke all on function private.expire_completed_in_list(uuid) from public,anon,authenticated;

create or replace function private.expire_completed_tasks()
returns integer language plpgsql security definer set search_path = '' as $$
declare target uuid; changed integer := 0;
begin
  for target in select distinct list_id from public.tasks
    where completed and expired_at is null and completed_expires_at <= clock_timestamp() order by list_id
  loop
    changed := changed + private.expire_completed_in_list(target);
  end loop;
  return changed;
end; $$;
revoke all on function private.expire_completed_tasks() from public,anon,authenticated;
notify pgrst, 'reload schema';
commit;
