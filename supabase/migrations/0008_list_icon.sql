-- =============================================================================
-- prio – 0008_list_icon.sql
-- Symbol einer Liste.
-- =============================================================================
--
-- Die Liste trägt eine Kennung wie `std:haushalt`, die in der App auf ein
-- eingebautes Symbol zeigt. Gespeichert wird nur die Kennung, nicht das Bild –
-- so bleibt die Darstellung Sache der App und lässt sich später ändern, ohne
-- Daten umzuschreiben.
--
-- Unbekannte Kennungen werden in der Oberfläche als „kein Symbol“ behandelt.
-- Deshalb ist ein freies Textfeld richtig und keine Aufzählung: Eine neue
-- Symbolreihe soll keine Datenbankänderung brauchen.
--
-- Wiederholbar und atomar.
-- =============================================================================

begin;

alter table public.lists
  add column if not exists icon text;

comment on column public.lists.icon is
  'Kennung des Listensymbols, z. B. std:haushalt; NULL bedeutet kein Symbol.';

commit;
