-- =============================================================================
-- prio – 0004_harden_functions.sql
-- Reaktion auf den Supabase Security Advisor.
-- =============================================================================
--
-- Der Advisor meldet SECURITY-DEFINER-Funktionen, die über
-- `/rest/v1/rpc/<name>` aufrufbar sind. Für die Hilfsfunktionen der
-- RLS-Policies ist das unnötig: Sie werden ausschließlich *innerhalb* von
-- Policies gebraucht, nie von einem Client.
--
-- Diese Migration
--   1. verschiebt die Hilfsfunktionen in das Schema `private`,
--   2. legt die Policies und die Teilen-Funktion auf das neue Schema um,
--   3. entzieht den Trigger-Funktionen das Recht, sie über die API aufzurufen.
--
-- Wichtig: `private` wird NICHT als API-Schema exponiert. PostgREST kennt nur
-- `public`, über `/rest/v1/rpc/` ist also nichts davon erreichbar. `USAGE` auf
-- dem Schema brauchen die angemeldeten Nutzer trotzdem, weil die Policies die
-- Funktionen aufrufen.
--
-- Wiederholbar: Die Datei kann gefahrlos mehrfach ausgeführt werden.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Privates Schema
-- -----------------------------------------------------------------------------
create schema if not exists private;

comment on schema private is
  'Interne Hilfsfunktionen für RLS-Policies. Bewusst nicht als API-Schema exponiert.';

-- Kein Zugriff für Fremde. `public` in PostgreSQL bedeutet "alle Rollen".
revoke all on schema private from public;
revoke all on schema private from anon;
grant usage on schema private to authenticated;

-- -----------------------------------------------------------------------------
-- 2. Hilfsfunktionen im privaten Schema
-- -----------------------------------------------------------------------------
-- Sie bleiben SECURITY DEFINER: Eine Policy auf `list_members`, die wieder
-- `list_members` abfragt, führt sonst zu "infinite recursion detected in
-- policy". SECURITY DEFINER bricht diesen Zyklus.
-- -----------------------------------------------------------------------------
create or replace function private.is_list_owner(p_list_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.lists l
    where l.id = p_list_id
      and l.owner_id = auth.uid()
  );
$$;

create or replace function private.is_list_member(p_list_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.list_members m
    join public.lists l on l.id = m.list_id
    where m.list_id = p_list_id
      and m.user_id = auth.uid()
      and m.deleted_at is null
      and l.deleted_at is null
  );
$$;

create or replace function private.can_access_list(p_list_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select private.is_list_owner(p_list_id) or private.is_list_member(p_list_id);
$$;

comment on function private.can_access_list(uuid) is
  'Zentrale Zugriffsprüfung: Besitzer oder aktives Mitglied einer nicht gelöschten Liste.';

revoke all on function private.is_list_owner(uuid) from public;
revoke all on function private.is_list_member(uuid) from public;
revoke all on function private.can_access_list(uuid) from public;
revoke all on function private.is_list_owner(uuid) from anon;
revoke all on function private.is_list_member(uuid) from anon;
revoke all on function private.can_access_list(uuid) from anon;

grant execute on function private.is_list_owner(uuid) to authenticated;
grant execute on function private.is_list_member(uuid) to authenticated;
grant execute on function private.can_access_list(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- 3. Policies auf die privaten Funktionen umstellen
-- -----------------------------------------------------------------------------
-- Inhaltlich unverändert – es ändert sich nur, wo die Hilfsfunktion liegt.

-- lists
drop policy if exists lists_select_visible on public.lists;
create policy lists_select_visible on public.lists
  for select to authenticated
  using (owner_id = auth.uid() or private.is_list_member(id));

drop policy if exists lists_update_owner on public.lists;
create policy lists_update_owner on public.lists
  for update to authenticated
  using (private.is_list_owner(id))
  with check (private.is_list_owner(id) and owner_id = auth.uid());

drop policy if exists lists_delete_owner on public.lists;
create policy lists_delete_owner on public.lists
  for delete to authenticated
  using (private.is_list_owner(id));

-- list_members
drop policy if exists list_members_select_own_or_owner on public.list_members;
create policy list_members_select_own_or_owner on public.list_members
  for select to authenticated
  using (user_id = auth.uid() or private.is_list_owner(list_id));

drop policy if exists list_members_insert_owner on public.list_members;
create policy list_members_insert_owner on public.list_members
  for insert to authenticated
  with check (private.is_list_owner(list_id));

drop policy if exists list_members_update_owner on public.list_members;
create policy list_members_update_owner on public.list_members
  for update to authenticated
  using (private.is_list_owner(list_id))
  with check (private.is_list_owner(list_id));

drop policy if exists list_members_delete_owner on public.list_members;
create policy list_members_delete_owner on public.list_members
  for delete to authenticated
  using (private.is_list_owner(list_id));

-- tasks
drop policy if exists tasks_select_member on public.tasks;
create policy tasks_select_member on public.tasks
  for select to authenticated
  using (private.can_access_list(list_id));

drop policy if exists tasks_insert_member on public.tasks;
create policy tasks_insert_member on public.tasks
  for insert to authenticated
  with check (private.can_access_list(list_id));

drop policy if exists tasks_update_member on public.tasks;
create policy tasks_update_member on public.tasks
  for update to authenticated
  using (private.can_access_list(list_id))
  with check (private.can_access_list(list_id));

drop policy if exists tasks_delete_member on public.tasks;
create policy tasks_delete_member on public.tasks
  for delete to authenticated
  using (private.can_access_list(list_id));

-- -----------------------------------------------------------------------------
-- 4. Teilen-Funktion auf das private Schema umstellen
-- -----------------------------------------------------------------------------
-- Sie bleibt bewusst in `public`: Die App ruft sie über
-- `/rest/v1/rpc/share_list_by_email` auf. Das ist der einzige absichtlich
-- exponierte RPC – er prüft intern, dass nur der Besitzer teilen darf und dass
-- die E-Mail-Adresse zu einem registrierten Nutzer gehört.
-- -----------------------------------------------------------------------------
create or replace function public.share_list_by_email(p_list_id uuid, p_email text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid;
  v_email text := lower(btrim(coalesce(p_email, '')));
begin
  if auth.uid() is null then
    raise exception 'Nicht angemeldet.' using errcode = '28000';
  end if;

  if not private.is_list_owner(p_list_id) then
    raise exception 'Nur der Besitzer kann diese Liste teilen.' using errcode = '42501';
  end if;

  if v_email = '' then
    raise exception 'Bitte eine E-Mail-Adresse angeben.' using errcode = '22023';
  end if;

  select p.id into v_user_id
  from public.profiles p
  where lower(p.email) = v_email;

  if v_user_id is null then
    raise exception 'Es gibt keinen registrierten Nutzer mit dieser E-Mail-Adresse.'
      using errcode = 'P0001';
  end if;

  if v_user_id = auth.uid() then
    raise exception 'Du bist bereits Besitzer dieser Liste.' using errcode = 'P0001';
  end if;

  insert into public.list_members (list_id, user_id, created_at, updated_at, deleted_at)
  values (p_list_id, v_user_id, now(), now(), null)
  on conflict (list_id, user_id) do update
    set deleted_at = null,
        updated_at = now();

  update public.lists
  set is_shared = true
  where id = p_list_id
    and deleted_at is null;

  return v_user_id;
end;
$$;

revoke all on function public.share_list_by_email(uuid, text) from public;
grant execute on function public.share_list_by_email(uuid, text) to authenticated;

-- -----------------------------------------------------------------------------
-- 5. Alte Hilfsfunktionen im öffentlichen Schema entfernen
-- -----------------------------------------------------------------------------
-- Erst jetzt, nachdem keine Policy und keine Funktion sie mehr benutzt.
drop function if exists public.can_access_list(uuid);
drop function if exists public.is_list_member(uuid);
drop function if exists public.is_list_owner(uuid);

-- -----------------------------------------------------------------------------
-- 6. Trigger-Funktionen aus der API nehmen
-- -----------------------------------------------------------------------------
-- Trigger- und Event-Trigger-Funktionen werden vom Datenbanksystem selbst
-- aufgerufen; EXECUTE braucht dafür niemand. Sie über `/rest/v1/rpc/...`
-- erreichbar zu lassen, vergrößert nur die Angriffsfläche.
--
-- Das Entziehen ist unschädlich: Trigger laufen mit den Rechten ihres
-- Eigentümers, nicht mit denen des Auslösers.
-- -----------------------------------------------------------------------------
do $$
begin
  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'handle_new_user'
  ) then
    execute 'revoke all on function public.handle_new_user() from public, anon, authenticated';
  end if;
end
$$;

-- `rls_auto_enable` legt Supabase an, wenn im Projekt die Option
-- "Enable automatic RLS" aktiv ist. Sie liegt bewusst außerhalb unserer
-- Migrationen und wird deshalb nur angefasst, wenn sie existiert.
do $$
begin
  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'rls_auto_enable'
  ) then
    execute 'revoke all on function public.rls_auto_enable() from public, anon, authenticated';
  end if;
end
$$;
