/**
 * Fügt die Migrationsdateien zu einer einzigen SQL-Datei zusammen.
 *
 * Warum: Im SQL-Editor von Supabase ist es deutlich weniger fehleranfällig,
 * den Inhalt EINER Datei einzufügen, als drei Dateien nacheinander von Hand
 * auszuwählen. Die Reihenfolge bleibt dabei erhalten.
 *
 * Die erzeugte Datei ist ein reines Hilfsmittel und wird nicht versioniert
 * (siehe .gitignore) – verbindliche Quelle sind ausschließlich die Dateien in
 * `supabase/migrations/`.
 *
 * Aufruf: npm run db:sql
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const MIGRATIONS_DIR = join(ROOT, 'supabase', 'migrations')
const OUTPUT = join(ROOT, 'supabase', 'all-migrations.sql')

const FILES = ['0001_schema.sql', '0002_rls.sql', '0003_share_list.sql']

const rule = (char = '=') => `-- ${char.repeat(75)}`

const parts = [
  rule(),
  '-- prio – komplette Datenbank-Einrichtung in EINER Datei',
  rule(),
  '-- ERLÄUTERUNG',
  '--   Diese Datei ist eine zusammengefügte Kopie der drei Migrationsdateien',
  '--   aus supabase/migrations/ – in der richtigen Reihenfolge:',
  '--     1. Schema (Tabellen, Indizes, Trigger)',
  '--     2. Row Level Security (Zugriffsregeln, Tabellenrechte)',
  '--     3. Teilen einer Liste per E-Mail-Adresse',
  '--',
  '-- VERWENDUNG',
  '--   Im Supabase-Dashboard: SQL Editor → New query → diesen kompletten',
  '--   Inhalt einfügen → Run. Es genügt ein einziger Durchlauf.',
  '--',
  '--   Die Datei ist mehrfach ausführbar; ein zweiter Durchlauf schadet nicht.',
  '--',
  '--   Neu erzeugen mit: npm run db:sql',
  rule(),
  '',
]

for (const file of FILES) {
  const content = readFileSync(join(MIGRATIONS_DIR, file), 'utf8')
  parts.push(
    '-- ###########################################################################',
    `-- # Quelle: supabase/migrations/${file}`,
    '-- ###########################################################################',
    '',
    content.trimEnd(),
    '',
  )
}

writeFileSync(OUTPUT, parts.join('\n'), 'utf8')
console.log(`geschrieben: ${OUTPUT}`)
