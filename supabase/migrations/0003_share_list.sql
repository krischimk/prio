-- =============================================================================
-- prio 0.1 – 0003_share_list.sql
-- Freigabe einer Liste über die E-Mail-Adresse eines registrierten Nutzers.
-- =============================================================================
--
-- Warum als Funktion und nicht direkt als UPDATE/INSERT vom Client?
--
--   1. Nur der Server kennt die Zuordnung E-Mail → Benutzer-ID. Die Tabelle
--      `profiles` ist per RLS für andere Nutzer unsichtbar; würde der Client
--      direkt schreiben, müsste er diese Absicherung aufweichen.
--   2. Die Regeln ("nur der Besitzer", "Nutzer muss existieren", "nicht sich
--      selbst") stehen an genau einer Stelle und gelten für jeden Client.
--
-- Die Funktion ist SECURITY DEFINER und umgeht damit die RLS der Tabellen –
-- die Berechtigungsprüfung erfolgt deshalb explizit im Funktionskörper.
--
-- Zu den Fehlercodes (wichtig, damit niemand sie "aufräumt"):
--
--   PostgREST übersetzt PostgreSQL-Fehlercodes in HTTP-Status. Aus der
--   offiziellen Zuordnungstabelle:
--
--     P0001        -> 400  (Standardcode für RAISE)
--     P0*          -> 500  (PL/pgSQL-Fehler)  <- gilt auch für P0002!
--     42501        -> 403 bei angemeldeten, sonst 401
--     28*          -> 403
--     PTxyz        -> xyz  (frei wählbarer Status)
--     alles andere -> 400
--
--   Deshalb wird für fachliche Ablehnungen konsequent P0001 verwendet.
--   Mit P0002 (wie früher hier) hätte der Server bei einer unbekannten
--   E-Mail-Adresse HTTP 500 geantwortet – ein Serverfehler für einen
--   ganz normalen Anwendungsfall.
-- =============================================================================

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

  if not public.is_list_owner(p_list_id) then
    raise exception 'Nur der Besitzer kann diese Liste teilen.' using errcode = '42501';
  end if;

  if v_email = '' then
    raise exception 'Bitte eine E-Mail-Adresse angeben.' using errcode = '22023';
  end if;

  select p.id into v_user_id
  from public.profiles p
  where lower(p.email) = v_email;

  if v_user_id is null then
    -- P0001 -> HTTP 400. P0002 würde als PL/pgSQL-Fehler zu HTTP 500 führen.
    raise exception 'Es gibt keinen registrierten Nutzer mit dieser E-Mail-Adresse.'
      using errcode = 'P0001';
  end if;

  if v_user_id = auth.uid() then
    raise exception 'Du bist bereits Besitzer dieser Liste.' using errcode = 'P0001';
  end if;

  -- Erneutes Teilen macht eine frühere Entfernung rückgängig (deleted_at = null).
  insert into public.list_members (list_id, user_id, created_at, updated_at, deleted_at)
  values (p_list_id, v_user_id, now(), now(), null)
  on conflict (list_id, user_id) do update
    set deleted_at = null,
        updated_at = now();

  -- `is_shared` markiert die Liste als gemeinsam. `updated_at` wird bewusst
  -- NICHT verändert: Es gehört dem Client (Last Write Wins) und ein
  -- Server-Schreibvorgang würde sonst die Konfliktlogik verfälschen.
  update public.lists
  set is_shared = true
  where id = p_list_id
    and deleted_at is null;

  return v_user_id;
end;
$$;

comment on function public.share_list_by_email(uuid, text) is
  'Fügt einen registrierten Nutzer per E-Mail-Adresse als Mitglied hinzu. Nur der Besitzer der Liste.';

revoke all on function public.share_list_by_email(uuid, text) from public;
grant execute on function public.share_list_by_email(uuid, text) to authenticated;
