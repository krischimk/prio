-- Persönliche Aufnahme je Liste sowie ausdrücklich gewählte Standardliste
-- und Darstellungsmodus. Keine automatische Aufnahme bestehender Listen.
begin;
create table if not exists public.list_preferences (
  list_id uuid not null references public.lists(id),
  user_id uuid not null references auth.users(id),
  include_in_overview boolean not null default false,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  primary key (list_id, user_id)
);
create table if not exists public.user_preferences (
  id uuid primary key references auth.users(id),
  default_list_id uuid references public.lists(id),
  overview_mode text not null default 'by_list' check (overview_mode in ('by_list','newest')),
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz
);
create index if not exists list_preferences_user_id on public.list_preferences(user_id);
alter table public.list_preferences enable row level security;
alter table public.user_preferences enable row level security;
drop policy if exists list_preferences_select_self on public.list_preferences;
create policy list_preferences_select_self on public.list_preferences for select to authenticated using (user_id = auth.uid());
drop policy if exists user_preferences_select_self on public.user_preferences;
create policy user_preferences_select_self on public.user_preferences for select to authenticated using (id = auth.uid());
revoke all on public.list_preferences,public.user_preferences from public,anon,authenticated;
grant select on public.list_preferences,public.user_preferences to authenticated;

-- Derselbe RPC/Basisvergleich wie bei Aufgaben, auch für persönliche Daten.
create or replace function private.sync_preference(p_table text, p_row jsonb, p_expected jsonb)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  row_id text;
  current_row jsonb;
  wanted jsonb;
  expected jsonb;
  lp public.list_preferences%rowtype;
  up public.user_preferences%rowtype;
begin
  if actor is null then raise exception 'Nicht angemeldet.' using errcode = '28000'; end if;
  if p_table not in ('preferences','userPreferences') or p_table is null or jsonb_typeof(p_row) is distinct from 'object' then
    raise exception 'Ungültige Einstellung.' using errcode = '22023';
  end if;
  row_id := case when p_table = 'preferences' then (p_row->>'list_id')::uuid::text || ':' || (p_row->>'user_id')::uuid::text else (p_row->>'id')::uuid::text end;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('prio:' || p_table || ':' || row_id,0));
  if p_table = 'preferences' then
    lp := jsonb_populate_record(null::public.list_preferences,p_row);
    wanted := to_jsonb(lp);
    expected := case when p_expected is null or p_expected = 'null'::jsonb then null else to_jsonb(jsonb_populate_record(null::public.list_preferences,p_expected)) end;
    select to_jsonb(r) into current_row from public.list_preferences r where r.list_id=lp.list_id and r.user_id=lp.user_id for update;
    perform 1 from public.lists l where l.id=lp.list_id for share;
    perform 1 from public.list_members m where m.list_id=lp.list_id and m.user_id=actor for share;
    if lp.user_id is distinct from actor or not private.can_access_list(lp.list_id) then
      raise exception 'Nur deine eigene Auswahl für zugängliche Listen darf geändert werden.' using errcode = '42501';
    end if;
  else
    up := jsonb_populate_record(null::public.user_preferences,p_row);
    wanted := to_jsonb(up);
    expected := case when p_expected is null or p_expected = 'null'::jsonb then null else to_jsonb(jsonb_populate_record(null::public.user_preferences,p_expected)) end;
    select to_jsonb(r) into current_row from public.user_preferences r where r.id=up.id for update;
    if up.id is distinct from actor then raise exception 'Nur deine eigenen Einstellungen dürfen geändert werden.' using errcode = '42501'; end if;
    if up.default_list_id is not null and (current_row is null or wanted->'default_list_id' is distinct from current_row->'default_list_id') then
      perform 1 from public.lists l where l.id=up.default_list_id for share;
      perform 1 from public.list_members m where m.list_id=up.default_list_id and m.user_id=actor for share;
      if not private.can_access_list(up.default_list_id) then raise exception 'Kein Zugriff auf diese Standardliste.' using errcode = '42501'; end if;
    end if;
  end if;
  if exists (select 1 from jsonb_object_keys(p_row) as f(name) where not (wanted ? f.name)) or not (p_row ?& array(select jsonb_object_keys(wanted))) then
    raise exception 'Unvollständige oder unbekannte Einstellungsfelder.' using errcode = '22023';
  end if;
  if current_row is not null and wanted->'created_at' is distinct from current_row->'created_at' then
    raise exception 'Der Erstellzeitpunkt ist unveränderlich.' using errcode = '22023';
  end if;
  if current_row = wanted then return jsonb_build_object('table',p_table,'id',row_id,'kind','written','current',current_row); end if;
  if current_row is distinct from expected then return jsonb_build_object('table',p_table,'id',row_id,'kind','conflict','current',current_row); end if;
  if p_table = 'preferences' then
    insert into public.list_preferences as saved (list_id,user_id,include_in_overview,created_at,updated_at,deleted_at)
    values (lp.list_id,lp.user_id,lp.include_in_overview,lp.created_at,lp.updated_at,lp.deleted_at)
    on conflict(list_id,user_id) do update set include_in_overview=excluded.include_in_overview,updated_at=excluded.updated_at,deleted_at=excluded.deleted_at
    returning to_jsonb(saved) into current_row;
  else
    insert into public.user_preferences as saved (id,default_list_id,overview_mode,created_at,updated_at,deleted_at)
    values (up.id,up.default_list_id,up.overview_mode,up.created_at,up.updated_at,up.deleted_at)
    on conflict(id) do update set default_list_id=excluded.default_list_id,overview_mode=excluded.overview_mode,updated_at=excluded.updated_at,deleted_at=excluded.deleted_at
    returning to_jsonb(saved) into current_row;
  end if;
  return jsonb_build_object('table',p_table,'id',row_id,'kind','written','current',current_row);
end;
$$;
revoke all on function private.sync_preference(text,jsonb,jsonb) from public,anon,authenticated;
notify pgrst, 'reload schema';
commit;
