-- Eindeutige, frei gewählte Namen statt technischer Mitgliedskennungen.
-- Bestehende Konten wählen ihren Namen beim nächsten Start; kein Backfill.
begin;
grant usage on schema public to anon,authenticated;
alter table public.profiles add column if not exists username text;
create unique index if not exists profiles_username_key on public.profiles (username) where username is not null;
alter table public.profiles drop constraint if exists profiles_username_format;
alter table public.profiles add constraint profiles_username_format check (username is null or username ~ '^[a-z0-9][a-z0-9_]{2,29}$');

-- Auth-Metadaten und Profil werden in derselben Auth-Transaktion geändert.
-- Der Unique-Index entscheidet auch bei gleichzeitigen Namenswahlen atomar.
create or replace function private.apply_username()
returns trigger language plpgsql security definer set search_path = '' as $$
declare wanted text := lower(btrim(new.raw_user_meta_data->>'username'));
begin
  if wanted is null then
    if exists (select 1 from public.profiles where id=new.id and username is not null) then
      raise exception 'Der Benutzername darf nicht entfernt werden.' using errcode='22023';
    end if;
    return new;
  end if;
  if wanted !~ '^[a-z0-9][a-z0-9_]{2,29}$' then
    raise exception 'Benutzername: 3 bis 30 Zeichen, Buchstaben a-z, Ziffern und Unterstrich.' using errcode='22023';
  end if;
  update public.profiles set username=wanted where id=new.id;
  return new;
exception when unique_violation then
  raise exception 'Dieser Benutzername ist bereits vergeben.' using errcode='23505';
end;
$$;
revoke all on function private.apply_username() from public,anon,authenticated;
drop trigger if exists on_auth_user_username on auth.users;
create trigger on_auth_user_username after insert or update of raw_user_meta_data on auth.users for each row execute function private.apply_username();

create or replace function private.username_available(p_username text)
returns boolean language sql stable security definer set search_path='' as $$
  select lower(btrim(p_username)) ~ '^[a-z0-9][a-z0-9_]{2,29}$'
    and not exists(select 1 from public.profiles where username=lower(btrim(p_username)));
$$;
revoke all on function private.username_available(text) from public;
grant usage on schema private to anon;
grant execute on function private.username_available(text) to anon,authenticated;
create or replace function public.username_available(p_username text)
returns boolean language sql stable security invoker set search_path='' as $$ select private.username_available(p_username) $$;
revoke all on function public.username_available(text) from public;
grant execute on function public.username_available(text) to anon,authenticated;

drop function if exists public.share_list_by_username(uuid,text);
drop function if exists private.share_list_by_username(uuid,text);
create or replace function private.share_list_by_username(p_list_id uuid,p_username text,p_expected_user_id uuid default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare target_id uuid;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet.' using errcode='28000'; end if;
  -- Besitz unter Sperre prüfen; Entzug und gleichzeitiges Teilen haben eine Reihenfolge.
  perform 1 from public.lists where id=p_list_id and owner_id=auth.uid() and deleted_at is null for update;
  if not found then raise exception 'Nur der Besitzer kann diese Liste teilen.' using errcode='42501'; end if;
  select id into target_id from public.profiles where username=lower(btrim(p_username)) for share;
  if target_id is null then raise exception 'Kein Konto mit diesem Benutzernamen gefunden.' using errcode='P0001'; end if;
  if p_expected_user_id is not null and target_id<>p_expected_user_id then raise exception 'Dieser Benutzername gehört inzwischen zu einem anderen Konto. Aktualisiere die Kontakte und prüfe den Empfänger.' using errcode='40001'; end if;
  if target_id=auth.uid() then raise exception 'Du bist bereits Besitzer dieser Liste.' using errcode='P0001'; end if;
  insert into public.list_members(list_id,user_id,created_at,updated_at,deleted_at) values(p_list_id,target_id,now(),now(),null)
    on conflict(list_id,user_id) do update set deleted_at=null,updated_at=now();
  update public.lists set is_shared=true where id=p_list_id;
  return target_id;
end;
$$;
revoke all on function private.share_list_by_username(uuid,text,uuid) from public,anon;
grant execute on function private.share_list_by_username(uuid,text,uuid) to authenticated;
create or replace function public.share_list_by_username(p_list_id uuid,p_username text,p_expected_user_id uuid default null)
returns uuid language sql security invoker set search_path='' as $$ select private.share_list_by_username(p_list_id,p_username,p_expected_user_id) $$;
revoke all on function public.share_list_by_username(uuid,text,uuid) from public,anon;
grant execute on function public.share_list_by_username(uuid,text,uuid) to authenticated;
notify pgrst, 'reload schema';
commit;
