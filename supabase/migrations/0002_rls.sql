-- =============================================================================
-- prio 0.1 – 0002_rls.sql
-- Row Level Security: Wer darf welche Zeilen sehen und ändern?
-- =============================================================================
--
-- Ziel:
--   * Ein Benutzer sieht seine eigenen Listen und Aufgaben.
--   * Ein Benutzer sieht gemeinsame Listen, in denen er Mitglied ist.
--   * Beide dürfen Aufgaben dieser Listen lesen und bearbeiten.
--   * Ein Benutzer kann NIEMALS private Daten eines anderen lesen.
--   * Mitglieder verwaltet nur der Besitzer.
--   * Nur der Besitzer darf eine Liste umbenennen oder löschen.
--
-- Wichtiges Detail zur Erkennung "ich wurde entfernt":
--   Die SELECT-Policy auf `list_members` erlaubt jedem das Lesen der EIGENEN
--   Zeile – auch wenn sie soft-deleted ist. Sonst würde ein entferntes Mitglied
--   nie erfahren, dass es keinen Zugriff mehr hat. Die Zugriffsprüfung für
--   Listen und Aufgaben verlangt dagegen eine nicht gelöschte Mitgliedschaft.
-- =============================================================================

alter table public.profiles enable row level security;
alter table public.lists enable row level security;
alter table public.list_members enable row level security;
alter table public.tasks enable row level security;

-- -----------------------------------------------------------------------------
-- Hilfsfunktionen
-- -----------------------------------------------------------------------------
-- Diese Funktionen sind SECURITY DEFINER. Grund: Eine Policy auf `list_members`
-- darf nicht wieder `list_members` abfragen, sonst entsteht eine endlose
-- Rekursion ("infinite recursion detected in policy"). SECURITY DEFINER
-- umgeht die RLS innerhalb der Funktion und bricht den Zyklus.
-- -----------------------------------------------------------------------------
create or replace function public.is_list_owner(p_list_id uuid)
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

create or replace function public.is_list_member(p_list_id uuid)
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

create or replace function public.can_access_list(p_list_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.is_list_owner(p_list_id) or public.is_list_member(p_list_id);
$$;

comment on function public.can_access_list(uuid) is
  'Zentrale Zugriffsprüfung: Besitzer oder aktives Mitglied einer nicht gelöschten Liste.';

revoke all on function public.is_list_owner(uuid) from public;
revoke all on function public.is_list_member(uuid) from public;
revoke all on function public.can_access_list(uuid) from public;

grant execute on function public.is_list_owner(uuid) to authenticated;
grant execute on function public.is_list_member(uuid) to authenticated;
grant execute on function public.can_access_list(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- profiles
-- -----------------------------------------------------------------------------
-- Nur das eigene Profil ist lesbar. Schreiben passiert ausschließlich über den
-- Trigger in 0001_schema.sql (SECURITY DEFINER).
-- -----------------------------------------------------------------------------
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = auth.uid());

-- -----------------------------------------------------------------------------
-- lists
-- -----------------------------------------------------------------------------
drop policy if exists lists_select_visible on public.lists;
create policy lists_select_visible on public.lists
  for select to authenticated
  using (owner_id = auth.uid() or public.is_list_member(id));

drop policy if exists lists_insert_own on public.lists;
create policy lists_insert_own on public.lists
  for insert to authenticated
  with check (owner_id = auth.uid());

-- Umbenennen/Löschen nur durch den Besitzer. Die zusätzliche Prüfung auf
-- `owner_id = auth.uid()` verhindert, dass jemand die Liste auf einen anderen
-- Besitzer umschreibt.
drop policy if exists lists_update_owner on public.lists;
create policy lists_update_owner on public.lists
  for update to authenticated
  using (public.is_list_owner(id))
  with check (public.is_list_owner(id) and owner_id = auth.uid());

drop policy if exists lists_delete_owner on public.lists;
create policy lists_delete_owner on public.lists
  for delete to authenticated
  using (public.is_list_owner(id));

-- -----------------------------------------------------------------------------
-- list_members
-- -----------------------------------------------------------------------------
-- Lesen: eigene Zeile (auch gelöscht) oder Besitzer der Liste.
-- Ein Mitglied sieht bewusst NICHT, wer sonst noch Mitglied ist.
-- -----------------------------------------------------------------------------
drop policy if exists list_members_select_own_or_owner on public.list_members;
create policy list_members_select_own_or_owner on public.list_members
  for select to authenticated
  using (user_id = auth.uid() or public.is_list_owner(list_id));

drop policy if exists list_members_insert_owner on public.list_members;
create policy list_members_insert_owner on public.list_members
  for insert to authenticated
  with check (public.is_list_owner(list_id));

drop policy if exists list_members_update_owner on public.list_members;
create policy list_members_update_owner on public.list_members
  for update to authenticated
  using (public.is_list_owner(list_id))
  with check (public.is_list_owner(list_id));

drop policy if exists list_members_delete_owner on public.list_members;
create policy list_members_delete_owner on public.list_members
  for delete to authenticated
  using (public.is_list_owner(list_id));

-- -----------------------------------------------------------------------------
-- tasks
-- -----------------------------------------------------------------------------
-- Besitzer und Mitglieder dürfen Aufgaben der Liste vollständig bearbeiten.
-- Alles andere ergibt sich aus `can_access_list`.
-- -----------------------------------------------------------------------------
drop policy if exists tasks_select_member on public.tasks;
create policy tasks_select_member on public.tasks
  for select to authenticated
  using (public.can_access_list(list_id));

drop policy if exists tasks_insert_member on public.tasks;
create policy tasks_insert_member on public.tasks
  for insert to authenticated
  with check (public.can_access_list(list_id));

drop policy if exists tasks_update_member on public.tasks;
create policy tasks_update_member on public.tasks
  for update to authenticated
  using (public.can_access_list(list_id))
  with check (public.can_access_list(list_id));

drop policy if exists tasks_delete_member on public.tasks;
create policy tasks_delete_member on public.tasks
  for delete to authenticated
  using (public.can_access_list(list_id));

-- -----------------------------------------------------------------------------
-- Tabellenrechte (GRANTs)
-- -----------------------------------------------------------------------------
-- RLS allein genügt nicht: Ohne Tabellenrecht kommt man gar nicht bis zur
-- Policy – PostgREST antwortet dann mit "permission denied for table ...".
--
-- In einem Standard-Supabase-Projekt sind diese Rechte über die
-- Default-Privileges bereits gesetzt. Sie werden hier trotzdem ausdrücklich
-- vergeben, damit die Einrichtung nicht davon abhängt:
--   * falls jemand die Voreinstellungen des Projekts geändert hat oder
--   * falls die Tabellen unter einer anderen Rolle angelegt wurden.
--
-- Wichtig: Die Rechte werden `authenticated` gegeben, NICHT `anon`. Nicht
-- angemeldete Anfragen (nur anon key) sollen gar nicht erst an die Tabellen
-- kommen. Welche ZEILEN sichtbar sind, entscheiden weiterhin ausschließlich
-- die Policies oben.
-- -----------------------------------------------------------------------------
grant usage on schema public to authenticated;

grant select, insert, update, delete on public.lists to authenticated;
grant select, insert, update, delete on public.list_members to authenticated;
grant select, insert, update, delete on public.tasks to authenticated;
grant select on public.profiles to authenticated;

