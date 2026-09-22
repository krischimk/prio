-- =============================================================================
-- prio – 0007_list_leave.sql
-- Eine geteilte Liste selbst verlassen.
-- =============================================================================
--
-- Bisher durfte nur der Besitzer Mitgliedschaften ändern
-- (`list_members_delete_owner`). Wer in eine Liste aufgenommen wurde, kam
-- daraus nicht wieder heraus.
--
-- Die App löscht weich: „Verlassen" ist ein UPDATE, das `deleted_at` setzt.
-- Deshalb braucht es eine UPDATE-Richtlinie, keine DELETE-Richtlinie.
--
-- Die Bedingung ist absichtlich eng:
--
--   using      (user_id = auth.uid())
--     Man kommt nur an die eigene Zeile.
--   with check (user_id = auth.uid() and deleted_at is not null)
--     Das Ergebnis muss eine **gelöschte** eigene Zeile sein. Ohne diesen
--     Zusatz könnte ein Mitglied seine Zeile auf eine fremde Liste umschreiben
--     und sich damit Zugriff auf beliebige Listen verschaffen. Ein
--     Wiedereintritt ist ebenfalls ausgeschlossen – nur der Besitzer kann
--     jemanden erneut aufnehmen.
--
-- Wiederholbar und atomar.
-- =============================================================================

begin;

drop policy if exists list_members_leave_self on public.list_members;
create policy list_members_leave_self on public.list_members
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and deleted_at is not null);

commit;
