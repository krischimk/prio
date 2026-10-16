-- -----------------------------------------------------------------------------
-- Wer mit wem eine Liste teilt
--
-- Die App schlägt Benutzernamen vor und benennt damit bestehende Mitglieder.
-- Mitgliedszeilen selbst enthalten nur Benutzerkennungen. Die Funktion liefert
-- Namen ausschließlich für den Kreis gemeinsamer Listen:
--
--   * nur wer mit dem Aufrufer über eine nicht gelöschte Liste verbunden ist,
--   * den eigenen Namen nicht,
--   * keine Parameter – kein beliebiges Profil lässt sich nachschlagen.
-- E-Mails bleiben privat. Das alte Rückgabefeld `email` ist aus Gründen der
-- Schnittstellenkompatibilität noch vorhanden, enthält aber einen leeren Text.
-- -----------------------------------------------------------------------------
drop function if exists public.co_member_contacts();
create or replace function private.co_member_contacts()
returns table (user_id uuid, email text, username text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'Nicht angemeldet.' using errcode = '28000';
  end if;

  return query
    with meine_listen as (
      -- Listen, an denen ich beteiligt bin: als Besitzer **oder** als Mitglied.
      -- Der Besitzer hat keine eigene Mitgliedszeile – wer nur die Mitglieder
      -- betrachtet, findet ihn nie.
      select l.id
      from public.lists l
      where l.deleted_at is null
        and (
          l.owner_id = auth.uid()
          or exists (
            select 1
            from public.list_members m
            where m.list_id = l.id
              and m.user_id = auth.uid()
              and m.deleted_at is null
          )
        )
    ),
    beteiligte as (
      select l.owner_id as user_id
      from public.lists l
      join meine_listen ml on ml.id = l.id
      union
      select m.user_id
      from public.list_members m
      join meine_listen ml on ml.id = m.list_id
      where m.deleted_at is null
    )
    -- Die alte Rückgabeform bleibt kompatibel; die private E-Mail wird nicht
    -- mehr weitergegeben. Vorschläge und Mitgliedsnamen nutzen den Benutzernamen.
    select distinct p.id, ''::text, p.username
    from beteiligte b
    join public.profiles p on p.id = b.user_id
    where b.user_id <> auth.uid()
    order by p.username, p.id;
end;
$$;

revoke all on function private.co_member_contacts() from public,anon;
grant execute on function private.co_member_contacts() to authenticated;
create function public.co_member_contacts()
returns table(user_id uuid,email text,username text)
language sql stable security invoker set search_path='' as $$ select * from private.co_member_contacts() $$;

comment on function public.co_member_contacts() is
  'Benutzernamen gemeinsamer Listen; das frühere E-Mail-Feld bleibt leer.';

revoke all on function public.co_member_contacts() from public;
grant execute on function public.co_member_contacts() to authenticated;
