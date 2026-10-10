#!/usr/bin/env node
/**
 * Prüft die Zugriffsregeln gegen das **echte** Supabase-Projekt.
 *
 * Warum es das gibt: Teilen und Row Level Security liefen bisher nur gegen den
 * Mock. Der Mock kann keine verletzte Regel melden – er kennt sie nicht. Was
 * dabei durchrutschen kann, wäre genau das, was am meisten schadet: eine Liste,
 * die jemand sieht, der sie nicht sehen darf.
 *
 * Der Ablauf bildet den Weg der App nach: A legt eine Liste an, B darf sie
 * **nicht** sehen, A teilt sie über `share_list_by_email`, danach darf B sie
 * sehen und lesen – löschen aber nicht.
 *
 * Voraussetzung: zwei Testkonten in `~/.prio-android/testkonten.env`
 * (angelegt und per SQL bestätigt) und `db.env` zum Aufräumen.
 *
 *   npm run db:rls-check
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const API = process.env.SUPABASE_URL ?? null

function envDatei(pfad, namen) {
  const inhalt = readFileSync(pfad, 'utf8')
  const werte = {}
  for (const zeile of inhalt.split('\n')) {
    const treffer = /^([A-Z_]+)\s*=\s*(.*)$/.exec(zeile.trim())
    if (treffer && namen.includes(treffer[1])) werte[treffer[1]] = treffer[2]
  }
  return werte
}

const projekt = envDatei(join(process.cwd(), '.env'), ['VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY'])
const URL_ = API ?? projekt.VITE_SUPABASE_URL
const KEY = projekt.VITE_SUPABASE_PUBLISHABLE_KEY
const konten = envDatei(join(homedir(), '.prio-android', 'testkonten.env'), [
  'PRIO_TEST_A_EMAIL', 'PRIO_TEST_A_PASSWORT', 'PRIO_TEST_A_ID',
  'PRIO_TEST_B_EMAIL', 'PRIO_TEST_B_PASSWORT', 'PRIO_TEST_B_ID',
])

if (!URL_ || !KEY) {
  console.error('Projektadresse fehlt – .env prüfen (VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY).')
  process.exit(1)
}
if (!konten.PRIO_TEST_A_EMAIL || !konten.PRIO_TEST_B_EMAIL) {
  console.error('Testkonten fehlen: ~/.prio-android/testkonten.env')
  process.exit(1)
}

async function anmelden(email, passwort) {
  const antwort = await fetch(`${URL_}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: KEY, 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: passwort }),
  })
  if (!antwort.ok) throw new Error(`Anmeldung ${email}: ${antwort.status} ${await antwort.text()}`)
  const daten = await antwort.json()
  return { token: daten.access_token, id: daten.user.id }
}

async function rest(pfad, { token, method = 'GET', body, prefer } = {}) {
  const antwort = await fetch(`${URL_}/rest/v1/${pfad}`, {
    method,
    headers: {
      apikey: KEY,
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      ...(prefer ? { prefer: prefer } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
  const text = await antwort.text()
  let daten = null
  try {
    daten = text === '' ? null : JSON.parse(text)
  } catch {
    daten = text
  }
  return { status: antwort.status, ok: antwort.ok, daten }
}

let fehler = 0
function pruefe(name, bedingung, zusatz = '') {
  console.log(`  ${bedingung ? '✓' : '✗'} ${name}${zusatz ? ` – ${zusatz}` : ''}`)
  if (!bedingung) fehler += 1
}

const a = await anmelden(konten.PRIO_TEST_A_EMAIL, konten.PRIO_TEST_A_PASSWORT)
const b = await anmelden(konten.PRIO_TEST_B_EMAIL, konten.PRIO_TEST_B_PASSWORT)
console.log(`Angemeldet: A ${a.id.slice(0, 8)}…, B ${b.id.slice(0, 8)}…\n`)

const stempel = new Date().toISOString()
// Kennungen erzeugt die App selbst, `id` hat in der Datenbank keinen
// Vorgabewert; `owner_id` muss der angemeldete Nutzer sein, sonst greift die
// Policy für das Anlegen.
const listenId = crypto.randomUUID()
const liste = await rest('rpc/sync_push', {
  token: a.token,
  method: 'POST',
  body: { p_changes: [{ table: 'lists', expected: null, row: {
    id: listenId, name: `RLS-Prüfung ${stempel}`, owner_id: a.id,
    is_shared: false, icon: null, sections: [], keep_completed: false,
    completion_retention_started_at: stempel,
    created_at: stempel, updated_at: stempel, deleted_at: null,
  } }] },
})
pruefe(
  'A legt eine Liste an',
  liste.ok && liste.daten?.[0]?.kind === 'written',
  `HTTP ${liste.status}${liste.ok ? '' : ' ' + JSON.stringify(liste.daten).slice(0, 120)}`,
)
if (!liste.ok || liste.daten?.[0]?.kind !== 'written') process.exit(1)

const aufgabe = await rest('rpc/sync_push', {
  token: a.token,
  method: 'POST',
  body: { p_changes: [{ table: 'tasks', expected: null, row: {
    id: crypto.randomUUID(),
    list_id: listenId,
    title: 'Geheime Aufgabe',
    description: null, due_at: null,
    completed: false,
    completed_at: null, completed_expires_at: null, expired_at: null,
    reopen_context: null, recurrence: null, successor_id: null,
    position: 0,
    reminders: [], section_id: null,
    created_at: stempel, updated_at: stempel, deleted_at: null,
  } }] },
})
pruefe(
  'A legt eine Aufgabe an',
  aufgabe.ok && aufgabe.daten?.[0]?.kind === 'written',
  `HTTP ${aufgabe.status}${aufgabe.ok ? '' : ' ' + JSON.stringify(aufgabe.daten).slice(0, 120)}`,
)

const bVorher = await rest(`lists?id=eq.${listenId}`, { token: b.token })
pruefe('B sieht die ungeteilte Liste nicht', Array.isArray(bVorher.daten) && bVorher.daten.length === 0)

const bAufgabenVorher = await rest(`tasks?list_id=eq.${listenId}`, { token: b.token })
pruefe(
  'B sieht die Aufgaben der ungeteilten Liste nicht',
  Array.isArray(bAufgabenVorher.daten) && bAufgabenVorher.daten.length === 0,
)

const teilen = await rest('rpc/share_list_by_email', {
  token: a.token,
  method: 'POST',
  body: { p_list_id: listenId, p_email: konten.PRIO_TEST_B_EMAIL },
})
pruefe('A teilt die Liste über share_list_by_email', teilen.ok, `HTTP ${teilen.status}`)

const bNachher = await rest(`lists?id=eq.${listenId}`, { token: b.token })
pruefe(
  'B sieht die geteilte Liste',
  Array.isArray(bNachher.daten) && bNachher.daten.length === 1,
  `HTTP ${bNachher.status}`,
)

const bAufgabenNachher = await rest(`tasks?list_id=eq.${listenId}`, { token: b.token })
pruefe(
  'B sieht die Aufgaben der geteilten Liste',
  Array.isArray(bAufgabenNachher.daten) && bAufgabenNachher.daten.length === 1,
)

const bLoeschen = await rest(`lists?id=eq.${listenId}`, {
  token: b.token,
  method: 'PATCH',
  prefer: 'return=representation',
  body: { deleted_at: stempel },
})
pruefe(
  'Direktes App-Schreiben bleibt gesperrt',
  bLoeschen.status === 403,
  `HTTP ${bLoeschen.status}`,
)

const bLoeschenGeschuetzt = await rest('rpc/sync_push', {
  token: b.token,
  method: 'POST',
  body: { p_changes: [{ table: 'lists', expected: bNachher.daten[0],
    row: { ...bNachher.daten[0], deleted_at: stempel, updated_at: stempel },
  }] },
})
pruefe(
  'B kann die geteilte Liste auch über sync_push nicht löschen',
  bLoeschenGeschuetzt.ok && bLoeschenGeschuetzt.daten?.[0]?.kind === 'rejected',
  `HTTP ${bLoeschenGeschuetzt.status}`,
)

const bFremdeListe = await rest(`lists?id=eq.${'00000000-0000-0000-0000-000000000000'}`, { token: b.token })
pruefe(
  'B sieht eine fremde Liste nicht',
  Array.isArray(bFremdeListe.daten) && bFremdeListe.daten.length === 0,
)

// Aufräumen über die Datenbankverbindung – RLS gilt dort nicht.
const dbEnv = envDatei(join(homedir(), '.prio-android', 'db.env'), ['SUPABASE_DB_URL'])
if (dbEnv.SUPABASE_DB_URL) {
  execFileSync('psql', [
    '-X', '-v', 'ON_ERROR_STOP=1', '-d', dbEnv.SUPABASE_DB_URL, '-tAc',
    `delete from tasks where list_id = '${listenId}';
     delete from list_members where list_id = '${listenId}';
     delete from lists where id = '${listenId}';`,
  ])
  console.log('\n  ✓ Prüfdaten entfernt')
} else {
  console.log('\n  ! db.env fehlt – die Prüfliste bleibt im Projekt')
}

console.log(fehler === 0 ? '\nAlle Zugriffsregeln wie erwartet.' : `\n${fehler} Prüfung(en) fehlgeschlagen.`)
process.exit(fehler === 0 ? 0 : 1)
