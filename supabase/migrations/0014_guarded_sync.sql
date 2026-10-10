-- 0014: Vergleich mit dem gelesenen Stand und Ergebnis je Zeile.
-- Erst mit der zugehörigen App-Version ausliefern: alte direkte Upserts werden
-- gesperrt. Keine Datenänderung, keine neuen Spalten, wiederholbar.
begin;

create or replace function private.sync_write(p_table text, p_row jsonb, p_expected jsonb)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  current_row jsonb;
  wanted jsonb;
  expected jsonb;
  row_id text;
  list_row public.lists%rowtype;
  member_row public.list_members%rowtype;
  task_row public.tasks%rowtype;
  old_task public.tasks%rowtype;
  source_list uuid;
  target_list uuid;
  original_wanted jsonb;
  moment timestamptz;
begin
  if actor is null then raise exception 'Nicht angemeldet.' using errcode = '28000'; end if;
  -- Erst ab 0015 vorhanden; alte Zeilenoperationen bleiben unverändert.
  if p_table in ('preferences','userPreferences') then return private.sync_preference(p_table,p_row,p_expected); end if;
  if p_table is null or p_table not in ('lists', 'members', 'tasks') or jsonb_typeof(p_row) is distinct from 'object' then
    raise exception 'Ungültige Änderung.' using errcode = '22023';
  end if;
  -- UUIDs haben auch mit Großbuchstaben oder zusätzlicher Schreibformatierung
  -- dieselbe Identität. Die Sperre verwendet die kanonische Datenbankkennung.
  row_id := case when p_table = 'members' then (p_row->>'list_id')::uuid::text || ':' || (p_row->>'user_id')::uuid::text else (p_row->>'id')::uuid::text end;
  -- Sperrt auch die noch nicht existierende Kennung bei parallelem Anlegen.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('prio:' || p_table || ':' || row_id, 0));
  -- Sperrreihenfolge: Kennung, Listen in UUID-Reihenfolge, dann Zeilen.
  -- Cron und Listenregel verwenden dieselbe Listensperre.
  if p_table in ('lists','tasks') then
    target_list := case when p_table='lists' then (p_row->>'id')::uuid else (p_row->>'list_id')::uuid end;
    if p_table='tasks' then select list_id into source_list from public.tasks where id=(p_row->>'id')::uuid; end if;
    for target_list in select distinct id from unnest(array[target_list,source_list]) id where id is not null order by id loop
      perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('prio:retention:' || target_list::text,0));
      perform private.expire_completed_in_list(target_list);
    end loop;
  end if;
  if p_table = 'lists' then
    list_row := jsonb_populate_record(null::public.lists, p_row);
    wanted := to_jsonb(list_row);
    expected := case when p_expected is null or p_expected = 'null'::jsonb then null else to_jsonb(jsonb_populate_record(null::public.lists, p_expected)) end;
    select to_jsonb(r) into current_row from public.lists r where r.id = list_row.id for update;
    if list_row.owner_id is distinct from actor or (current_row is not null and (current_row->>'owner_id')::uuid <> actor) then
      raise exception 'Nur der Besitzer darf diese Liste ändern.' using errcode = '42501';
    end if;
  elsif p_table = 'members' then
    member_row := jsonb_populate_record(null::public.list_members, p_row);
    wanted := to_jsonb(member_row);
    expected := case when p_expected is null or p_expected = 'null'::jsonb then null else to_jsonb(jsonb_populate_record(null::public.list_members, p_expected)) end;
    select to_jsonb(r) into current_row from public.list_members r where r.list_id = member_row.list_id and r.user_id = member_row.user_id for update;
    perform 1 from public.lists l where l.id = member_row.list_id for share;
    if not private.is_list_owner(member_row.list_id) and not (
      current_row is not null and member_row.user_id = actor and member_row.deleted_at is not null
      and member_row.created_at = (current_row->>'created_at')::timestamptz
    ) then
      raise exception 'Diese Mitgliedschaft darfst du nicht ändern.' using errcode = '42501';
    end if;
  elsif p_table = 'tasks' then
    task_row := jsonb_populate_record(null::public.tasks, p_row);
    wanted := to_jsonb(task_row);
    expected := case when p_expected is null or p_expected = 'null'::jsonb then null else to_jsonb(jsonb_populate_record(null::public.tasks, p_expected)) end;
    select to_jsonb(r) into current_row from public.tasks r where r.id = task_row.id for update;
    if current_row is not null then old_task := jsonb_populate_record(null::public.tasks, current_row); end if;
    -- Schutz auch während gleichzeitigen Entziehens der Mitgliedschaft oder
    -- Löschens einer Liste. Der Benutzer braucht Quell- UND Zielzugriff.
    perform 1 from public.lists l where l.id in (task_row.list_id, old_task.list_id) order by l.id for share;
    perform 1 from public.list_members m where m.user_id = actor and m.list_id in (task_row.list_id, old_task.list_id) order by m.list_id for share;
    if not private.can_access_list(task_row.list_id) or (current_row is not null and not private.can_access_list(old_task.list_id)) then
      raise exception 'Kein Zugriff auf diese Aufgabe oder Zielliste.' using errcode = '42501';
    end if;
  end if;
  if exists (select 1 from jsonb_object_keys(p_row) as f(name) where not (wanted ? f.name))
     or not (p_row ?& array(select jsonb_object_keys(wanted))) then
    raise exception 'Die Änderung enthält unvollständige oder unbekannte Felder.' using errcode = '22023';
  end if;
  if current_row is not null and wanted->'created_at' is distinct from current_row->'created_at' then
    raise exception 'Der Erstellzeitpunkt ist unveränderlich.' using errcode = '22023';
  end if;
  -- Ablauf ist endgültig, auch bei Wiederherstellen und einem alten Upload.
  if p_table='tasks' and old_task.expired_at is not null and current_row is distinct from wanted then
    return jsonb_build_object('table',p_table,'id',row_id,'kind','conflict','current',current_row);
  end if;
  -- Exakt derselbe Inhalt ist ein sicherer Retry, auch nach verlorener Antwort.
  if current_row = wanted then
    return jsonb_build_object('table',p_table,'id',row_id,'kind','written','current',current_row);
  end if;
  if current_row is distinct from expected then
    return jsonb_build_object('table',p_table,'id',row_id,'kind','conflict','current',current_row);
  end if;
  original_wanted := wanted;
  moment := clock_timestamp();
  if p_table='lists' then
    list_row.completion_retention_started_at := case when current_row is null then least(list_row.completion_retention_started_at,moment) when (current_row->>'keep_completed')::boolean and not list_row.keep_completed then moment else (current_row->>'completion_retention_started_at')::timestamptz end;
  elsif p_table='tasks' then
    if not task_row.completed and task_row.completed_at is not null then
      raise exception 'Eine offene Aufgabe hat keinen Abschlusszeitpunkt.' using errcode='22023';
    end if;
    if current_row is not null and old_task.completed and task_row.completed and task_row.completed_at is distinct from old_task.completed_at then
      raise exception 'Der Abschlusszeitpunkt bleibt beim Bearbeiten erhalten.' using errcode='22023';
    end if;
    if task_row.expired_at is distinct from old_task.expired_at then
      raise exception 'Der endgültige Ablauf gehört dem Server.' using errcode='22023';
    end if;
    if not task_row.completed then
      task_row.completed_expires_at := null;
    elsif current_row is not null and old_task.completed and task_row.list_id is distinct from old_task.list_id then
      task_row.completed_expires_at := case when (select keep_completed from public.lists where id=task_row.list_id) then null else moment + interval '7 days' end;
    elsif current_row is null or not old_task.completed or task_row.completed_at is distinct from old_task.completed_at then
      if task_row.completed_at is null then raise exception 'Der Abschlusszeitpunkt fehlt.' using errcode='22023'; end if;
      task_row.completed_expires_at := case when (select keep_completed from public.lists where id=task_row.list_id) then null else greatest(least(task_row.completed_at,moment),(select completion_retention_started_at from public.lists where id=task_row.list_id)) + interval '7 days' end;
    else
      -- Bearbeiten/Verschieben/Replays verlängern die Frist niemals.
      task_row.completed_expires_at := old_task.completed_expires_at;
    end if;
  end if;
  if p_table = 'lists' then
    insert into public.lists as saved (id, owner_id, name, is_shared, created_at, updated_at, deleted_at, icon, sections, keep_completed, completion_retention_started_at) values (list_row.id, list_row.owner_id, list_row.name, list_row.is_shared, list_row.created_at, list_row.updated_at, list_row.deleted_at, list_row.icon, list_row.sections, list_row.keep_completed, list_row.completion_retention_started_at)
    on conflict (id) do update set owner_id=excluded.owner_id, name=excluded.name, is_shared=excluded.is_shared, created_at=excluded.created_at, updated_at=excluded.updated_at, deleted_at=excluded.deleted_at, icon=excluded.icon, sections=excluded.sections, keep_completed=excluded.keep_completed, completion_retention_started_at=excluded.completion_retention_started_at
    returning to_jsonb(saved) into current_row;
    if expected is not null and (expected->>'keep_completed')::boolean is distinct from list_row.keep_completed then
      update public.tasks set completed_expires_at=case when list_row.keep_completed then null else moment + interval '7 days' end, updated_at=moment
        where list_id=list_row.id and completed and expired_at is null;
    end if;
  elsif p_table = 'members' then
    insert into public.list_members as saved (list_id, user_id, created_at, updated_at, deleted_at) values (member_row.list_id, member_row.user_id, member_row.created_at, member_row.updated_at, member_row.deleted_at)
    on conflict (list_id,user_id) do update set created_at=excluded.created_at, updated_at=excluded.updated_at, deleted_at=excluded.deleted_at
    returning to_jsonb(saved) into current_row;
  elsif p_table = 'tasks' then
    insert into public.tasks as saved (id, list_id, title, description, due_at, completed, created_at, updated_at, deleted_at, position, completed_at, recurrence, successor_id, reminders, section_id, completed_expires_at, expired_at, reopen_context) values (task_row.id, task_row.list_id, task_row.title, task_row.description, task_row.due_at, task_row.completed, task_row.created_at, task_row.updated_at, task_row.deleted_at, task_row.position, task_row.completed_at, task_row.recurrence, task_row.successor_id, task_row.reminders, task_row.section_id, task_row.completed_expires_at, task_row.expired_at, task_row.reopen_context)
    on conflict (id) do update set list_id=excluded.list_id, title=excluded.title, description=excluded.description, due_at=excluded.due_at, completed=excluded.completed, created_at=excluded.created_at, updated_at=excluded.updated_at, deleted_at=excluded.deleted_at, position=excluded.position, completed_at=excluded.completed_at, recurrence=excluded.recurrence, successor_id=excluded.successor_id, reminders=excluded.reminders, section_id=excluded.section_id, completed_expires_at=excluded.completed_expires_at, expired_at=excluded.expired_at, reopen_context=excluded.reopen_context
    returning to_jsonb(saved) into current_row;
  end if;
  if p_table='tasks' then
    perform private.expire_completed_in_list(task_row.list_id);
    select to_jsonb(t) into current_row from public.tasks t where id=task_row.id;
  end if;
  -- Eine serverseitig berechnete Frist/Ablaufantwort wird als tatsächlicher
  -- Stand eingelesen; sie ist keine Inhaltsbestätigung der gesendeten Zeile.
  return jsonb_build_object('table',p_table,'id',row_id,'kind',case when current_row=original_wanted then 'written' else 'conflict' end,'current',current_row);
end;
$$;
revoke all on function private.sync_write(text,jsonb,jsonb) from public,anon,authenticated;

create or replace function private.sync_push(p_changes jsonb)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  change jsonb;
  result jsonb := '[]'::jsonb;
  error_code text;
  error_message text;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet.' using errcode = '28000'; end if;
  if jsonb_typeof(p_changes) is distinct from 'array' or jsonb_array_length(p_changes) > 100 then
    raise exception 'Ungültige Anzahl Änderungen.' using errcode = '22023';
  end if;
  for change in select value from jsonb_array_elements(p_changes) loop
    begin
      result := result || jsonb_build_array(private.sync_write(change->>'table',change->'row',change->'expected'));
    exception when others then
      get stacked diagnostics error_code = returned_sqlstate, error_message = message_text;
      result := result || jsonb_build_array(jsonb_build_object(
        'table',change->>'table',
        'id',case when change->>'table' in ('members','preferences') then (change->'row'->>'list_id') || ':' || (change->'row'->>'user_id') else change->'row'->>'id' end,
        'kind','rejected','code',error_code,'message',error_message));
    end;
  end loop;
  return result;
end;
$$;
revoke all on function private.sync_push(jsonb) from public,anon,authenticated;
grant execute on function private.sync_push(jsonb) to authenticated;

-- Öffentlicher Einstieg ist INVOKER; die privilegierte Arbeit bleibt privat.
create or replace function public.sync_push(p_changes jsonb)
returns jsonb language sql security invoker set search_path = ''
as $$ select private.sync_push(p_changes); $$;
revoke all on function public.sync_push(jsonb) from public,anon,authenticated;
grant execute on function public.sync_push(jsonb) to authenticated;

-- SELECT bleibt RLS-geschützt. Kein alter oder neuer Client kann die Prüfung
-- durch ein direktes INSERT/UPDATE/DELETE umgehen. Teilen läuft weiter über
-- den bestehenden, selbst prüfenden Serverbefehl.
revoke insert,update,delete,truncate on public.lists,public.list_members,public.tasks from public,anon,authenticated;
notify pgrst, 'reload schema';
commit;
