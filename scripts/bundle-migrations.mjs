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
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const MIGRATIONS_DIR = join(ROOT, 'supabase', 'migrations')
const OUTPUT = join(ROOT, 'supabase', 'all-migrations.sql')

// Alle Migrationen in Reihenfolge des Dateinamens – so muss beim Ergänzen
// einer neuen Datei nichts nachgetragen werden.
const FILES = readdirSync(MIGRATIONS_DIR)
  .filter((name) => name.endsWith('.sql'))
  .sort()

const rule = (char = '=') => `-- ${char.repeat(75)}`

const parts = [
  rule(),
  '-- prio – komplette Datenbank-Einrichtung in EINER Datei',
  rule(),
  '-- ERLÄUTERUNG',
  '--   Diese Datei ist eine zusammengefügte Kopie aller Migrationsdateien aus',
  '--   supabase/migrations/ – in der richtigen Reihenfolge:',
  '--     1. Schema (Tabellen, Indizes, Trigger)',
  '--     2. Row Level Security (Zugriffsregeln, Tabellenrechte)',
  '--     3. Teilen einer Liste per E-Mail-Adresse',
  '--     4. Hilfsfunktionen in ein privates Schema (Security Advisor)',
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
