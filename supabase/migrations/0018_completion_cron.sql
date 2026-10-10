-- Ein Datenbankjob läuft unabhängig von Web/Android und MCP-Clients.
-- pg_cron ist erforderlich: Fehlt es, scheitert die Einführung sichtbar.
-- Empfehlungen: ein kurzer Job, benannte schedule-Funktion statt Tabellen-DML,
-- nur eigene Verlaufseinträge bereinigen. Kein externer Netzwerkaufruf nötig.
create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule('prio-expire-completed','* * * * *', $job$
  set statement_timeout='30s';
  select private.expire_completed_tasks();
  delete from cron.job_run_details
    where jobid=(select jobid from cron.job where jobname='prio-expire-completed')
      and end_time < now() - interval '7 days';
$job$);
