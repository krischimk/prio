-- -----------------------------------------------------------------------------
-- Wer mit wem eine Liste teilt
--
-- Beim Teilen tippt man die Adresse der anderen Person. Für die nächste Liste
-- wäre sie erneut zu tippen – und auch auf der anderen Seite: Wer eine Liste
-- mit jemandem teilt, möchte diesen Jemand später für eine eigene Liste
-- vorschlagen können.
--
-- Dafür braucht der Client die Adressen der Personen, mit denen er schon eine
-- Liste teilt. Lokal liegen sie nicht: Mitglieder werden bewusst nur über ihre
-- Benutzer-ID geführt (`0001_schema.sql`, Datensparsamkeit). Die Funktion gibt
-- deshalb genau diesen Kreis heraus, und nichts darüber hinaus:
--
--   * nur wer mit dem Aufrufer über eine nicht gelöschte Liste verbunden ist,
--   * die eigene Adresse nicht,
--   * keine Parameter – es lässt sich also keine beliebige Adresse nachschlagen.
--
-- Das ist eine bewusste Umkehr der früheren Linie: Bisher sah niemand die
-- Adresse eines anderen Nutzers. Für Vorschläge ist das unvermeidbar – wer
-- gemeinsam an einer Liste arbeitet, sieht nun, mit wem.
-- -----------------------------------------------------------------------------
create or replace function public.co_member_contacts()
returns table (user_id uuid, email text)
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
    select distinct p.id, lower(p.email)
    from beteiligte b
    join public.profiles p on p.id = b.user_id
    where b.user_id <> auth.uid()
      and p.email is not null
    order by lower(p.email);
end;
$$;

comment on function public.co_member_contacts() is
  'Adressen der Personen, mit denen der Aufrufer eine Liste teilt – Grundlage für Vorschläge beim Teilen.';

revoke all on function public.co_member_contacts() from public;
grant execute on function public.co_member_contacts() to authenticated;
