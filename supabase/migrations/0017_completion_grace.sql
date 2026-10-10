-- Einmalige Einführung: alte Abschlüsse erhalten sieben Tage ab Umstellung.
-- Ein Marker verhindert, dass die Sammelmigration Fristen erneut verlängert.
begin;
create table if not exists private.data_migrations (
  name text primary key, applied_at timestamptz not null default now()
);
revoke all on private.data_migrations from public,anon,authenticated;
do $$
declare moment timestamptz := clock_timestamp();
begin
  if not exists(select 1 from private.data_migrations where name='0017_completion_grace') then
    update public.lists set completion_retention_started_at=moment, updated_at=moment;
    update public.tasks set completed_expires_at=moment + interval '7 days', updated_at=moment
      where completed and expired_at is null;
    insert into private.data_migrations(name,applied_at) values ('0017_completion_grace',moment);
  end if;
end; $$;
commit;
