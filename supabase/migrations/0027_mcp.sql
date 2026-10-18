-- MCP: widerrufbare Verbindungen und atomare, attestierte Fachbefehle.
-- Keine Datenumschreibung. Die privaten Sicherheitstabellen sind keine
-- synchronisierten App-Entitäten: RLS ohne Tabellenrechte, Zugang nur per RPC.
begin;
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create table if not exists private.mcp_settings (
  singleton boolean primary key default true check(singleton),
  resource text not null,
  command_key text
);
insert into private.mcp_settings(singleton,resource) values(true,'https://prio-krischi.pages.dev/mcp') on conflict do nothing;
create table if not exists private.mcp_connections (
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid not null,
  name text not null,
  redirect_uri text not null,
  resource text not null,
  can_write boolean not null default true,
  can_share boolean not null default false,
  time_zone text not null default 'Europe/Berlin',
  approved_at timestamptz not null default clock_timestamp(),
  revoked_at timestamptz,
  primary key(user_id,client_id)
);
create table if not exists private.mcp_commands (
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid not null,
  request_id uuid not null,
  action text not null,
  input jsonb not null,
  result jsonb not null,
  changes jsonb not null,
  created_at timestamptz not null default clock_timestamp(),
  primary key(user_id,client_id,request_id)
);
create index if not exists mcp_commands_history on private.mcp_commands(user_id,client_id,created_at desc);
-- Externe Programme bekommen undurchsichtige Prio-Tokens. Supabase-Tokens
-- und vertrauliche OAuth-Client-Secrets bleiben verschlüsselt beim Worker.
create table if not exists private.mcp_oauth_clients (
  id uuid primary key, secret_cipher text not null, metadata jsonb not null,
  created_at timestamptz not null default clock_timestamp()
);
create table if not exists private.mcp_oauth_tokens (
  access_hash text primary key,refresh_hash text unique not null,bundle_cipher text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid not null references private.mcp_oauth_clients(id),session_id uuid not null,
  expires_at timestamptz not null,refresh_expires_at timestamptz not null default clock_timestamp()+interval '90 days',
  used_at timestamptz,replacement text,
  lease uuid,locked_until timestamptz,created_at timestamptz not null default clock_timestamp()
);
alter table private.mcp_oauth_clients enable row level security;
alter table private.mcp_oauth_tokens enable row level security;
revoke all on private.mcp_oauth_clients,private.mcp_oauth_tokens from public,anon,authenticated;
alter table private.mcp_settings enable row level security;
alter table private.mcp_connections enable row level security;
alter table private.mcp_commands enable row level security;
revoke all on private.mcp_settings,private.mcp_connections,private.mcp_commands from public,anon,authenticated;

create or replace function private.mcp_claims() returns jsonb
language sql stable set search_path='' as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
revoke all on function private.mcp_claims() from public,anon,authenticated;

create or replace function private.mcp_native() returns uuid
language plpgsql stable security definer set search_path='' as $$
begin
  if auth.uid() is null or private.mcp_claims()->>'client_id' is not null then
    raise exception 'Diese Aktion gehört zur Prio-Kontoseite.' using errcode='42501';
  end if;
  return auth.uid();
end $$;
revoke all on function private.mcp_native() from public,anon,authenticated;

create or replace function private.mcp_connection(p_permission text default 'read') returns private.mcp_connections
language plpgsql security definer set search_path='' as $$
declare c private.mcp_connections; claims jsonb:=private.mcp_claims(); client uuid;
begin
  if auth.uid() is null or claims->>'client_id' is null then raise exception 'MCP-Anmeldung erforderlich.' using errcode='28000'; end if;
  client:=(claims->>'client_id')::uuid;
  select * into c from private.mcp_connections where user_id=auth.uid() and client_id=client for share;
  if not found or c.revoked_at is not null or c.resource is distinct from (select resource from private.mcp_settings where singleton)
    or coalesce((claims->>'iat')::bigint,0)<floor(extract(epoch from c.approved_at)) then
    raise exception 'Diese Verbindung ist nicht freigegeben oder wurde widerrufen.' using errcode='42501';
  end if;
  -- Ein signiertes Token allein ersetzt keine weiterhin aktive OAuth-Sitzung.
  if not exists(select 1 from auth.sessions s where s.id=(claims->>'session_id')::uuid and s.user_id=auth.uid()
      and s.oauth_client_id=client and (s.not_after is null or s.not_after>clock_timestamp()))
    or not exists(select 1 from auth.oauth_consents g where g.user_id=auth.uid() and g.client_id=client and g.revoked_at is null) then
    raise exception 'Die OAuth-Freigabe ist nicht mehr aktiv.' using errcode='42501';
  end if;
  if p_permission not in ('read','write','share') or p_permission='write' and not c.can_write
    or p_permission='share' and (not c.can_write or not c.can_share) then
    raise exception 'Diese Verbindung hat dafür keine Erlaubnis. Freigabe unter Konto → KI-Verbindungen ändern.' using errcode='42501';
  end if;
  return c;
end $$;
revoke all on function private.mcp_connection(text) from public,anon,authenticated;

-- Globale PostgREST-Eingangsprüfung: OAuth-Clients können weder die nativen
-- Schreib-RPCs noch Tabellen oder Freigabefunktionen als Umweg benutzen.
create or replace function private.mcp_request_guard() returns void
language plpgsql security definer set search_path='' as $$
begin
  if private.mcp_claims()->>'client_id' is null then return; end if;
  perform private.mcp_connection();
  if current_setting('request.method',true) is distinct from 'POST'
    or coalesce(current_setting('request.path',true),'') not in
      ('/rpc/mcp_context','/rpc/mcp_snapshot','/rpc/mcp_commit','/rpc/mcp_history','/rpc/mcp_replay','/rpc/mcp_resolve_user') then
    raise exception 'OAuth-Verbindungen greifen ausschließlich über die freigegebenen MCP-Befehle zu.' using errcode='42501';
  end if;
end $$;
revoke all on function private.mcp_request_guard() from public,anon,authenticated;
grant usage on schema private to anon;
grant execute on function private.mcp_request_guard() to anon,authenticated;
do $$ begin
  if exists(select 1 from pg_roles where rolname='authenticator') then
    -- Ein fremder bereits eingerichteter Hook wird nicht überschrieben.
    if exists(select 1 from pg_db_role_setting s,unnest(s.setconfig) v where s.setrole=(select oid from pg_roles where rolname='authenticator')
      and v like 'pgrst.db_pre_request=%' and v<>'pgrst.db_pre_request=private.mcp_request_guard') then
      raise exception 'Vorhandenen PostgREST-Eingangshook vor der MCP-Aktivierung zusammenführen.';
    end if;
    alter role authenticator set pgrst.db_pre_request='private.mcp_request_guard';
  end if;
end $$;

create or replace function private.mcp_manage(p_action text,p_data jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.mcp_native(); c private.mcp_connections; a record; client uuid; zone text;
begin
  if p_action='list' then
    return coalesce((select jsonb_agg(to_jsonb(r) order by r.approved_at desc) from
      (select client_id,name,redirect_uri,resource,can_write,can_share,time_zone,approved_at,revoked_at from private.mcp_connections where user_id=actor) r),'[]');
  elsif p_action in ('authorize','resume') then
    select o.client_id,o.user_id,o.resource,o.redirect_uri,o.expires_at,o.status,oauth_client.client_name into a
      from auth.oauth_authorizations o join auth.oauth_clients oauth_client on oauth_client.id=o.client_id
      where o.authorization_id=p_data->>'authorization_id' and oauth_client.deleted_at is null
        and exists(select 1 from private.mcp_oauth_clients registered where registered.id=oauth_client.id);
    if not found or a.expires_at<=clock_timestamp() or a.status::text is distinct from (case when p_action='resume' then 'approved' else 'pending' end)
      or a.user_id is not null and a.user_id<>actor
      or a.resource is not null and a.resource is distinct from (select resource from private.mcp_settings where singleton) then
      raise exception 'Diese Verbindungsanfrage ist ungültig oder abgelaufen.' using errcode='22023';
    end if;
    if p_action='resume' then
      return jsonb_build_object('client_id',a.client_id,'resumable',exists(select 1 from private.mcp_connections existing
        where existing.user_id=actor and existing.client_id=a.client_id and existing.revoked_at is null));
    end if;
    zone:=coalesce(p_data->>'time_zone','Europe/Berlin');
    if not exists(select 1 from pg_timezone_names where name=zone) then raise exception 'Ungültige Zeitzone.' using errcode='22023'; end if;
    insert into private.mcp_connections(user_id,client_id,name,redirect_uri,resource,can_write,can_share,time_zone)
      values(actor,a.client_id,coalesce(a.client_name,'KI-Programm'),a.redirect_uri,(select resource from private.mcp_settings where singleton),
        coalesce((p_data->>'can_write')::boolean,true),coalesce((p_data->>'can_share')::boolean,false),zone)
      on conflict(user_id,client_id) do update set name=excluded.name,redirect_uri=excluded.redirect_uri,resource=excluded.resource,
        can_write=excluded.can_write,can_share=excluded.can_share,time_zone=excluded.time_zone,approved_at=clock_timestamp(),revoked_at=null;
    return jsonb_build_object('client_id',a.client_id);
  elsif p_action in ('revoke','permissions') then
    client:=(p_data->>'client_id')::uuid;
    select * into c from private.mcp_connections where user_id=actor and client_id=client for update;
    if not found then raise exception 'Diese Verbindung existiert nicht.' using errcode='22023'; end if;
    if p_action='revoke' then
      update private.mcp_connections set revoked_at=clock_timestamp() where user_id=actor and client_id=client;
      update private.mcp_oauth_tokens set bundle_cipher='' where user_id=actor and client_id=client;
    else
      if c.revoked_at is not null then raise exception 'Eine widerrufene Verbindung muss neu verbunden werden.' using errcode='42501'; end if;
      zone:=coalesce(p_data->>'time_zone',c.time_zone);
      if not exists(select 1 from pg_timezone_names where name=zone) then raise exception 'Ungültige Zeitzone.' using errcode='22023'; end if;
      update private.mcp_connections set can_write=coalesce((p_data->>'can_write')::boolean,c.can_write),
        can_share=coalesce((p_data->>'can_share')::boolean,c.can_share),time_zone=zone where user_id=actor and client_id=client;
    end if;
    return jsonb_build_object('client_id',client);
  end if;
  raise exception 'Unbekannte Verbindungsaktion.' using errcode='22023';
end $$;
revoke all on function private.mcp_manage(text,jsonb) from public,anon,authenticated;
grant execute on function private.mcp_manage(text,jsonb) to authenticated;
create or replace function public.mcp_manage(p_action text,p_data jsonb default '{}') returns jsonb
language sql security invoker set search_path='' as $$ select private.mcp_manage(p_action,p_data) $$;
revoke all on function public.mcp_manage(text,jsonb) from public,anon,authenticated;
grant execute on function public.mcp_manage(text,jsonb) to authenticated;

create or replace function private.mcp_context() returns jsonb
language plpgsql security definer set search_path='' as $$
declare c private.mcp_connections:=private.mcp_connection();
begin
  return jsonb_build_object('user_id',auth.uid(),'client_id',c.client_id,'resource',c.resource,'can_write',c.can_write,'can_share',c.can_share,
    'time_zone',c.time_zone,'now',clock_timestamp(),'username',(select username from public.profiles where id=auth.uid()));
end $$;
revoke all on function private.mcp_context() from public,anon,authenticated;
grant execute on function private.mcp_context() to authenticated;
create or replace function public.mcp_context() returns jsonb language sql security invoker set search_path='' as $$ select private.mcp_context() $$;
revoke all on function public.mcp_context() from public,anon,authenticated;
grant execute on function public.mcp_context() to authenticated;

create or replace function private.mcp_snapshot(p_filter jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare c private.mcp_connections:=private.mcp_connection(); list_ids uuid[]; task_rows jsonb:='[]'; max_rows integer;
begin
  select array_agg(l.id order by l.id) into list_ids from public.lists l
    where private.can_access_list(l.id) and (not (p_filter ? 'list_ids') or l.id in(select value::uuid from jsonb_array_elements_text(p_filter->'list_ids')));
  if cardinality(list_ids)>1000 then raise exception 'Zu viele Listen; Auswahl eingrenzen.' using errcode='54000'; end if;
  max_rows:=least(greatest(coalesce((p_filter->>'limit')::integer,500),1),10001);
  if coalesce((p_filter->>'include_tasks')::boolean,false) then
    select coalesce(jsonb_agg(jsonb_build_object('row',to_jsonb(t),'revision',md5(to_jsonb(t)::text)) order by t.id),'[]') into task_rows from
      (select t.* from public.tasks t where t.list_id=any(list_ids)
        and (not (p_filter ? 'task_ids') or t.id in(select value::uuid from jsonb_array_elements_text(p_filter->'task_ids')))
        and (not (p_filter ? 'after') or t.id>(p_filter->>'after')::uuid)
        and (p_filter->>'state'='all' or coalesce(p_filter->>'state','open')='open' and not t.completed and t.deleted_at is null and t.expired_at is null
          or p_filter->>'state'='completed' and t.completed and t.deleted_at is null and t.expired_at is null and (t.completed_expires_at is null or t.completed_expires_at>clock_timestamp())
          or p_filter->>'state'='deleted' and t.deleted_at is not null and t.expired_at is null)
        and (not (p_filter ? 'tags') or not exists(
          select 1 from jsonb_array_elements_text(p_filter->'tags') wanted where not exists(
            select 1 from jsonb_array_elements_text(t.tags) present where
              lower(regexp_replace(btrim(normalize(present.value,NFKC)),'\s+',' ','g')) =
              lower(regexp_replace(btrim(normalize(wanted.value,NFKC)),'\s+',' ','g')))))
        and (not (p_filter ? 'due_before') or t.due_at<=(p_filter->>'due_before')::timestamptz)
        and (not (p_filter ? 'due_after') or t.due_at>=(p_filter->>'due_after')::timestamptz)
        and (not coalesce((p_filter->>'available_now')::boolean,false) or t.available_from is null or t.available_from<=clock_timestamp())
        and (not (p_filter ? 'text') or position(lower(p_filter->>'text') in lower(concat_ws(' ',t.title,t.description,
          (select string_agg(value,' ') from jsonb_array_elements_text(t.tags)),
          (select string_agg(item->>'text',' ') from jsonb_array_elements(t.checklist) item where item->>'deleted_at' is null))))>0)
      order by t.id limit max_rows) t;
  end if;
  return jsonb_build_object(
    'lists',coalesce((select jsonb_agg(jsonb_build_object('row',to_jsonb(l),'revision',md5(to_jsonb(l)::text)) order by l.id) from public.lists l where l.id=any(list_ids)),'[]'),
    'tasks',task_rows,
    'members',coalesce((select jsonb_agg(jsonb_build_object('row',to_jsonb(m),'revision',md5(to_jsonb(m)::text))) from public.list_members m where m.list_id=any(list_ids)),'[]'),
    'preferences',coalesce((select jsonb_agg(jsonb_build_object('row',to_jsonb(p),'revision',md5(to_jsonb(p)::text))) from public.list_preferences p where p.user_id=auth.uid() and p.list_id=any(list_ids)),'[]'),
    'userPreferences',coalesce((select jsonb_agg(jsonb_build_object('row',to_jsonb(p),'revision',md5(to_jsonb(p)::text))) from public.user_preferences p where p.id=auth.uid()),'[]'),
    'profiles',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'username',p.username)) from public.profiles p where p.id=auth.uid()
      or p.id in(select owner_id from public.lists where id=any(list_ids)) or p.id in(select user_id from public.list_members where list_id=any(list_ids) and deleted_at is null)),'[]'));
end $$;
revoke all on function private.mcp_snapshot(jsonb) from public,anon,authenticated;
grant execute on function private.mcp_snapshot(jsonb) to authenticated;
create or replace function public.mcp_snapshot(p_filter jsonb default '{}') returns jsonb language sql security invoker set search_path='' as $$ select private.mcp_snapshot(p_filter) $$;
revoke all on function public.mcp_snapshot(jsonb) from public,anon,authenticated;
grant execute on function public.mcp_snapshot(jsonb) to authenticated;

create or replace function private.mcp_replay(p_request_id uuid,p_input jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare c private.mcp_connections:=private.mcp_connection(); saved private.mcp_commands;
begin
  select * into saved from private.mcp_commands where user_id=auth.uid() and client_id=c.client_id and request_id=p_request_id;
  if not found then return null; end if;
  if saved.input ? '__erased_digest' then
    if saved.input->>'__erased_digest' is distinct from encode(extensions.digest(convert_to(p_input::text,'UTF8'),'sha256'),'hex') then
      raise exception 'Diese Auftragskennung wurde für einen anderen Auftrag verwendet.' using errcode='22023';
    end if;
    return saved.result;
  end if;
  if saved.input is distinct from p_input then raise exception 'Diese Auftragskennung wurde für einen anderen Auftrag verwendet.' using errcode='22023'; end if;
  return saved.result;
end $$;
revoke all on function private.mcp_replay(uuid,jsonb) from public,anon,authenticated;
grant execute on function private.mcp_replay(uuid,jsonb) to authenticated;
create or replace function public.mcp_replay(p_request_id uuid,p_input jsonb) returns jsonb language sql security invoker set search_path='' as $$ select private.mcp_replay(p_request_id,p_input) $$;
revoke all on function public.mcp_replay(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.mcp_replay(uuid,jsonb) to authenticated;

create or replace function private.mcp_history(p_request_id uuid default null,p_limit integer default 20) returns jsonb
language plpgsql security definer set search_path='' as $$
declare c private.mcp_connections:=private.mcp_connection();
begin
  if p_request_id is not null then return (select to_jsonb(r) from private.mcp_commands r where r.user_id=auth.uid() and r.client_id=c.client_id and r.request_id=p_request_id); end if;
  return coalesce((select jsonb_agg(to_jsonb(r) order by r.created_at desc) from
    (select request_id,action,created_at,jsonb_array_length(changes) as changed_rows from private.mcp_commands where user_id=auth.uid() and client_id=c.client_id order by created_at desc limit least(greatest(p_limit,1),100)) r),'[]');
end $$;
revoke all on function private.mcp_history(uuid,integer) from public,anon,authenticated;
grant execute on function private.mcp_history(uuid,integer) to authenticated;
create or replace function public.mcp_history(p_request_id uuid default null,p_limit integer default 20) returns jsonb language sql security invoker set search_path='' as $$ select private.mcp_history(p_request_id,p_limit) $$;
revoke all on function public.mcp_history(uuid,integer) from public,anon,authenticated;
grant execute on function public.mcp_history(uuid,integer) to authenticated;

create or replace function private.mcp_resolve_user(p_username text) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
  perform private.mcp_connection('share');
  return (select jsonb_build_object('id',id,'username',username) from public.profiles where username=lower(trim(p_username)));
end $$;
revoke all on function private.mcp_resolve_user(text) from public,anon,authenticated;
grant execute on function private.mcp_resolve_user(text) to authenticated;
create or replace function public.mcp_resolve_user(p_username text) returns jsonb language sql security invoker set search_path='' as $$ select private.mcp_resolve_user(p_username) $$;
revoke all on function public.mcp_resolve_user(text) from public,anon,authenticated;
grant execute on function public.mcp_resolve_user(text) to authenticated;

-- Vor-/Nachstände erfassen auch serverseitige Folgen einer Listenregel.
create or replace function private.mcp_rows(p_lists uuid[]) returns jsonb
language sql security definer set search_path='' as $$
  select coalesce(jsonb_object_agg(key,jsonb_build_object('table',kind,'row',row)),'{}') from (
    select 'lists:'||id as key,'lists' as kind,to_jsonb(l) as row from public.lists l where id=any(p_lists)
    union all select 'tasks:'||id,'tasks',to_jsonb(t) from public.tasks t where list_id=any(p_lists)
    union all select 'members:'||list_id||':'||user_id,'members',to_jsonb(m) from public.list_members m where list_id=any(p_lists)
    union all select 'preferences:'||list_id||':'||user_id,'preferences',to_jsonb(p) from public.list_preferences p where list_id=any(p_lists) and user_id=auth.uid()
    union all select 'userPreferences:'||id,'userPreferences',to_jsonb(p) from public.user_preferences p where id=auth.uid()
  ) rows;
$$;
revoke all on function private.mcp_rows(uuid[]) from public,anon,authenticated;

create or replace function private.mcp_positions(p_list uuid) returns jsonb
language sql security definer set search_path='' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'section_id',section_id,'position',position,'completed',completed,'deleted_at',deleted_at) order by id),'[]') from public.tasks where list_id=p_list;
$$;
revoke all on function private.mcp_positions(uuid) from public,anon,authenticated;

create or replace function private.mcp_commit(p_request text,p_proof text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare c private.mcp_connections:=private.mcp_connection('write'); body jsonb; secret text; change jsonb; guard jsonb;
  lock_key text; list_id uuid; affected uuid[]; result jsonb; before_rows jsonb; after_rows jsonb; audit jsonb; response jsonb; replay jsonb;
  code text; message text; request_id uuid;
begin
  select command_key into secret from private.mcp_settings where singleton;
  if secret is null or octet_length(p_request)>16777216 or p_proof !~ '^[0-9a-f]{64}$'
    or encode(extensions.hmac(convert_to(p_request,'UTF8'),convert_to(secret,'UTF8'),'sha256'),'hex') is distinct from p_proof then
    raise exception 'Ungültige Befehlsbestätigung.' using errcode='42501';
  end if;
  body:=p_request::jsonb;
  if body->>'user_id' is distinct from auth.uid()::text or body->>'client_id' is distinct from c.client_id::text
    or body->>'resource' is distinct from c.resource or abs(extract(epoch from clock_timestamp())-(body->>'issued_at')::numeric)>300
    or jsonb_typeof(body->'changes') is distinct from 'array' or jsonb_array_length(body->'changes')>10000
    or jsonb_typeof(body->'guards') is distinct from 'array' then
    raise exception 'Ungültiger Fachbefehl.' using errcode='22023';
  end if;
  request_id:=(body->>'request_id')::uuid;
  perform pg_advisory_xact_lock(hashtextextended('prio:mcp:'||auth.uid()||':'||c.client_id||':'||request_id,0));
  replay:=private.mcp_replay(request_id,body->'input');
  if replay is not null then return replay; end if;
  if (select count(*) from private.mcp_commands where user_id=auth.uid() and client_id=c.client_id and created_at>clock_timestamp()-interval '1 minute')>=120 then
    raise exception 'Zu viele Änderungen; bitte kurz warten.' using errcode='54000';
  end if;
  if exists(select 1 from jsonb_array_elements(body->'changes') x where x->>'table'='members'
    or x->>'table'='lists' and (x->'row'->'is_shared') is distinct from (x->'expected'->'is_shared') and coalesce((x->'row'->>'is_shared')::boolean,false)) then
    perform private.mcp_connection('share');
  end if;
  -- Dieselbe Reihenfolge wie der geschützte Zeilenschreiber: Kennungen vor Listen.
  for lock_key in select distinct 'prio:'||(x->>'table')||':'||case when x->>'table' in ('members','preferences')
    then (x->'row'->>'list_id')::uuid::text||':'||(x->'row'->>'user_id')::uuid::text else (x->'row'->>'id')::uuid::text end
    from jsonb_array_elements(body->'changes') x order by 1 loop perform pg_advisory_xact_lock(hashtextextended(lock_key,0)); end loop;
  select array_agg(distinct id order by id) into affected from (
    select (x->>'list_id')::uuid id from jsonb_array_elements(body->'guards') x
    union select case when x->>'table'='lists' then (x->'row'->>'id')::uuid else (x->'row'->>'list_id')::uuid end from jsonb_array_elements(body->'changes') x where x->>'table'<>'userPreferences'
  ) ids;
  foreach list_id in array coalesce(affected,'{}'::uuid[]) loop
    perform pg_advisory_xact_lock(hashtextextended('prio:retention:'||list_id,0));
    perform private.expire_completed_in_list(list_id);
  end loop;
  for guard in select value from jsonb_array_elements(body->'guards') loop
    if (select to_jsonb(l) from public.lists l where l.id=(guard->>'list_id')::uuid) is distinct from guard->'row'
      or private.mcp_positions((guard->>'list_id')::uuid) is distinct from guard->'positions' then
      return jsonb_build_object('kind','scope_conflict','message','Listenbestand wurde inzwischen geändert. Neu lesen und planen.');
    end if;
  end loop;
  before_rows:=private.mcp_rows(affected);
  begin
    for change in select value from jsonb_array_elements(body->'changes') loop
      result:=private.sync_write(change->>'table',change->'row',change->'expected');
      if result->>'kind'<>'written' then raise exception 'mcp-conflict' using errcode='P0002'; end if;
    end loop;
    after_rows:=private.mcp_rows(affected);
    select coalesce(jsonb_agg(jsonb_build_object('table',coalesce(a.value->>'table',b.value->>'table'),'before',b.value->'row','after',a.value->'row') order by coalesce(a.key,b.key)),'[]') into audit
      from jsonb_each(before_rows) b full join jsonb_each(after_rows) a using(key) where b.value is distinct from a.value;
    response:=jsonb_build_object('kind','committed','request_id',request_id,'action',body->>'action','changes',audit,'effects',body->'effects','saved_at',clock_timestamp());
    insert into private.mcp_commands(user_id,client_id,request_id,action,input,result,changes)
      values(auth.uid(),c.client_id,request_id,body->>'action',body->'input',response,audit);
    return response;
  exception
    when sqlstate 'P0002' then return jsonb_build_object('kind','conflict','detail',result);
    when others then
      get stacked diagnostics code=returned_sqlstate,message=message_text;
      return jsonb_build_object('kind','rejected','code',code,'message',message);
  end;
end $$;
revoke all on function private.mcp_commit(text,text) from public,anon,authenticated;
grant execute on function private.mcp_commit(text,text) to authenticated;
create or replace function public.mcp_commit(p_request text,p_proof text) returns jsonb language sql security invoker set search_path='' as $$ select private.mcp_commit(p_request,p_proof) $$;
revoke all on function public.mcp_commit(text,text) from public,anon,authenticated;
grant execute on function public.mcp_commit(text,text) to authenticated;

-- Endgültig abgelaufener Inhalt bleibt auch nicht als Kopie im MCP-Verlauf.
-- Nur der Hash der ursprünglichen Absicht bleibt für sichere Retries erhalten.
create or replace function private.mcp_erase_expired_history() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  update private.mcp_commands set input=jsonb_build_object('__erased_digest',encode(extensions.digest(convert_to(input::text,'UTF8'),'sha256'),'hex')),
    result=jsonb_build_object('kind','committed','request_id',request_id,'action',action,'changes','[]'::jsonb,'history_erased',true),changes='[]'::jsonb
    where not(input ? '__erased_digest') and exists(select 1 from jsonb_array_elements(changes) entry
      where entry->>'table'='tasks' and (entry->'after'->>'id'=new.id::text or entry->'before'->>'id'=new.id::text));
  return new;
end $$;
revoke all on function private.mcp_erase_expired_history() from public,anon,authenticated;
drop trigger if exists mcp_erase_expired_history on public.tasks;
create trigger mcp_erase_expired_history after update of expired_at on public.tasks for each row
  when(old.expired_at is null and new.expired_at is not null) execute function private.mcp_erase_expired_history();

notify pgrst,'reload config';
notify pgrst,'reload schema';
commit;
