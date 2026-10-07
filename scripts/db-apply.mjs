#!/usr/bin/env node
/**
 * Spielt die Migrationen über `psql` ein – oder sieht nur nach, was in der
 * Datenbank steht.
 *
 * Warum nicht die Supabase CLI: Sie merkt sich nur die *Versionsnummern* der
 * eingespielten Dateien, nicht ihren Inhalt. Eine nachträglich geänderte
 * Migration wird beim nächsten `db push` stillschweigend übersprungen – man
 * hält die Änderung für eingespielt, und sie ist es nie (siehe README).
 *
 * Diese Datei schickt stattdessen **immer die vollständige Sammeldatei**, genau
 * wie es der SQL-Editor tut. Die Regel aus AGENTS.md – jede Migration ist
 * wiederholbar, ein zweiter Lauf ändert nichts – bleibt damit unangetastet; es
 * entfällt nur das Kopieren.
 *
 * Einmalig nötig:
 *   1. `sudo apt install postgresql-client`
 *   2. `supabase/.env.local` mit
 *      `SUPABASE_DB_URL=postgresql://…` (Verknüpfung nach
 *      `~/.prio-android/db.env`, siehe `scripts/setup_private_data.py`)
 *
 * Gebraucht wird die **Datenbank-Verbindung** mit ihrem eigenen Passwort – nicht
 * der Secret Key der API. Der gehört weiterhin nirgends hin.
 *
 * Aufruf:
 *   npm run db:apply     Sammeldatei erzeugen und einspielen
 *   npm run db:check     rein lesend den Ist-Stand zeigen
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const ENV_FILE = join(ROOT, 'supabase', '.env.local')
const BUNDLE = join(ROOT, 'supabase', 'all-migrations.sql')
const VARIABLE = 'SUPABASE_DB_URL'

const checkOnly = process.argv.includes('--check')

/** Kleiner Leser für `KEY=WERT`-Zeilen; Kommentare und Anführungszeichen genügen. */
function readEnvValue(path, key) {
  for (const rawLine of readFileSync(path, 'utf8').split('\n')) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const match = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line)
    if (!match || match[1] !== key) continue
    return match[2].trim().replace(/^(['"])(.*)\1$/, '$2')
  }
  return undefined
}

function fail(message) {
  console.error(`\n${message}\n`)
  process.exit(1)
}

// --- psql vorhanden? -------------------------------------------------------
if (spawnSync('psql', ['--version'], { stdio: 'ignore' }).error) {
  fail(
    'psql wurde nicht gefunden. Einmalig installieren:\n\n' +
      '    sudo apt install postgresql-client\n',
  )
}

// --- Zugang vorhanden? -----------------------------------------------------
// Zuerst die Umgebungsvariable: Im CI gibt es keine private Ablage, dort kommt
// die Verbindung aus einem Repository-Secret. Lokal bleibt die Datei der Weg.
const ausUmgebung = process.env[VARIABLE]?.trim()
if (ausUmgebung) {
  console.log(`${VARIABLE} aus der Umgebung verwendet.`)
}

if (!ausUmgebung && !existsSync(ENV_FILE)) {
  fail(
    `Es fehlt ${ENV_FILE}.\n\n` +
      'Dort steht die Datenbank-Verbindung, nicht der API-Schlüssel:\n\n' +
      `    ${VARIABLE}=postgresql://postgres.<projekt-ref>:<passwort>@db.<projekt-ref>.supabase.co:5432/postgres?sslmode=require\n\n` +
      'Die Verbindung steht im Supabase-Dashboard unter „Connect“ → „Direct\n' +
      'connection“ (der Server hier erreicht sie über IPv6). Die Datei gehört in\n' +
      'die private Ablage, nicht ins Repository:\n\n' +
      '    ~/.prio-android/db.env\n' +
      '    python3 scripts/setup_private_data.py\n',
  )
}

const dbUrl = ausUmgebung || readEnvValue(ENV_FILE, VARIABLE)
if (!dbUrl) {
  fail(`${ENV_FILE} enthält kein ${VARIABLE}.`)
}
if (!/^postgres(ql)?:\/\//.test(dbUrl)) {
  fail(`${VARIABLE} beginnt nicht mit postgresql:// – das sieht nicht nach einer Verbindung aus.`)
}

// Ziel nennen, damit ein Fehlgriff sofort auffällt. Das Passwort wird nie
// ausgegeben, der Host ist ohnehin öffentlich (er steckt in jeder APK).
const { hostname } = new URL(dbUrl)
console.log(`Ziel: ${hostname}`)

// --- Ausführen -------------------------------------------------------------
// `-X` übergeht eine lokale ~/.psqlrc: Ein Migrationslauf soll nicht davon
// abhängen, was auf dem Rechner konfiguriert ist.
// `ON_ERROR_STOP=1` bricht beim ersten Fehler ab, statt weiterzulaufen.
// Kein `--single-transaction`: Jede Migration bringt ihr eigenes begin/commit mit.
const base = ['-X', '-v', 'ON_ERROR_STOP=1', '-d', dbUrl]

/**
 * Spalten, die der Code sendet.
 *
 * Fehlt eine davon, scheitert **jeder** Sync mit `PGRST204` – genau das ist
 * passiert, als `lists.sections` geschrieben, aber Migration 0013 nie
 * eingespielt wurde. Deshalb prüft `db:check` nicht nur, was da ist, sondern
 * auch, was fehlt: Die Liste gehört gepflegt, wenn eine Spalte dazukommt.
 *
 * Die Nummer ist die Migration, die die Spalte **anlegt** – sie steht in der
 * Fehlermeldung, damit man weiß, was fehlt. Zwei Einträge zeigten hier auf die
 * falsche Datei (`position` → 0009, `icon` → 0007); `tests/unit/dbExpectations
 * .test.ts` prüft jetzt nach, dass die genannte Migration Tabelle und Spalte
 * wirklich nennt.
 */
const ERWARTET = [
  ['lists', 'sections', '0013'],
  ['tasks', 'section_id', '0013'],
  ['tasks', 'reminders', '0011'],
  ['tasks', 'position', '0005'],
  ['lists', 'icon', '0008'],
]

if (checkOnly) {
  // Rein lesend: Spalten und RLS-Zustand, dazu die Erwartung von oben.
  const result = spawnSync(
    'psql',
    [
      ...base,
      '-c',
      `select table_name as tabelle, ordinal_position as nr, column_name, data_type
         from information_schema.columns
        where table_schema = 'public' and table_name in ('lists', 'tasks')
        order by table_name, ordinal_position`,
      '-c',
      `select relname as tabelle, relrowsecurity as rls
         from pg_class
        where relname in ('profiles', 'lists', 'list_members', 'tasks')
        order by relname`,
      '-c',
      `select e.tabelle, e.spalte,
              case when c.column_name is null then 'FEHLT (Migration ' || e.migration || '?)'
                   else 'da' end as zustand
         from (values ${ERWARTET.map(([t2, s, m]) => `('${t2}', '${s}', '${m}')`).join(', ')}) as e(tabelle, spalte, migration)
         left join information_schema.columns c
                on c.table_schema = 'public' and c.table_name = e.tabelle and c.column_name = e.spalte
        order by e.tabelle, e.spalte`,
    ],
    { stdio: 'inherit' },
  )

  // Der Exit-Code darf nicht am hübschen Druck hängen: Fehlende Spalten sind
  // ein Fehler, nicht eine Information.
  const fehlend = spawnSync(
    'psql',
    [
      ...base,
      '-tAc',
      `select count(*) from (values ${ERWARTET.map(([t2, s]) => `('${t2}', '${s}')`).join(', ')}) as e(tabelle, spalte)
        where not exists (
          select 1 from information_schema.columns c
           where c.table_schema = 'public' and c.table_name = e.tabelle and c.column_name = e.spalte)`,
    ],
    { encoding: 'utf8' },
  )
  const anzahl = Number((fehlend.stdout ?? '').trim())
  if (anzahl > 0) {
    console.error(
      `\n${anzahl} erwartete Spalte(n) fehlen. Einspielen: npm run db:apply\n`,
    )
  } else {
    console.log('\nAlle erwarteten Spalten sind da.')
  }
  process.exit((result.status ?? 0) !== 0 || anzahl > 0 ? 1 : 0)
}

if (!existsSync(BUNDLE)) {
  fail(`Es fehlt ${BUNDLE}. Erst erzeugen:\n\n    npm run db:sql\n`)
}

console.log(`Spiele ein: ${BUNDLE}`)
const result = spawnSync('psql', [...base, '-f', BUNDLE], { stdio: 'inherit' })
if (result.status !== 0) {
  fail('psql hat mit einem Fehler abgebrochen – es wurde nichts weiter ausgeführt.')
}
console.log('\nMigrationen sind eingespielt.')
