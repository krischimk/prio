import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Die Erwartungsliste in `scripts/db-apply.mjs` muss auf die Migration zeigen,
 * die die Spalte **anlegt**.
 *
 * Anlass: Zwei Einträge taten das nicht. `tasks.position` verwies auf 0009
 * (dort geht es um Wiederholungen), `lists.icon` auf 0007 (dort um das
 * Verlassen einer Liste). Die Fehlermeldung von `npm run db:check` schickte den
 * Leser damit in die falsche Datei – und wer eine Spalte sucht, sucht lange.
 *
 * Geprüft wird deshalb nicht die Zahl, sondern die Wirkung: Nennt die genannte
 * Migration die Tabelle, und fügt sie die Spalte hinzu? Eine reine Zahlenliste
 * ohne Prüfung ist ein Wunsch (`AGENTS.md`).
 *
 * Vitest läuft mit dem Projektverzeichnis als Arbeitsverzeichnis.
 */
const PROJECT_ROOT = process.cwd()
const MIGRATIONS = join(PROJECT_ROOT, 'supabase', 'migrations')

interface Erwartung {
  tabelle: string
  spalte: string
  migration: string
}

function erwartungen(): Erwartung[] {
  const quelle = readFileSync(join(PROJECT_ROOT, 'scripts', 'db-apply.mjs'), 'utf8')
  const block = /const ERWARTET = \[([\s\S]*?)\n\]/.exec(quelle)
  if (!block) {
    throw new Error('ERWARTET nicht gefunden – hat sich scripts/db-apply.mjs geändert?')
  }
  return [...block[1].matchAll(/\['(\w+)',\s*'(\w+)',\s*'(\d{4})'\]/g)].map((treffer) => ({
    tabelle: treffer[1],
    spalte: treffer[2],
    migration: treffer[3],
  }))
}

function migrationsDatei(nummer: string): string {
  const treffer = readdirSync(MIGRATIONS).filter((name) => name.startsWith(`${nummer}_`))
  if (treffer.length !== 1) {
    throw new Error(`Migration ${nummer} ist nicht eindeutig: ${treffer.join(', ') || '(keine)'}`)
  }
  return join(MIGRATIONS, treffer[0])
}

describe('Erwartete Spalten in db:check', () => {
  it('findet die Erwartungsliste', () => {
    // Schützt den Test davor, bei einer geänderten Schreibweise stillschweigend
    // nichts zu prüfen.
    expect(erwartungen().length).toBeGreaterThan(3)
  })

  it.each(erwartungen().map((eintrag) => [`${eintrag.tabelle}.${eintrag.spalte}`, eintrag] as const))(
    'nennt für %s die Migration, die die Spalte anlegt',
    (_name, erwartung) => {
      const sql = readFileSync(migrationsDatei(erwartung.migration), 'utf8')
      expect(
        new RegExp(`\\b${erwartung.tabelle}\\b`, 'i').test(sql),
        `${erwartung.migration} nennt die Tabelle ${erwartung.tabelle} nicht`,
      ).toBe(true)
      const tableBody = new RegExp(`create table(?: if not exists)? public\\.${erwartung.tabelle}\\s*\\(([\\s\\S]*?)\\n\\);`, 'i').exec(sql)?.[1] ?? ''
      expect(
        new RegExp(`add column(?: if not exists)?\\s+"?${erwartung.spalte}"?\\b`, 'i').test(sql)
          || new RegExp(`^\\s*${erwartung.spalte}\\s+\\w+`, 'm').test(tableBody),
        `${erwartung.migration} legt die Spalte ${erwartung.spalte} nicht an`,
      ).toBe(true)
    },
  )
})
