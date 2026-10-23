/** Ausschließlich eine wegwerfbare lokale Testdatenbank, niemals die Cloud. */
import { spawn, spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { testMcp } from './db-mcp-test.mjs'
import { testWidgets } from './db-widget-test.mjs'

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
create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}'::jsonb);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
grant usage on schema auth to authenticated,anon;`)
const migrations = readFileSync(new URL('../supabase/all-migrations.sql', import.meta.url), 'utf8')
sql(migrations)
sql(`insert into auth.users(id,email) values ('${owner}','owner@prio.test'),('${member}','member@prio.test'),('${stranger}','stranger@prio.test')`)
const list = { id: listId, owner_id: owner, name: 'Liste', is_shared: false, icon: null, sections: [], keep_completed: false, ratings_enabled: false, allow_duplicate_titles: true, completion_retention_started_at: at, created_at: at, updated_at: at, deleted_at: null }
const task = { id: taskId, list_id: listId, title: 'Anfang', description: null, checklist: [], tags: [], rating: null, due_at: null, available_from: null, completed: false, completed_at: null, completed_expires_at: null, expired_at: null, reopen_context: null, recurrence: null, successor_id: null, recurrence_series_id: null, reminders: [], section_id: null, position: 0, created_at: at, updated_at: at, deleted_at: null }

check('Bestehende Konten wählen einen eindeutigen Namen; Auth und Profil bleiben atomar', () => {
  assert.equal(sql(`select username is null from public.profiles where id='${owner}'`),'t')
  sql(`update auth.users set raw_user_meta_data='{"username":"OWNER_Name"}' where id='${owner}'`)
  assert.equal(sql(`select username from public.profiles where id='${owner}'`),'owner_name')
  assert.throws(() => sql(`update auth.users set raw_user_meta_data='{"username":"Owner_Name"}' where id='${member}'`), /bereits vergeben/)
  assert.equal(sql(`select raw_user_meta_data from auth.users where id='${member}'`),'{}')
  assert.throws(() => sql(`update auth.users set raw_user_meta_data='{"username":"ungueltig!"}' where id='${member}'`), /Benutzername/)
  assert.throws(() => sql(`update auth.users set raw_user_meta_data='{}' where id='${owner}'`), /entfernt/)
  assert.equal(sql("begin;set local role anon;select public.username_available('owner_name');commit"),'f')
  assert.equal(sql("begin;set local role anon;select public.username_available('anderer_name');commit"),'t')
  assert.equal(sql("select has_function_privilege('anon','public.share_list_by_username(uuid,text,uuid)','EXECUTE')"),'f')
  sql(`update auth.users set raw_user_meta_data='{"username":"member_name"}' where id='${member}'`)
})

check('Teilen per Benutzername schützt Besitz und gibt nur verbundene Namen heraus', () => {
  const temporary='10000000-0000-0000-0000-000000000099'
  const result=sql(`begin;
    insert into public.lists(id,owner_id,name) values('${temporary}','${owner}','Namen prüfen');
    set local role authenticated;set local request.jwt.claim.sub='${owner}';
    select public.share_list_by_username('${temporary}','MEMBER_Name');
    select username || ':' || (email='')::text from public.co_member_contacts();rollback;`)
  assert.equal(result,`${member}\nmember_name:true`)
  sql(`insert into public.lists(id,owner_id,name) values('${temporary}','${owner}','Veralteter Name')`)
  assert.throws(() => sql(actorSql(owner,`select public.share_list_by_username('${temporary}','member_name','${stranger}')`)), /anderen Konto/)
  assert.equal(sql(`select count(*) from public.list_members where list_id='${temporary}'`),'0')
  assert.equal(sql(`select is_shared from public.lists where id='${temporary}'`),'f')
  sql(`delete from public.lists where id='${temporary}'`)
  assert.throws(() => sql(`begin;set local role anon;select public.share_list_by_username('${temporary}','member_name');commit;`), /permission denied/)
  assert.equal(sql(actorSql(stranger,'select count(*) from public.co_member_contacts()')),'0')
  assert.equal(sql(actorSql(owner,'select count(*) from public.profiles')),'1')
})
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
const personal = { list_id: listId, user_id: owner, include_in_overview: true, position: null, hidden: false, sort_mode: 'manual', created_at: at, updated_at: at, deleted_at: null }
const userSettings = { id: owner, default_list_id: listId, overview_mode: 'newest', detailed_ratings: false, task_expansions: {}, created_at: at, updated_at: at, deleted_at: null }
check('Persönliche Aufnahme und bevorzugte Ansicht: Schreiben, Retry und stale Basis', () => {
  assert.equal(push(owner,'preferences',personal).kind,'written')
  assert.equal(push(owner,'userPreferences',userSettings).kind,'written')
  assert.equal(push(owner,'userPreferences',userSettings).kind,'written')
  assert.equal(push(owner,'userPreferences',{...userSettings,overview_mode:'by_list'}).kind,'conflict')
  assert.equal(sql(actorSql(owner,'select overview_mode from public.user_preferences')),'newest')
})
check('Navigation überträgt neue Felder, akzeptiert eine alte Basis und bleibt persönlich', () => {
  const legacy = { ...personal }
  delete legacy.position; delete legacy.hidden; delete legacy.sort_mode
  const moved = push(owner,'preferences',{...personal,position:1.5,hidden:true},legacy)
  assert.equal(moved.kind,'written')
  assert.equal(moved.current.hidden,true)
  assert.equal(moved.current.position,1.5)
  assert.equal(moved.current.include_in_overview,true)
  assert.equal(push(member,'preferences',{...moved.current,position:2},moved.current).kind,'rejected')
  assert.equal(push(owner,'preferences',{...moved.current,position:'NaN'},moved.current).kind,'rejected')
  assert.equal(push(owner,'preferences',personal,moved.current).kind,'written')
})
check('Appweite Detailansicht und Prioritätssortierung bleiben persönlich und migrationsfest', () => {
  const legacy = { ...userSettings }
  delete legacy.detailed_ratings
  delete legacy.task_expansions
  const detailed = { ...userSettings, overview_mode: 'priority', detailed_ratings: true }
  assert.equal(push(owner,'userPreferences',detailed,legacy).kind,'written')
  sql(migrations)
  assert.equal(sql(actorSql(owner,'select overview_mode || \':\' || detailed_ratings from public.user_preferences')),'priority:true')
  assert.equal(push(stranger,'userPreferences',{...detailed,detailed_ratings:false},detailed).kind,'rejected')
  assert.equal(push(owner,'userPreferences',userSettings,detailed).kind,'written')
})
check('Aufklappzustände sind persönlich, validiert und nach erneutem Einspielen erhalten', () => {
  const expanded = { ...userSettings, task_expansions: { [taskId]: 3 } }
  assert.equal(push(owner,'userPreferences',expanded,userSettings).kind,'written')
  sql(migrations)
  assert.deepEqual(JSON.parse(sql(actorSql(owner,'select task_expansions from public.user_preferences'))),{[taskId]:3})
  assert.equal(push(stranger,'userPreferences',expanded,expanded).kind,'rejected')
  for (const value of [[], { bad: 4 }, { bad: true }]) {
    assert.equal(push(owner,'userPreferences',{...expanded,task_expansions:value},expanded).kind,'rejected')
  }
  assert.equal(push(owner,'userPreferences',userSettings,expanded).kind,'written')
})
check('Listensortierung bleibt persönlich, validiert und über erneute Migration erhalten', () => {
  const current=JSON.parse(sql(`select to_jsonb(p) from public.list_preferences p where user_id='${owner}' and list_id='${listId}'`))
  const grouped=push(owner,'preferences',{...current,sort_mode:'priority'},current)
  assert.equal(grouped.kind,'written')
  assert.equal(push(member,'preferences',{...grouped.current,sort_mode:'manual'},grouped.current).kind,'rejected')
  assert.equal(push(owner,'preferences',{...grouped.current,sort_mode:'invalid'},grouped.current).kind,'rejected')
  sql(migrations)
  assert.equal(sql(`select sort_mode from public.list_preferences where user_id='${owner}' and list_id='${listId}'`),'priority')
  assert.equal(push(owner,'preferences',current,grouped.current).kind,'written')
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
check('Checkliste und Tags passieren denselben geschützten Schreibweg; ungültiger Inhalt und Fremdzugriff scheitern', () => {
  const id='20000000-0000-0000-0000-000000000071'
  const privateList={...list,id:'10000000-0000-0000-0000-000000000071'}
  assert.equal(push(owner,'lists',privateList).kind,'written')
  const details={...task,id,list_id:privateList.id,checklist:[{id:'punkt-a',text:'Erster Punkt',completed:false,deleted_at:null}],tags:['Uni','Dringend']}
  const first=push(owner,'tasks',details)
  assert.equal(first.kind,'written')
  assert.deepEqual(first.current.checklist,details.checklist)
  assert.deepEqual(first.current.tags,details.tags)
  assert.equal(push(stranger,'tasks',{...details,tags:['Fremd']},first.current).kind,'rejected')
  for(const invalid of [
    {...details,tags:[1]}, {...details,tags:['']}, {...details,checklist:{}},
    {...details,checklist:[{id:'x',text:'',completed:false,deleted_at:null}]},
    {...details,checklist:[...details.checklist,...details.checklist]},
  ]) assert.equal(push(owner,'tasks',invalid,first.current).kind,'rejected')
  const checked={...details,checklist:[{...details.checklist[0],completed:true}]}
  assert.equal(push(owner,'tasks',checked,first.current).kind,'written')
  assert.equal(push(owner,'tasks',{...details,tags:['Veraltet']},first.current).kind,'conflict')
  assert.equal(sql(`select completed from public.tasks where id='${id}'`),'f')
})
check('Endgültiger Ablauf entfernt Checklisten und Tags samt dem übrigen fachlichen Inhalt', () => {
  const id='20000000-0000-0000-0000-000000000071'
  sql(`update public.tasks set completed=true,completed_at=now()-interval '8 days',completed_expires_at=now()-interval '1 second' where id='${id}';select private.expire_completed_in_list((select list_id from public.tasks where id='${id}'))`)
  const expired=JSON.parse(sql(`select to_jsonb(t) from public.tasks t where id='${id}'`))
  assert.ok(expired.expired_at)
  assert.deepEqual(expired.checklist,[])
  assert.deepEqual(expired.tags,[])
})
function pull(actor, checkpoint = null, after = null, limit = 500) {
  const literal = value => value == null ? 'null' : "'" + value.replaceAll("'", "''") + "'"
  const ids = checkpoint?.listIds ?? []
  return JSON.parse(sql(actorSql(actor,`select public.sync_pull(${literal(checkpoint?.snapshot)},array[${ids.map(literal).join(',')}]::uuid[],${literal(after)},${limit})`)))
}
check('Delta-Pull liefert nach bestätigtem Bestand keine unveränderten Zeilen', () => {
  const first = pull(owner)
  assert.ok(first.changes.some(change=>change.table==='tasks'))
  assert.deepEqual(pull(owner,first.checkpoint).changes,[])
  sql(`update public.tasks set title='Delta trotz alter Uhr',updated_at='1900-01-01' where id='${taskId}'`)
  const delta = pull(owner,first.checkpoint)
  assert.deepEqual(delta.changes.map(change=>change.row.id),[taskId])
  assert.equal(delta.changes[0].row.title,'Delta trotz alter Uhr')
  assert.deepEqual(pull(owner,delta.checkpoint).changes,[])
  sql(`update public.tasks set title=title where id='${taskId}'`)
  assert.deepEqual(pull(owner,delta.checkpoint).changes,[])
})
check('Delta-Pull sperrt anonyme Zugriffe und fremde Daten, Metadaten bleiben privat', () => {
  assert.throws(()=>sql('begin;set local role anon;select public.sync_pull();commit'),/permission denied/)
  assert.throws(()=>sql(actorSql(owner,'select count(*) from private.sync_row_versions')),/permission denied/)
  const result=pull(stranger)
  const allowed=JSON.parse(sql(actorSql(stranger,`select coalesce(jsonb_agg(key order by key),'[]') from (
    select 'lists:'||id::text key from public.lists union all
    select 'members:'||list_id::text||':'||user_id::text from public.list_members union all
    select 'tasks:'||id::text from public.tasks union all
    select 'preferences:'||list_id::text||':'||user_id::text from public.list_preferences union all
    select 'userPreferences:'||id::text from public.user_preferences) visible`)))
  assert.deepEqual(result.changes.map(change=>change.table+':'+(change.row.id ?? change.row.list_id+':'+change.row.user_id)).sort(),allowed.sort())
  assert.ok(!result.changes.some(change=>change.row.id==='10000000-0000-0000-0000-000000000071'))
  assert.equal(sql("select prosecdef from pg_proc where oid='public.sync_pull(text,uuid[],text,integer)'::regprocedure"),'f')
})
check('Neue Freigabe liefert alte Aufgaben; Entzug und Listenlöschung liefern keine fremden Inhalte', () => {
  const invited='00000000-0000-0000-0000-000000000008', shared='10000000-0000-0000-0000-000000000008'
  sql(`insert into auth.users(id,email) values('${invited}','delta@prio.test');insert into public.lists(id,owner_id,name,updated_at) values('${shared}','${owner}','Alte Freigabe','1900-01-01');
    insert into public.tasks(id,list_id,title,updated_at) values('20000000-0000-0000-0000-000000000008','${shared}','Sehr alte Aufgabe','1900-01-01')`)
  const before=pull(invited)
  assert.deepEqual(before.changes,[])
  sql(`insert into public.list_members(list_id,user_id) values('${shared}','${invited}')`)
  const granted=pull(invited,before.checkpoint)
  assert.ok(granted.changes.some(change=>change.row.title==='Sehr alte Aufgabe'))
  assert.deepEqual(pull(invited,granted.checkpoint).changes,[])
  sql(`update public.list_members set deleted_at=now() where list_id='${shared}' and user_id='${invited}'`)
  const removed=pull(invited,granted.checkpoint)
  assert.deepEqual(removed.removedListIds,[shared])
  assert.ok(removed.changes.every(change=>change.table==='members' && change.row.deleted_at))
  sql(`update public.list_members set deleted_at=null where list_id='${shared}' and user_id='${invited}'`)
  const again=pull(invited,removed.checkpoint)
  assert.ok(again.changes.some(change=>change.row.title==='Sehr alte Aufgabe'))
  sql(`update public.lists set deleted_at=now() where id='${shared}'`)
  const deleted=pull(invited,again.checkpoint)
  assert.deepEqual(deleted.removedListIds,[shared])
  assert.deepEqual(deleted.changes,[])
})
check('Mehrere Delta-Seiten verlieren keine Änderung hinter der bereits gelesenen Seite', () => {
  const id='10000000-0000-0000-0000-000000000007'
  sql(`insert into public.lists(id,owner_id,name) values('${id}','${owner}','Viele Aufgaben')`)
  const before=pull(owner)
  sql(`insert into public.tasks(id,list_id,title) select md5('delta-page-'||n)::uuid,'${id}','Aufgabe '||n from generate_series(1,1201)n`)
  let page=pull(owner,before.checkpoint,null,111), first=page.checkpoint, rows=[...page.changes]
  const changed=page.changes.find(change=>change.table==='tasks').row.id
  sql(`update public.tasks set description='Während des Lesens' where id='${changed}'`)
  while(page.hasMore) { page=pull(owner,before.checkpoint,page.nextAfter,111); rows.push(...page.changes) }
  assert.equal(rows.filter(change=>change.table==='tasks').length,1201)
  const next=pull(owner,first)
  assert.ok(next.changes.some(change=>change.row.id===changed && change.row.description==='Während des Lesens'))
  assert.deepEqual(pull(owner,next.checkpoint).changes,[])
})
// Haupttransaktion mit bereits zugewiesener Kennung läuft beim ersten Pull noch.
// xmax allein (oder eine Sequenz) würde ihren späteren Commit übersehen.
const lateId='20000000-0000-0000-0000-000000000006'
sql(`insert into public.tasks(id,list_id,title) values('${lateId}','${listId}','Vor spätem Commit')`)
const lateWriter=spawn('psql',args)
let writerOutput='', writerError=''
lateWriter.stdout.on('data',data=>{writerOutput+=data})
lateWriter.stderr.on('data',data=>{writerError+=data})
const writerDone=new Promise((resolve,reject)=>{lateWriter.on('error',reject);lateWriter.on('close',code=>code===0?resolve():reject(new Error(writerError)))})
lateWriter.stdin.write(`begin;update public.tasks set title='Später Commit',updated_at='1900-01-01' where id='${lateId}';select 'writer-ready';`+'\n')
for(let attempt=0;attempt<100 && !writerOutput.includes('writer-ready');attempt++) await new Promise(resolve=>setTimeout(resolve,10))
assert.ok(writerOutput.includes('writer-ready'))
const during=pull(owner)
lateWriter.stdin.end('commit;\n')
await writerDone
check('Später Commit einer schon laufenden Transaktion wird im nächsten Delta geliefert', () => {
  const next=pull(owner,during.checkpoint)
  assert.ok(next.changes.some(change=>change.row.id===lateId && change.row.title==='Später Commit'))
  assert.deepEqual(pull(owner,next.checkpoint).changes,[])
})
check('Erneute Migration ändert die bestätigten Delta-Versionen nicht', () => {
  const before=pull(owner)
  sql(readFileSync(new URL('../supabase/migrations/0022_incremental_sync.sql',import.meta.url),'utf8'))
  assert.deepEqual(pull(owner,before.checkpoint).changes,[])
})
check('Bewertungen und Gewichtungen werden atomar validiert; Mitglieder können keine Listenregel ändern', () => {
  const ratedList={...list,id:'10000000-0000-0000-0000-000000000081',ratings_enabled:true}
  assert.equal(push(owner,'lists',ratedList).kind,'written')
  assert.equal(push(owner,'members',{...membership,list_id:ratedList.id}).kind,'written')
  const rating={importance:7.5,urgency:5,effort:6,urgencyMode:'auto',effortFromChecklist:true}
  const checklist=[{id:'a',text:'Groß',completed:false,deleted_at:null,weight:0.75},{id:'b',text:'Klein',completed:false,deleted_at:null,weight:0.25}]
  const rated={...task,id:'20000000-0000-0000-0000-000000000081',list_id:ratedList.id,rating,checklist}
  const first=push(owner,'tasks',rated)
  assert.equal(first.kind,'written')
  assert.deepEqual(first.current.rating,rating)
  assert.deepEqual(first.current.checklist,checklist)
  for(const invalid of [
    {...rating,importance:11}, {...rating,urgency:-1}, {...rating,effort:'6'},
    {...rating,urgencyMode:null}, {...rating,effortFromChecklist:'true'}, {...rating,extra:true},
    {importance:5},
  ]) assert.equal(push(owner,'tasks',{...rated,rating:invalid},first.current).kind,'rejected')
  for(const invalid of [
    [{...checklist[0],weight:-0.1},checklist[1]],
    [{...checklist[0],weight:0.5},checklist[1]],
    [checklist[0],{id:'b',text:'Klein',completed:false,deleted_at:null}],
  ]) assert.equal(push(owner,'tasks',{...rated,checklist:invalid},first.current).kind,'rejected')
  assert.equal(push(member,'lists',{...ratedList,ratings_enabled:false},ratedList).kind,'rejected')
  const changed=push(member,'tasks',{...rated,rating:{...rating,importance:8}},first.current)
  assert.equal(changed.kind,'written')
  assert.equal(push(owner,'lists',{...ratedList,ratings_enabled:false},ratedList).kind,'written')
  assert.deepEqual(JSON.parse(sql(`select rating from public.tasks where id='${rated.id}'`)),changed.current.rating)
  sql(`update public.tasks set completed=true,completed_at=now()-interval '8 days',completed_expires_at=now()-interval '1 second' where id='${rated.id}';select private.expire_completed_in_list('${ratedList.id}')`)
  assert.equal(sql(`select rating is null from public.tasks where id='${rated.id}'`),'t')
})
check('Update von alten Zeilen lässt bestehende Listen aus und neue an; Wiederholung bewahrt Einstellungen', () => {
  // Tatsächlicher Update-Weg von vor 0023; nur in der wegwerfbaren Datenbank.
  sql('alter table public.lists drop column ratings_enabled; alter table public.tasks drop column rating')
  const migration=readFileSync(new URL('../supabase/migrations/0023_task_ratings.sql',import.meta.url),'utf8')
  sql(migration)
  assert.equal(sql('select bool_and(not ratings_enabled) from public.lists'),'t')
  assert.equal(sql('select bool_and(rating is null) from public.tasks'),'t')
  const id='10000000-0000-0000-0000-000000000082'
  sql(`insert into public.lists(id,owner_id,name) values('${id}','${owner}','Neue bewertete Liste')`)
  assert.equal(sql(`select ratings_enabled from public.lists where id='${id}'`),'t')
  sql(migration)
  assert.equal(sql(`select ratings_enabled from public.lists where id='${listId}'`),'f')
  assert.equal(sql(`select ratings_enabled from public.lists where id='${id}'`),'t')
})
check('Namensverbot berücksichtigt erledigte Aufgaben, normalisiert Leerzeichen und erhält bestehende Duplikate', () => {
  const uniqueList={...list,id:'70000000-0000-0000-0000-000000000090',keep_completed:true,allow_duplicate_titles:false}
  assert.equal(push(owner,'lists',uniqueList).kind,'written')
  assert.equal(push(owner,'members',{...membership,list_id:uniqueList.id}).kind,'written')
  const first={...task,id:'80000000-0000-0000-0000-000000000090',list_id:uniqueList.id,title:'Zelt aufbauen',completed:true,completed_at:new Date().toISOString()}
  const saved=push(owner,'tasks',first).current
  for(const title of [' ZELT  aufbauen ','Zelt\u00a0aufbauen','Zelt\u2009aufbauen']) {
    const attempt=push(member,'tasks',{...task,id:'80000000-0000-0000-0000-000000000091',list_id:uniqueList.id,title})
    assert.equal(attempt.kind,'rejected');assert.equal(attempt.code,'23505')
  }
  assert.equal(push(member,'lists',{...uniqueList,allow_duplicate_titles:true},uniqueList).kind,'rejected')
  assert.equal(push(member,'tasks',{...saved,description:'Notiz trotz gleichem Titel'},saved).kind,'written')
  const other={...task,id:'80000000-0000-0000-0000-000000000092',title:'Zelt aufbauen'}
  const from=push(owner,'tasks',other).current
  assert.equal(push(owner,'tasks',{...from,list_id:uniqueList.id},from).code,'23505')
  assert.equal(sql(`select list_id from public.tasks where id='${other.id}'`),listId)
  const renamed={...task,id:'80000000-0000-0000-0000-000000000093',list_id:uniqueList.id,title:'Schlafsack'}
  const renameBase=push(owner,'tasks',renamed).current
  assert.equal(push(owner,'tasks',{...renameBase,title:'Zelt aufbauen'},renameBase).code,'23505')
  const deletedBase=push(owner,'tasks',{...task,id:'80000000-0000-0000-0000-000000000094',list_id:uniqueList.id,title:'Zelt aufbauen',deleted_at:at}).current
  assert.equal(push(owner,'tasks',{...deletedBase,deleted_at:null},deletedBase).code,'23505')
  // Aus Altbestand übernommene Duplikate bleiben erlaubt, aber keine neuen.
  const allowed=push(owner,'lists',{...uniqueList,allow_duplicate_titles:true},uniqueList).current
  assert.equal(push(owner,'tasks',{...task,id:'80000000-0000-0000-0000-000000000095',list_id:uniqueList.id,title:'Zelt aufbauen'}).kind,'written')
  push(owner,'lists',{...allowed,allow_duplicate_titles:false},allowed)
  const existing=JSON.parse(sql(`select to_jsonb(t) from public.tasks t where id='80000000-0000-0000-0000-000000000095'`))
  assert.equal(push(owner,'tasks',{...existing,description:'Vorhandenes Duplikat bleibt editierbar'},existing).kind,'written')
})
const concurrentList={...list,id:'70000000-0000-0000-0000-000000000096',allow_duplicate_titles:false}
push(owner,'lists',concurrentList)
const names=['Zelt',' ZELT ']
const simultaneous=await Promise.all(names.map((title,index)=>asyncSql(actorSql(owner,request([{table:'tasks',row:{...task,id:`80000000-0000-0000-0000-00000000009${6+index}`,list_id:concurrentList.id,title},expected:null}])))))
check('Paralleles Cloud-Anlegen verschiedener Kennungen mit gleichem Namen wird serialisiert', () => {
  assert.deepEqual(simultaneous.map(value=>JSON.parse(value)[0].kind).sort(),['rejected','written'])
  assert.equal(sql(`select count(*) from public.tasks where list_id='${concurrentList.id}'`),'1')
})
check('Wiederholungen derselben Serie sind ausgenommen; eine manuell neue Serie bleibt blockiert', () => {
  const routine={...list,id:'70000000-0000-0000-0000-000000000098',allow_duplicate_titles:false,keep_completed:true}
  push(owner,'lists',routine)
  const root={...task,id:'80000000-0000-0000-0000-000000000098',list_id:routine.id,title:'Lesen',recurrence:'daily',due_at:'2030-01-01T12:00:00Z',recurrence_series_id:'80000000-0000-0000-0000-000000000098'}
  const first=push(owner,'tasks',root).current
  const child={...root,id:'80000000-0000-0000-0000-000000000099',due_at:'2030-01-02T12:00:00Z'}
  assert.equal(push(owner,'tasks',child).kind,'written')
  assert.equal(push(owner,'tasks',{...root,id:'80000000-0000-0000-0000-000000000100',recurrence_series_id:'80000000-0000-0000-0000-000000000100'}).code,'23505')
  assert.equal(push(owner,'tasks',{...first,recurrence_series_id:null},first).code,'22023')
})
check('Update ergänzt fehlende Felder und alte Serien einmalig; erneute Migration bewahrt spätere Änderungen', () => {
  sql('alter table public.lists drop column allow_duplicate_titles; alter table public.tasks drop column recurrence_series_id; delete from private.data_migrations where name=\'0024_recurrence_series\'')
  sql(`update public.tasks set successor_id='80000000-0000-0000-0000-000000000099' where id='80000000-0000-0000-0000-000000000098'`)
  const migration=readFileSync(new URL('../supabase/migrations/0024_unique_task_titles.sql',import.meta.url),'utf8')
  sql(migration)
  assert.equal(sql('select bool_and(allow_duplicate_titles) from public.lists'),'t')
  assert.equal(sql(`select count(distinct recurrence_series_id) from public.tasks where id in ('80000000-0000-0000-0000-000000000098','80000000-0000-0000-0000-000000000099')`),'1')
  sql(`update public.lists set allow_duplicate_titles=false where id='${listId}';update public.tasks set title='Notiz nach Update' where id='${taskId}'`)
  const before=sql(`select jsonb_agg(to_jsonb(t) order by id) from public.tasks t`)
  sql(migration)
  assert.equal(sql(`select allow_duplicate_titles from public.lists where id='${listId}'`),'f')
  assert.equal(sql(`select jsonb_agg(to_jsonb(t) order by id) from public.tasks t`),before)
})
check('Sichtbarkeitsregeln werden atomar gespeichert und ungültige Vorläufe abgewiesen', () => {
  const id='90000000-0000-0000-0000-000000000080'
  const rule={visibility:{mode:'clock',time:'05:00'},resetMissed:true,timeZone:'Europe/Berlin'}
  const row={...task,id,title:'Kalenderroutine',recurrence:'daily',recurrence_series_id:id,due_at:'2030-01-01T21:30:00Z',recurrence_rule:rule}
  assert.equal(push(owner,'tasks',row).kind,'written')
  const saved=JSON.parse(sql(`select to_jsonb(t) from public.tasks t where id='${id}'`))
  assert.deepEqual(saved.recurrence_rule,rule)
  const oldDevice={...saved,title:'Altes Gerät bearbeitet Titel'};delete oldDevice.recurrence_rule
  assert.equal(push(owner,'tasks',oldDevice,saved).kind,'written')
  assert.deepEqual(JSON.parse(sql(`select recurrence_rule from public.tasks where id='${id}'`)),rule)
  const current=JSON.parse(sql(`select to_jsonb(t) from public.tasks t where id='${id}'`))
  assert.equal(push(owner,'tasks',{...current,recurrence_rule:{...rule,visibility:{mode:'lead',minutes:-1}}},current).kind,'rejected')
  assert.deepEqual(JSON.parse(sql(`select recurrence_rule from public.tasks where id='${id}'`)),rule)
})
check('Kalendertage bleiben persönlich und erneutes Einspielen erhält die Auswahl', () => {
  const current=JSON.parse(sql(`select to_jsonb(p) from public.user_preferences p where id='${owner}'`))
  const calendar={days:{'2030-01-01':'low','2030-01-02':'none'},repeats:'active',open:true,timeZone:'Europe/Berlin'}
  assert.equal(push(owner,'userPreferences',{...current,calendar_preferences:calendar},current).kind,'written')
  assert.equal(sql(actorSql(stranger,`select count(*) from public.user_preferences where id='${owner}'`)),'0')
  sql(readFileSync(new URL('../supabase/migrations/0030_calendar_routines.sql',import.meta.url),'utf8'))
  const saved=JSON.parse(sql(`select to_jsonb(p) from public.user_preferences p where id='${owner}'`))
  assert.deepEqual(saved.calendar_preferences,calendar)
  const oldDevice={...saved,detailed_ratings:!saved.detailed_ratings};delete oldDevice.calendar_preferences
  assert.equal(push(owner,'userPreferences',oldDevice,saved).kind,'written')
  assert.deepEqual(JSON.parse(sql(`select calendar_preferences from public.user_preferences where id='${owner}'`)),calendar)
  const latest=JSON.parse(sql(`select to_jsonb(p) from public.user_preferences p where id='${owner}'`))
  assert.equal(push(owner,'userPreferences',{...latest,calendar_preferences:{...calendar,repeats:'without-daily'}},latest).kind,'rejected')
})
checks += testMcp(sql)
checks += await testWidgets(sql, asyncSql)
console.log(`${checks} PostgreSQL-Prüfungen bestanden.`)
