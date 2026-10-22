-- Ein enger, bestätigter Fachbefehl für die native Sitzung. Derselbe atomare
-- Zeilenschreiber wie bei App und MCP; der Bestätigungsschlüssel bleibt im Server.
begin;
create table if not exists private.widget_commands (
  user_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  input_digest text not null,
  created_at timestamptz not null default clock_timestamp(),
  primary key(user_id,request_id)
);
alter table private.widget_commands enable row level security;
revoke all on private.widget_commands from public,anon,authenticated;

create or replace function private.widget_replay(p_id uuid,p_input jsonb) returns boolean
language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.mcp_native(); digest text;
begin
  select input_digest into digest from private.widget_commands where user_id=actor and request_id=p_id;
  if not found then return false; end if;
  if digest is distinct from encode(extensions.digest(convert_to(p_input::text,'UTF8'),'sha256'),'hex') then
    raise exception 'Widget-Auftragskennung wurde wiederverwendet.' using errcode='22023';
  end if;
  return true;
end $$;
revoke all on function private.widget_replay(uuid,jsonb) from public,anon,authenticated;
grant execute on function private.widget_replay(uuid,jsonb) to authenticated;
create or replace function public.widget_replay(p_id uuid,p_input jsonb) returns boolean
language sql security invoker set search_path='' as $$ select private.widget_replay(p_id,p_input) $$;
revoke all on function public.widget_replay(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.widget_replay(uuid,jsonb) to authenticated;

create or replace function private.widget_commit(p_request text,p_proof text) returns text
language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.mcp_native(); body jsonb; secret text; command jsonb; change jsonb; guard jsonb;
  lock_key text; list_id uuid; affected uuid[]; result jsonb;
begin
  select command_key into secret from private.mcp_settings where singleton;
  if secret is null or octet_length(p_request)>2097152 or p_proof !~ '^[0-9a-f]{64}$'
    or encode(extensions.hmac(convert_to(p_request,'UTF8'),convert_to(secret,'UTF8'),'sha256'),'hex') is distinct from p_proof then
    raise exception 'Ungültige Widget-Bestätigung.' using errcode='42501';
  end if;
  body:=p_request::jsonb; command:=body->'command';
  if body->>'purpose' is distinct from 'prio-widget-v1' or body->>'user_id' is distinct from actor::text
    or command->>'userId' is distinct from actor::text
    or abs(extract(epoch from clock_timestamp())-(body->>'issued_at')::numeric)>300
    or jsonb_typeof(body->'changes') is distinct from 'array' or jsonb_array_length(body->'changes')>10000
    or jsonb_typeof(body->'guards') is distinct from 'array'
    or exists(select 1 from jsonb_array_elements(body->'changes') x where x->>'table' not in ('lists','tasks')) then
    raise exception 'Ungültiger Widget-Auftrag.' using errcode='22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('prio:widget:'||actor||':'||(command->>'id')::uuid,0));
  if private.widget_replay((command->>'id')::uuid,command) then return 'committed'; end if;
  if (select count(*) from private.widget_commands where user_id=actor and created_at>clock_timestamp()-interval '1 minute')>=120 then
    raise exception 'Zu viele Widget-Aufträge.' using errcode='54000';
  end if;
  for lock_key in select distinct 'prio:'||(x->>'table')||':'||(x->'row'->>'id')::uuid
    from jsonb_array_elements(body->'changes') x order by 1 loop
    perform pg_advisory_xact_lock(hashtextextended(lock_key,0));
  end loop;
  select array_agg(distinct id order by id) into affected from (
    select (x->>'list_id')::uuid id from jsonb_array_elements(body->'guards') x
    union select case when x->>'table'='lists' then (x->'row'->>'id')::uuid else (x->'row'->>'list_id')::uuid end
      from jsonb_array_elements(body->'changes') x
  ) ids;
  foreach list_id in array coalesce(affected,'{}'::uuid[]) loop
    perform pg_advisory_xact_lock(hashtextextended('prio:retention:'||list_id,0));
    perform private.expire_completed_in_list(list_id);
  end loop;
  for guard in select value from jsonb_array_elements(body->'guards') loop
    if not private.can_access_list((guard->>'list_id')::uuid)
      or (select to_jsonb(l) from public.lists l where l.id=(guard->>'list_id')::uuid) is distinct from guard->'row'
      or private.mcp_positions((guard->>'list_id')::uuid) is distinct from guard->'positions' then return 'conflict'; end if;
  end loop;
  begin
    for change in select value from jsonb_array_elements(body->'changes') loop
      result:=private.sync_write(change->>'table',change->'row',change->'expected');
      if result->>'kind'<>'written' then raise exception 'widget-conflict' using errcode='P0002'; end if;
    end loop;
    -- Dauerhaft nur der Digest: Wiederholungssicherheit ohne gespeicherte Notizen.
    insert into private.widget_commands(user_id,request_id,input_digest) values(actor,(command->>'id')::uuid,
      encode(extensions.digest(convert_to(command::text,'UTF8'),'sha256'),'hex'));
    return 'committed';
  exception when sqlstate 'P0002' then return 'conflict'; end;
end $$;
revoke all on function private.widget_commit(text,text) from public,anon,authenticated;
grant execute on function private.widget_commit(text,text) to authenticated;
create or replace function public.widget_commit(p_request text,p_proof text) returns text
language sql security invoker set search_path='' as $$ select private.widget_commit(p_request,p_proof) $$;
revoke all on function public.widget_commit(text,text) from public,anon,authenticated;
grant execute on function public.widget_commit(text,text) to authenticated;
notify pgrst,'reload schema';
commit;
