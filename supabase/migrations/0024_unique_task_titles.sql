-- Listenweise Namensregel; bestehende Listen und neue Listen erlauben Duplikate.
begin;
alter table public.lists add column if not exists allow_duplicate_titles boolean not null default true;
alter table public.tasks add column if not exists recurrence_series_id uuid;

-- ECMAScript-WhiteSpace wie taskTitleKey: auch geschützte/typografische Leerzeichen.
create or replace function private.task_title_key(title text)
returns text language sql immutable strict set search_path = ''
as $$ select lower(btrim(regexp_replace(title, U&'[\0009-\000D\0020\00A0\1680\2000-\200A\2028\2029\202F\205F\3000\FEFF]+', ' ', 'g'))) $$;
revoke all on function private.task_title_key(text) from public,anon,authenticated;
create index if not exists tasks_active_title_key on public.tasks(list_id, private.task_title_key(title)) where deleted_at is null and expired_at is null;

-- Einmalige Ergänzung der schon vorhandenen Serien anhand ihrer Nachfolger.
-- Der Marker verhindert, dass spätere Titel-/Terminänderungen erneut umgebaut werden.
do $$ begin
  if not exists(select 1 from private.data_migrations where name='0024_recurrence_series') then
    with recursive edges(a,b) as (
      select id,successor_id from public.tasks where successor_id is not null
      union select successor_id,id from public.tasks where successor_id is not null
    ), connected(start,id) as (
      select id,id from public.tasks where recurrence is not null or successor_id is not null
      union select c.start,e.b from connected c join edges e on e.a=c.id
    ), roots as (
      select id,min(start::text)::uuid as root from connected group by id
    )
    update public.tasks t set recurrence_series_id=r.root,updated_at=clock_timestamp()
      from roots r where t.id=r.id and t.recurrence_series_id is null;
    insert into private.data_migrations(name) values ('0024_recurrence_series');
  end if;
end $$;
notify pgrst, 'reload schema';
commit;
