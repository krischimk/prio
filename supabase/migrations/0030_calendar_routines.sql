-- Additive persönliche Kalenderdaten und optionale Sichtbarkeitsregeln.
begin;
alter table public.tasks add column if not exists recurrence_rule jsonb;
alter table public.user_preferences add column if not exists calendar_preferences jsonb not null
  default '{"days":{},"repeats":"active","open":false,"timeZone":null}'::jsonb;

create or replace function private.valid_recurrence_rule(value jsonb)
returns boolean language sql immutable set search_path='' as $$
  select case when value is null or value='null'::jsonb then true
    when jsonb_typeof(value)='object' then
      jsonb_typeof(value->'resetMissed')='boolean'
      and jsonb_typeof(value->'timeZone')='string' and length(value->>'timeZone') between 1 and 100
      and jsonb_typeof(value->'visibility')='object'
      and case value->'visibility'->>'mode'
        when 'clock' then (value->'visibility'->>'time') ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
        when 'lead' then case when jsonb_typeof(value->'visibility'->'minutes')='number'
          then (value->'visibility'->>'minutes')::numeric between 0 and 5256000
            and mod((value->'visibility'->>'minutes')::numeric,1)=0 else false end
        else false end
    else false end;
$$;
create or replace function private.valid_calendar_preferences(value jsonb)
returns boolean language sql immutable set search_path='' as $$
  select case when jsonb_typeof(value)='object' and jsonb_typeof(value->'days')='object' then
    value->>'repeats' in ('active','all','none') and jsonb_typeof(value->'open')='boolean'
    and (value->'timeZone'='null'::jsonb or jsonb_typeof(value->'timeZone')='string' and length(value->>'timeZone') between 1 and 100)
    and (select count(*)<=3660 from jsonb_object_keys(value->'days'))
    and not exists(select 1 from jsonb_each_text(value->'days') d where d.key !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' or d.value not in ('low','none'))
    else false end;
$$;
revoke all on function private.valid_recurrence_rule(jsonb) from public,anon,authenticated;
revoke all on function private.valid_calendar_preferences(jsonb) from public,anon,authenticated;
do $$ begin
  if not exists(select 1 from pg_constraint where conname='tasks_valid_recurrence_rule' and conrelid='public.tasks'::regclass) then
    alter table public.tasks add constraint tasks_valid_recurrence_rule check(private.valid_recurrence_rule(recurrence_rule) is true);
  end if;
  if not exists(select 1 from pg_constraint where conname='user_preferences_valid_calendar' and conrelid='public.user_preferences'::regclass) then
    alter table public.user_preferences add constraint user_preferences_valid_calendar check(private.valid_calendar_preferences(calendar_preferences) is true);
  end if;
end $$;
notify pgrst,'reload schema';
commit;
