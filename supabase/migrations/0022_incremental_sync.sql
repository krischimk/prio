-- Inkrementelles Lesen ohne Geräteuhren und ohne Lücken bei späten Commits.
-- Pro Zeile bleibt nur die letzte schreibende Haupttransaktion gespeichert.
-- Ein pg_snapshot merkt auch Transaktionen, die beim letzten Lesen noch liefen.
begin;
create table if not exists private.sync_row_versions (
  table_name text not null,
  row_id text not null,
  changed_in xid8 not null,
  primary key (table_name, row_id)
);
create index if not exists sync_row_versions_transaction on private.sync_row_versions(changed_in);
alter table private.sync_row_versions enable row level security;
revoke all on private.sync_row_versions from public, anon, authenticated;

create or replace function private.track_sync_row()
returns trigger language plpgsql security definer set search_path = '' as $$
declare row_key text;
begin
  if TG_OP = 'UPDATE' and to_jsonb(NEW) = to_jsonb(OLD) then return NEW; end if;
  row_key := case when TG_TABLE_NAME in ('list_members', 'list_preferences')
    then (to_jsonb(NEW)->>'list_id') || ':' || (to_jsonb(NEW)->>'user_id') else (to_jsonb(NEW)->>'id') end;
  insert into private.sync_row_versions(table_name,row_id,changed_in)
  values (TG_ARGV[0], row_key, pg_current_xact_id())
  on conflict (table_name,row_id) do update set changed_in = excluded.changed_in;
  return NEW;
end $$;
revoke all on function private.track_sync_row() from public,anon,authenticated;

drop trigger if exists sync_version on public.lists;
create trigger sync_version after insert or update on public.lists for each row execute function private.track_sync_row('lists');
drop trigger if exists sync_version on public.list_members;
create trigger sync_version after insert or update on public.list_members for each row execute function private.track_sync_row('members');
drop trigger if exists sync_version on public.tasks;
create trigger sync_version after insert or update on public.tasks for each row execute function private.track_sync_row('tasks');
drop trigger if exists sync_version on public.list_preferences;
create trigger sync_version after insert or update on public.list_preferences for each row execute function private.track_sync_row('preferences');
drop trigger if exists sync_version on public.user_preferences;
create trigger sync_version after insert or update on public.user_preferences for each row execute function private.track_sync_row('userPreferences');

-- Nur bislang unbekannte Zeilen ergänzen. Wiederholen verändert keine Bestände.
insert into private.sync_row_versions(table_name,row_id,changed_in)
select 'lists',id::text,pg_current_xact_id() from public.lists
union all select 'members',list_id::text||':'||user_id::text,pg_current_xact_id() from public.list_members
union all select 'tasks',id::text,pg_current_xact_id() from public.tasks
union all select 'preferences',list_id::text||':'||user_id::text,pg_current_xact_id() from public.list_preferences
union all select 'userPreferences',id::text,pg_current_xact_id() from public.user_preferences
on conflict do nothing;

create or replace function private.sync_pull(p_since text default null, p_lists uuid[] default '{}', p_after text default null, p_limit integer default 500)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  previous pg_snapshot;
  current_view pg_snapshot := pg_current_snapshot();
  scope uuid[];
  reset boolean;
  page_size integer := greatest(1,least(coalesce(p_limit,500),500));
  rows jsonb;
  more boolean;
  next_key text;
begin
  if actor is null then raise exception 'Anmeldung erforderlich.' using errcode = '42501'; end if;
  begin previous := p_since::pg_snapshot;
  exception when invalid_text_representation then previous := null;
  end;
  if previous is not null and pg_snapshot_xmax(previous) > pg_snapshot_xmax(current_view) then previous := null; end if;
  select coalesce(array_agg(l.id order by l.id),'{}') into scope from public.lists l
    where l.owner_id = actor or (l.deleted_at is null and exists (
      select 1 from public.list_members m where m.list_id=l.id and m.user_id=actor and m.deleted_at is null
    ));
  -- Neue Freigaben müssen auch Zeilen liefern, die lange vor dem Cursor entstanden.
  reset := previous is null or not scope <@ coalesce(p_lists,'{}');
  with versions as materialized (
    select v.table_name,v.row_id from private.sync_row_versions v
    where reset or (v.changed_in >= pg_snapshot_xmin(previous) and not pg_visible_in_snapshot(v.changed_in,previous))
  ), visible as (
    select 'lists:'||l.id::text as key, 'lists' as kind, to_jsonb(l) as row from public.lists l
      join versions v on v.table_name='lists' and v.row_id=l.id::text where l.id=any(scope)
    union all
    select 'members:'||m.list_id::text||':'||m.user_id::text,'members',to_jsonb(m) from public.list_members m
      join versions v on v.table_name='members' and v.row_id=m.list_id::text||':'||m.user_id::text
      where m.user_id=actor or exists(select 1 from public.lists l where l.id=m.list_id and l.owner_id=actor)
    union all
    select 'tasks:'||t.id::text,'tasks',to_jsonb(t) from public.tasks t
      join versions v on v.table_name='tasks' and v.row_id=t.id::text where t.list_id=any(scope)
    union all
    select 'preferences:'||p.list_id::text||':'||p.user_id::text,'preferences',to_jsonb(p) from public.list_preferences p
      join versions v on v.table_name='preferences' and v.row_id=p.list_id::text||':'||p.user_id::text where p.user_id=actor
    union all
    select 'userPreferences:'||p.id::text,'userPreferences',to_jsonb(p) from public.user_preferences p
      join versions v on v.table_name='userPreferences' and v.row_id=p.id::text where p.id=actor
  ), page as materialized (
    select * from visible where p_after is null or key > p_after order by key limit page_size+1
  ), included as (
    select * from page order by key limit page_size
  )
  select coalesce((select jsonb_agg(jsonb_build_object('table',kind,'row',row) order by key) from included),'[]'),
    (select count(*) > page_size from page), (select max(key) from included)
  into rows,more,next_key;
  return jsonb_build_object('changes',rows,'hasMore',more,'nextAfter',case when more then next_key else null end,
    'checkpoint',jsonb_build_object('snapshot',current_view::text,'listIds',to_jsonb(scope)),
    'removedListIds',coalesce((select jsonb_agg(id order by id) from unnest(coalesce(p_lists,'{}')) id where not id=any(scope)),'[]'));
end $$;
revoke all on function private.sync_pull(text,uuid[],text,integer) from public,anon,authenticated;
grant execute on function private.sync_pull(text,uuid[],text,integer) to authenticated;

create or replace function public.sync_pull(p_since text default null,p_lists uuid[] default '{}',p_after text default null,p_limit integer default 500)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select private.sync_pull(p_since,p_lists,p_after,p_limit);
$$;
revoke all on function public.sync_pull(text,uuid[],text,integer) from public,anon,authenticated;
grant execute on function public.sync_pull(text,uuid[],text,integer) to authenticated;
comment on function public.sync_pull(text,uuid[],text,integer) is 'Zugriffsgeschützter Delta-Pull. Checkpoint erst nach vollständiger lokaler Übernahme bestätigen.';
notify pgrst, 'reload schema';
commit;
