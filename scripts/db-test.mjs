/** Ausschließlich eine wegwerfbare lokale Testdatenbank, niemals die Cloud. */
import { spawn, spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'

const connection = process.env.PRIO_DB_TEST_URL
if (!connection) throw new Error('PRIO_DB_TEST_URL muss auf eine lokale prio_test_* Datenbank zeigen.')
let target
try { target = new URL(connection) } catch { throw new Error('Ungültige PRIO_DB_TEST_URL.') }
if (!['postgres:', 'postgresql:'].includes(target.protocol) || target.search || target.hash
    || !['localhost', '127.0.0.1', '[::1]'].includes(target.hostname) || !/^\/prio_test_[a-z0-9_]+$/.test(target.pathname)) {
  // libpq-Queryparameter könnten Host oder Datenbank aus der URI überschreiben.
  throw new Error('Datenbankprüfung erlaubt nur eine PostgreSQL-URI ohne Queryparameter, localhost und eine prio_test_* Datenbank.')
}
const args = ['-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-d', connection]
function sql(query) {
  const result = spawnSync('psql', args, { input: query, encoding: 'utf8' })
  if (result.status !== 0) throw new Error(result.stderr || String(result.error))
  return result.stdout.trim()
}
function asyncSql(query) {
  return new Promise((resolve, reject) => {
    const child = spawn('psql', args)
    let output = ''; let error = ''
    child.stdout.on('data', data => { output += data })
    child.stderr.on('data', data => { error += data })
    child.on('error', reject)
    child.on('close', code => code === 0 ? resolve(output.trim()) : reject(new Error(error)))
    child.stdin.end(query)
  })
}
const owner = '00000000-0000-0000-0000-000000000001'
const member = '00000000-0000-0000-0000-000000000002'
const stranger = '00000000-0000-0000-0000-000000000003'
const listId = '10000000-0000-0000-0000-000000000001'
const taskId = '20000000-0000-0000-0000-000000000001'
const at = '2026-01-01T10:00:00.000Z'
function actorSql(actor, query) { return `begin; set local role authenticated; set local request.jwt.claim.sub = '${actor}'; ${query}; commit;` }
function request(changes) { return `select public.sync_push('${JSON.stringify(changes).replaceAll("'", "''")}'::jsonb)` }
function push(actor, table, row, expected = null) { return JSON.parse(sql(actorSql(actor, request([{ table, row, expected }]))))[0] }
let checks = 0
function check(name, fn) { fn(); checks += 1; console.log(`✓ ${name}`) }

sql(`drop extension if exists pg_cron cascade; drop schema if exists private cascade; drop schema if exists auth cascade; drop schema public cascade; create schema public; create schema auth;
do $$ begin if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
if not exists(select 1 from pg_roles where rolname='anon') then create role anon; end if; end $$;
create table auth.users (id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
grant usage on schema auth to authenticated,anon;`)
const migrations = readFileSync(new URL('../supabase/all-migrations.sql', import.meta.url), 'utf8')
sql(migrations)
sql(`insert into auth.users(id,email) values ('${owner}','owner@prio.test'),('${member}','member@prio.test'),('${stranger}','stranger@prio.test')`)
const list = { id: listId, owner_id: owner, name: 'Liste', is_shared: false, icon: null, sections: [], keep_completed: false, completion_retention_started_at: at, created_at: at, updated_at: at, deleted_at: null }
const task = { id: taskId, list_id: listId, title: 'Anfang', description: null, due_at: null, completed: false, completed_at: null, completed_expires_at: null, expired_at: null, reopen_context: null, recurrence: null, successor_id: null, reminders: [], section_id: null, position: 0, created_at: at, updated_at: at, deleted_at: null }
check('Anlegen und Antwort mit tatsächlich gespeichertem Inhalt', () => {
  assert.equal(push(owner,'lists',list).kind,'written')
  const answer = push(owner,'tasks',task)
  assert.equal(answer.kind,'written')
  assert.deepEqual(answer.current,JSON.parse(sql(`select to_jsonb(t) from public.tasks t where id='${taskId}'`)))
})
check('Alte ganzzahlige Positionen bleiben erhalten; Zwischenplätze sind schreibbar', () => {
  // Stellt die alte Spalte mit bereits vorhandenem Inhalt her.
  sql('alter table public.tasks alter column position type integer using position::integer')
  const before=sql('select jsonb_agg(to_jsonb(t) order by id) from public.tasks t')
  const update=readFileSync(new URL('../supabase/migrations/0016_completion_retention.sql',import.meta.url),'utf8')
  sql(update); sql(update)
  assert.equal(sql('select jsonb_agg(to_jsonb(t) order by id) from public.tasks t'),before)
  assert.equal(sql("select data_type from information_schema.columns where table_schema='public' and table_name='tasks' and column_name='position'"),'double precision')
  assert.equal(push(owner,'tasks',{...task,id:'20000000-0000-0000-0000-000000000013',position:1.5}).kind,'written')
})
const edited = { ...task, title: 'Cloud-Stand' }
check('Gleiche Millisekunde und falsche Geräteuhr umgehen die Basisprüfung nicht', () => {
  assert.equal(push(owner,'tasks',edited,task).kind,'written')
  assert.equal(push(owner,'tasks',{...task,title:'Veraltet',updated_at:'2099-01-01T00:00:00Z'},task).kind,'conflict')
  assert.equal(sql(`select title from public.tasks where id='${taskId}'`),'Cloud-Stand')
})
check('Retry nach Commit ist idempotent', () => {
  assert.equal(push(owner,'tasks',edited,task).kind,'written')
  assert.equal(sql(`select count(*) from public.tasks where id='${taskId}'`),'1')
})
check('Eine Ablehnung hält gültige Zeilen nicht zurück', () => {
  const changes = [{table:'tasks',row:{...edited,title:'  '},expected:edited}, {table:'tasks',row:{...task,id:'20000000-0000-0000-0000-000000000002',title:'Gültig'},expected:null}]
  const result = JSON.parse(sql(actorSql(owner,request(changes))))
  assert.equal(result[0].kind,'rejected'); assert.equal(result[1].kind,'written')
  assert.equal(sql(`select title from public.tasks where id='${taskId}'`),'Cloud-Stand')
})
check('Fremde Aufgabe wird ohne Preisgabe ihres Inhalts abgewiesen', () => {
  const result = push(stranger,'tasks',{...edited,title:'Angriff'},edited)
  assert.equal(result.kind,'rejected'); assert.equal(result.current,undefined)
  assert.equal(sql(actorSql(stranger,'select count(*) from public.tasks')),'0')
})
check('Verschieben verlangt Quell- und Zielberechtigung', () => {
  const foreignList={...list,id:'10000000-0000-0000-0000-000000000002',owner_id:stranger}
  const foreignTask={...task,id:'20000000-0000-0000-0000-000000000003',list_id:foreignList.id}
  assert.equal(push(stranger,'lists',foreignList).kind,'written')
  assert.equal(push(stranger,'tasks',foreignTask).kind,'written')
  assert.equal(push(stranger,'tasks',{...edited,list_id:foreignList.id},edited).kind,'rejected')
  assert.equal(push(stranger,'tasks',{...foreignTask,list_id:listId},foreignTask).kind,'rejected')
})
check('Unangemeldete und anonyme Aufrufe bleiben gesperrt', () => {
  assert.equal(sql("select has_function_privilege('anon','public.sync_push(jsonb)','EXECUTE')"),'f')
  for (const role of ['authenticated','anon']) {
    const result=spawnSync('psql',args,{input:`begin; set local role ${role}; select public.sync_push('[]'::jsonb); commit;`,encoding:'utf8'})
    assert.notEqual(result.status,0)
  }
})
const membership = {list_id:listId,user_id:member,created_at:at,updated_at:at,deleted_at:null}
check('Mitglied darf Aufgaben bearbeiten, aber keine Liste oder neue Mitgliedschaft', () => {
  assert.equal(push(owner,'members',membership).kind,'written')
  assert.equal(push(member,'tasks',{...edited,description:'Notiz'},edited).kind,'written')
  assert.equal(push(member,'lists',{...list,name:'Fremd'},list).kind,'rejected')
  assert.equal(push(member,'members',{...membership,user_id:stranger}).kind,'rejected')
})
check('Mitglied kann verlassen, aber sich nicht erneut hinzufügen', () => {
  const left={...membership,deleted_at:at}
  assert.equal(push(member,'members',left,membership).kind,'written')
  assert.equal(push(member,'members',membership,left).kind,'rejected')
  assert.equal(push(member,'tasks',edited).kind,'rejected')
  assert.equal(sql(actorSql(member,'select count(*) from public.list_members')),'1')
})
check('Erstellzeitpunkt und unbekannte Felder sind geschützt', () => {
  const current={...edited,description:'Notiz'}
  assert.equal(push(owner,'tasks',{...current,created_at:'2026-01-02T00:00:00Z'},current).kind,'rejected')
  assert.equal(push(owner,'tasks',{...current,dirty:1},current).kind,'rejected')
})
check('Bestehender Teilen-Befehl funktioniert trotz gesperrter direkter Schreibrechte', () => {
  assert.equal(sql(actorSql(owner,`select public.share_list_by_email('${listId}','stranger@prio.test')`)),stranger)
  assert.equal(sql(`select count(*) from public.list_members where list_id='${listId}' and user_id='${stranger}' and deleted_at is null`),'1')
})
check('Alte direkte Schreibzugriffe sind für jede Tabelle gesperrt', () => {
  for (const table of ['lists','list_members','tasks']) for (const permission of ['INSERT','UPDATE','DELETE']) {
    assert.equal(sql(`select has_table_privilege('authenticated','public.${table}','${permission}')`),'f')
  }
  const result=spawnSync('psql',args,{input:actorSql(owner,`update public.tasks set title='Alt' where id='${taskId}'`),encoding:'utf8'})
  assert.notEqual(result.status,0)
})
check('Wiederholung der alten Rechte-Migration öffnet keine Umgehung', () => {
  sql(readFileSync(new URL('../supabase/migrations/0002_rls.sql',import.meta.url),'utf8'))
  for (const table of ['lists','list_members','tasks']) {
    assert.equal(sql(`select has_table_privilege('authenticated','public.${table}','INSERT,UPDATE,DELETE')`),'f')
  }
})
check('Wiederholtes Einspielen bewahrt Daten und gesperrte Schreibrechte', () => {
  const before=sql('select jsonb_agg(to_jsonb(t) order by id) from public.tasks t')
  sql(migrations)
  assert.equal(sql('select jsonb_agg(to_jsonb(t) order by id) from public.tasks t'),before)
  assert.equal(sql("select has_table_privilege('authenticated','public.tasks','UPDATE')"),'f')
})
const concurrentBase={...edited,description:'Notiz'}
const competing=[{...concurrentBase,title:'Gerät A'},{...concurrentBase,title:'Agent B'}]
const outcomes=await Promise.all(competing.map(row=>asyncSql(actorSql(owner,request([{table:'tasks',row,expected:concurrentBase}])))))
check('Zwei echte Datenbankverbindungen: genau ein Schreiben, ein Konflikt',()=>{
  assert.deepEqual(outcomes.map(output=>JSON.parse(output)[0].kind).sort(),['conflict','written'])
})
const newId='abcdef00-0000-0000-0000-000000000004'
// Der Trigger hält das erste Anlegen offen, damit beide Verbindungen wirklich
// um eine zunächst fehlende Zeile konkurrieren. Nur in dieser Testdatenbank.
sql(`create function public.prio_test_pause() returns trigger language plpgsql as $$ begin perform pg_sleep(0.2); return new; end $$;
create trigger prio_test_pause before insert on public.tasks for each row execute function public.prio_test_pause()`)
const creations=await Promise.all(['Neu A','Neu B'].map((title,index)=>asyncSql(actorSql(owner,request([{table:'tasks',row:{...task,id:index ? newId.toUpperCase() : newId,title},expected:null}])))))
check('Paralleles Anlegen schützt dieselbe Kennung auch mit anderer Großschreibung',()=>{
  assert.deepEqual(creations.map(output=>JSON.parse(output)[0].kind).sort(),['conflict','written'])
  assert.equal(sql(`select count(*) from public.tasks where id='${newId}'`),'1')
})
sql('drop trigger prio_test_pause on public.tasks; drop function public.prio_test_pause()')
const personal = { list_id: listId, user_id: owner, include_in_overview: true, created_at: at, updated_at: at, deleted_at: null }
const userSettings = { id: owner, default_list_id: listId, overview_mode: 'newest', created_at: at, updated_at: at, deleted_at: null }
check('Persönliche Aufnahme und bevorzugte Ansicht: Schreiben, Retry und stale Basis', () => {
  assert.equal(push(owner,'preferences',personal).kind,'written')
  assert.equal(push(owner,'userPreferences',userSettings).kind,'written')
  assert.equal(push(owner,'userPreferences',userSettings).kind,'written')
  assert.equal(push(owner,'userPreferences',{...userSettings,overview_mode:'by_list'}).kind,'conflict')
  assert.equal(sql(actorSql(owner,'select overview_mode from public.user_preferences')),'newest')
})
check('Mitgliedsauswahl bleibt persönlich; fremde Einstellungen sind weder lesbar noch schreibbar', () => {
  const other = { ...personal, user_id: stranger }
  assert.equal(push(stranger,'preferences',other).kind,'written')
  assert.equal(push(owner,'preferences',{...other,include_in_overview:false},other).kind,'rejected')
  assert.equal(sql(actorSql(owner,'select count(*) from public.list_preferences')),'1')
  assert.equal(sql(actorSql(stranger,'select count(*) from public.user_preferences')),'0')
  const result = push(stranger,'userPreferences',{...userSettings,overview_mode:'by_list'},userSettings)
  assert.equal(result.kind,'rejected'); assert.equal(result.current,undefined)
})
check('Ungültige oder nicht zugängliche Standardlisten und unbekannte Felder ändern nichts', () => {
  assert.equal(push(owner,'userPreferences',{...userSettings,default_list_id:'10000000-0000-0000-0000-000000000002'},userSettings).kind,'rejected')
  assert.equal(push(owner,'userPreferences',{...userSettings,overview_mode:'invalid'},userSettings).kind,'rejected')
  assert.equal(push(owner,'preferences',{...personal,dirty:1},personal).kind,'rejected')
  assert.equal(push(owner,'preferences',{...personal,created_at:'2026-01-02T00:00:00Z'},personal).kind,'rejected')
  assert.equal(sql(actorSql(owner,'select overview_mode from public.user_preferences')),'newest')
})
check('Neue Tabellen erzwingen RLS und geschütztes Schreiben auch nach erneuter Migration', () => {
  sql(migrations)
  for (const table of ['list_preferences','user_preferences']) {
    assert.equal(sql(`select relrowsecurity from pg_class where oid='public.${table}'::regclass`),'t')
    assert.equal(sql(`select has_table_privilege('authenticated','public.${table}','INSERT,UPDATE,DELETE')`),'f')
  }
  assert.equal(sql("select has_function_privilege('authenticated','private.sync_preference(text,jsonb,jsonb)','EXECUTE')"),'f')
  assert.equal(sql(actorSql(owner,'select overview_mode from public.user_preferences')),'newest')
})
const preferenceOutcomes = await Promise.all(['by_list','newest'].map((mode, index) => asyncSql(actorSql(owner, request([{table:'userPreferences',row:{...userSettings,overview_mode:mode,default_list_id:index ? null : listId},expected:userSettings}])))))
check('Konkurrierende Einstellungsänderungen werden atomar geprüft', () => {
  assert.deepEqual(preferenceOutcomes.map(output => JSON.parse(output)[0].kind).sort(), ['conflict','written'])
})
const lifecycleId = '20000000-0000-0000-0000-000000000099'
let lifecycle = { ...task, id: lifecycleId, title: 'Historisch erledigt', completed: true, completed_at: at }
check('Einführung gewährt sieben Tage, Wiederholung verlängert sie nicht', () => {
  sql(`insert into public.tasks(id,list_id,title,completed,completed_at,created_at,updated_at) values ('${lifecycleId}','${listId}','Historisch erledigt',true,'${at}','${at}','${at}')`)
  sql("delete from private.data_migrations where name='0017_completion_grace'")
  const backfill = readFileSync(new URL('../supabase/migrations/0017_completion_grace.sql',import.meta.url),'utf8')
  sql(backfill)
  lifecycle=JSON.parse(sql(`select to_jsonb(t) from public.tasks t where id='${lifecycleId}'`))
  assert.equal(Date.parse(lifecycle.completed_at),Date.parse(at))
  assert.ok(Math.abs(Date.parse(lifecycle.completed_expires_at)-Date.now()-7*86400000)<10000)
  sql(backfill)
  assert.equal(sql(`select completed_expires_at::text from public.tasks where id='${lifecycleId}'`),sql(`select '${lifecycle.completed_expires_at}'::timestamptz::text`))
})
check('Nur der Besitzer schaltet Aufbewahrung; Abschalten gewährt eine neue Frist', () => {
  const actualList=JSON.parse(sql(`select to_jsonb(l) from public.lists l where id='${listId}'`))
  const keeping={...actualList,keep_completed:true}
  assert.equal(push(stranger,'lists',keeping,actualList).kind,'rejected')
  assert.equal(push(owner,'lists',keeping,actualList).kind,'written')
  assert.equal(sql(`select completed_expires_at is null from public.tasks where id='${lifecycleId}'`),'t')
  const disabled=push(owner,'lists',actualList,keeping)
  assert.equal(disabled.kind,'conflict'); assert.equal(disabled.current.keep_completed,false)
  lifecycle=JSON.parse(sql(`select to_jsonb(t) from public.tasks t where id='${lifecycleId}'`))
  assert.ok(Math.abs(Date.parse(lifecycle.completed_expires_at)-Date.now()-7*86400000)<10000)
  assert.equal(Date.parse(lifecycle.completed_at),Date.parse(at))
})
check('Bearbeitung oder manipulierte Frist verlängert die bestätigte Frist nicht', () => {
  const result=push(owner,'tasks',{...lifecycle,description:'Notiz',completed_expires_at:'2099-01-01T00:00:00Z'},lifecycle)
  assert.equal(result.kind,'conflict')
  assert.equal(Date.parse(result.current.completed_expires_at),Date.parse(lifecycle.completed_expires_at))
  lifecycle=result.current
})
check('Der Abschlusszeitpunkt ist bei weiter erledigten Aufgaben unveränderlich', () => {
  const result=push(owner,'tasks',{...lifecycle,completed_at:new Date().toISOString()},lifecycle)
  assert.equal(result.kind,'rejected'); assert.equal(result.code,'22023')
  assert.equal(sql(`select completed_at::text from public.tasks where id='${lifecycleId}'`),sql(`select '${lifecycle.completed_at}'::timestamptz::text`))
})
check('Ein bisher ungesendeter Altabschluss erhält die Umstellungsfrist der Liste', () => {
  const keeping={...list,id:'10000000-0000-0000-0000-000000000095',keep_completed:true}
  assert.equal(push(owner,'lists',keeping).kind,'written')
  const disabled=push(owner,'lists',{...keeping,keep_completed:false},keeping).current
  const late={...task,id:'20000000-0000-0000-0000-000000000095',list_id:keeping.id,completed:true,completed_at:at}
  const saved=push(owner,'tasks',late).current
  assert.equal(saved.expired_at,null)
  assert.equal(Date.parse(saved.completed_at),Date.parse(at))
  assert.equal(Date.parse(saved.completed_expires_at)-Date.parse(disabled.completion_retention_started_at),7*86400000)
})
check('Erledigtes Verschieben übernimmt die Zielliste und bewahrt den Abschlusszeitpunkt', () => {
  const keeping={...list,id:'10000000-0000-0000-0000-000000000094',keep_completed:true}
  assert.equal(push(owner,'lists',keeping).kind,'written')
  const old={...task,id:'20000000-0000-0000-0000-000000000094',list_id:keeping.id,completed:true,completed_at:at}
  assert.equal(push(owner,'tasks',old).kind,'written')
  const moved=push(owner,'tasks',{...old,list_id:listId},old).current
  assert.equal(Date.parse(moved.completed_at),Date.parse(at))
  assert.ok(Math.abs(Date.parse(moved.completed_expires_at)-Date.now()-7*86400000)<10000)
  assert.equal(moved.expired_at,null)
  const back=push(owner,'tasks',{...moved,list_id:keeping.id},moved).current
  assert.equal(back.completed_expires_at,null)
  assert.equal(Date.parse(back.completed_at),Date.parse(at))
})
const policyList={...list,id:'10000000-0000-0000-0000-000000000093',keep_completed:true}
const policyTask={...task,id:'20000000-0000-0000-0000-000000000093',list_id:policyList.id}
assert.equal(push(owner,'lists',policyList).kind,'written')
assert.equal(push(owner,'tasks',policyTask).kind,'written')
const completionAt=new Date().toISOString()
const policyOutcomes=await Promise.all([
  asyncSql(actorSql(owner,request([{table:'lists',row:{...policyList,keep_completed:false},expected:policyList}]))),
  asyncSql(actorSql(owner,request([{table:'tasks',row:{...policyTask,completed:true,completed_at:completionAt},expected:policyTask}]))),
])
check('Gleichzeitiges Abschalten und Abhaken hinterlässt die bestätigte Listenfrist', () => {
  for(const result of policyOutcomes.map(output=>JSON.parse(output)[0])) assert.notEqual(result.kind,'rejected')
  const saved=JSON.parse(sql(`select to_jsonb(t) from public.tasks t where id='${policyTask.id}'`))
  assert.equal(sql(`select keep_completed from public.lists where id='${policyList.id}'`),'f')
  assert.equal(Date.parse(saved.completed_at),Date.parse(completionAt))
  assert.equal(saved.expired_at,null)
  assert.ok(Math.abs(Date.parse(saved.completed_expires_at)-Date.now()-7*86400000)<10000)
})
check('Abgelaufenes wird vor Umschalten final entfernt, auch ohne Cron-Runde', () => {
  sql(`update public.tasks set completed_expires_at=now()-interval '1 second' where id='${lifecycleId}'`)
  const actualList=JSON.parse(sql(`select to_jsonb(l) from public.lists l where id='${listId}'`))
  assert.equal(push(owner,'lists',{...actualList,keep_completed:true},actualList).kind,'written')
  const expired=JSON.parse(sql(`select to_jsonb(t) from public.tasks t where id='${lifecycleId}'`))
  assert.ok(expired.expired_at && expired.deleted_at)
  assert.equal(expired.title,'Abgelaufene Aufgabe'); assert.equal(expired.description,null)
  assert.equal(push(owner,'tasks',{...lifecycle,completed:false,completed_at:null,completed_expires_at:null,updated_at:'2099-01-01T00:00:00Z'},lifecycle).current.expired_at,expired.expired_at)
  assert.equal(sql("select has_function_privilege('authenticated','private.expire_completed_tasks()','EXECUTE')"),'f')
})
check('Ein später erstmals hochgeladener Abschluss wird sofort endgültig abgelaufen', () => {
  const actualList=JSON.parse(sql(`select to_jsonb(l) from public.lists l where id='${listId}'`))
  assert.equal(push(owner,'lists',{...actualList,keep_completed:false},actualList).current.keep_completed,false)
  const oldList={...list,id:'10000000-0000-0000-0000-000000000099'}
  assert.equal(push(owner,'lists',oldList).kind,'written')
  const late={...task,id:'20000000-0000-0000-0000-000000000098',list_id:oldList.id,completed:true,completed_at:at}
  const result=push(owner,'tasks',late)
  assert.equal(result.kind,'conflict'); assert.ok(result.current.expired_at)
  assert.equal(result.current.title,'Abgelaufene Aufgabe')
})
check('Ein benannter Cloudjob bleibt beim erneuten Einspielen genau einmal aktiv', () => {
  const cronMigration=readFileSync(new URL('../supabase/migrations/0018_completion_cron.sql',import.meta.url),'utf8')
  sql(cronMigration); sql(cronMigration)
  assert.equal(sql("select count(*) from cron.job where jobname='prio-expire-completed' and active"),'1')
})
const cronId='20000000-0000-0000-0000-000000000097'
sql(`select cron.alter_job(jobid,active=>false) from cron.job where jobname='prio-expire-completed';
insert into public.tasks(id,list_id,title,completed,completed_at,completed_expires_at,created_at,updated_at)
values ('${cronId}','${listId}','Ohne geöffnete App',true,now()-interval '8 days',now()-interval '1 second',now()-interval '8 days',now());
select cron.schedule('prio-test-expire','1 second','select private.expire_completed_tasks()')`)
try {
  for(let attempt=0;attempt<40;attempt++) {
    if(sql(`select expired_at is not null from public.tasks where id='${cronId}'`)==='t') break
    await new Promise(resolve=>setTimeout(resolve,250))
  }
  check('Der echte Datenbank-Zeitgeber löscht ohne App oder MCP-Aufruf', () => {
    assert.equal(sql(`select expired_at is not null from public.tasks where id='${cronId}'`),'t')
    assert.equal(sql("select count(*)>0 from cron.job_run_details where jobid=(select jobid from cron.job where jobname='prio-test-expire') and status='succeeded'"),'t')
  })
} finally {
  sql("select cron.unschedule('prio-test-expire'); select cron.alter_job(jobid,active=>true) from cron.job where jobname='prio-expire-completed'")
}
console.log(`${checks} PostgreSQL-Prüfungen bestanden.`)
