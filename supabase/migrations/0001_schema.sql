-- =============================================================================
-- prio 0.1 – 0001_schema.sql
-- Tabellen, Indizes und der Trigger, der bei einer Registrierung ein Profil anlegt.
-- =============================================================================
--
-- Grundsätzliches zu den Zeitstempeln:
--
--   `updated_at` wird BEWUSST vom Client gesetzt und NICHT von einem Trigger
--   überschrieben. Die Konfliktauflösung der App ist Last Write Wins anhand
--   von `updated_at` (siehe src/domain/merge.ts). Würde die Datenbank bei jedem
--   Update `now()` einsetzen, wäre der Server immer "neuer" und lokale
--   Änderungen könnten nie gewinnen.
--
--   Der Preis dafür: Ein manipulierender Client könnte einen Zeitstempel in der
--   Zukunft setzen und damit dauerhaft gewinnen. Für Version 0.1 ist das eine
--   bewusst akzeptierte Vereinfachung. Ein späterer Ausbau würde eine
--   Versionsnummer pro Zeile oder einen serverseitigen Zähler verwenden.
--
--   Alle Zeitstempel sind `timestamptz`, also absolut und zeitzonenunabhängig.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Profile
-- -----------------------------------------------------------------------------
-- Zweck: Die Freigabe einer Liste erfolgt über eine E-Mail-Adresse. Nur der
-- Server kann diese zuordnen, und `auth.users` ist für Clients nicht lesbar.
-- `profiles` ist deshalb die einzige Stelle mit E-Mail-Adressen – und sie ist
-- per RLS so abgesichert, dass jeder nur sein eigenes Profil sehen kann.
-- -----------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is
  'Spiegel der Benutzerkonten für die Suche nach E-Mail-Adressen beim Teilen von Listen.';

-- E-Mail-Adressen sind eindeutig (Groß-/Kleinschreibung spielt keine Rolle).
-- Leere Einträge werden ausgenommen, damit Konten ohne E-Mail-Adresse
-- (z. B. spätere Provider-Anmeldungen) den Index nicht blockieren.
create unique index if not exists profiles_email_lower_key
  on public.profiles (lower(email))
  where email <> '';

-- -----------------------------------------------------------------------------
-- Listen
-- -----------------------------------------------------------------------------
-- `owner_id` bestimmt den Besitzer. Ob eine Liste privat oder gemeinsam ist,
-- ergibt sich aus `is_shared` (wird beim ersten Teilen gesetzt).
-- -----------------------------------------------------------------------------
create table if not exists public.lists (
  id uuid primary key,
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (length(btrim(name)) > 0),
  is_shared boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

comment on table public.lists is 'Aufgabenlisten. Soft Delete über deleted_at.';

create index if not exists lists_owner_id_idx on public.lists (owner_id);
create index if not exists lists_updated_at_idx on public.lists (updated_at);

-- -----------------------------------------------------------------------------
-- Mitgliedschaften
-- -----------------------------------------------------------------------------
-- Primärschlüssel ist das Paar (list_id, user_id): Damit können zwei Geräte
-- desselben Nutzers nicht versehentlich zwei Mitgliedschaften erzeugen.
--
-- Eine Zeile bedeutet immer "Mitglied". Der Besitzer wird nicht hier, sondern
-- über `lists.owner_id` bestimmt – für Version 0.1 braucht es daher keine
-- Rollen-Spalte.
-- -----------------------------------------------------------------------------
create table if not exists public.list_members (
  list_id uuid not null references public.lists (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (list_id, user_id)
);

comment on table public.list_members is
  'Mitgliedschaften gemeinsamer Listen. Entfernen ist ein Soft Delete, damit der entfernte Nutzer es erfährt.';

create index if not exists list_members_user_id_idx on public.list_members (user_id);
create index if not exists list_members_updated_at_idx on public.list_members (updated_at);

-- -----------------------------------------------------------------------------
-- Aufgaben
-- -----------------------------------------------------------------------------
-- `due_at` ist ein vollständiger Zeitstempel mit Uhrzeit. Damit sind spätere
-- lokale Benachrichtigungen (Android) ohne Schemaänderung möglich.
-- -----------------------------------------------------------------------------
create table if not exists public.tasks (
  id uuid primary key,
  list_id uuid not null references public.lists (id) on delete cascade,
  title text not null check (length(btrim(title)) > 0),
  description text,
  due_at timestamptz,
  completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

comment on table public.tasks is 'Aufgaben. Soft Delete über deleted_at.';

create index if not exists tasks_list_id_idx on public.tasks (list_id);
create index if not exists tasks_updated_at_idx on public.tasks (updated_at);

-- -----------------------------------------------------------------------------
-- Profil automatisch anlegen und aktuell halten
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- Konten ohne E-Mail-Adresse sind für die Freigabe per E-Mail nicht nutzbar.
  if new.email is null then
    return new;
  end if;

  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do update
    set email = excluded.email,
        updated_at = now();

  return new;
end;
$$;

comment on function public.handle_new_user() is
  'Legt beim Anlegen eines Auth-Benutzers das zugehörige Profil an bzw. aktualisiert die E-Mail.';

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

drop trigger if exists on_auth_user_email_changed on auth.users;
create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row execute function public.handle_new_user();
