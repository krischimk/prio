import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  AUFGABEN_FELDER,
  LISTEN_FELDER,
  MITGLIEDER_FELDER,
  NUR_LOKALE_FELDER,
} from '../../src/domain/fields'
import { toRemoteList, toRemoteMember, toRemoteTask } from '../../src/domain/mapping'
import { localList, localMember, localTask } from '../support/factories'

/**
 * Der Feldkatalog (unit).
 *
 * Ein neues Feld muss in mehreren Schichten ankommen: im lokalen Typ (dort
 * erzwungen `src/domain/fields.ts` die Vollständigkeit zur Übersetzungszeit), in
 * der Umwandlung zum Server **und** in einer Migration. Vergisst man die
 * Migration, scheitert jeder Abgleich mit `PGRST204`; vergisst man die
 * Umwandlung, kommt das Feld nie an. Beides fiel bisher erst beim
 * Bestandsnutzer auf.
 */
function migrationen(): string {
  const ordner = join(process.cwd(), 'supabase', 'migrations')
  return readdirSync(ordner)
    .filter((datei) => datei.endsWith('.sql'))
    .map((datei) => readFileSync(join(ordner, datei), 'utf8'))
    .join('\n')
}

describe('Feldkatalog', () => {
  it('wandelt genau die Felder um, die im Katalog stehen', () => {
    const liste = localList()
    const aufgabe = localTask()
    const mitglied = localMember()

    const listenFelder = Object.keys(toRemoteList(liste))
    const aufgabenFelder = Object.keys(toRemoteTask(aufgabe))
    const mitgliederFelder = Object.keys(toRemoteMember(mitglied))

    // Der Server kennt nur die Felder ohne `dirty`.
    const ohneLokales = (felder: readonly string[]) =>
      felder.filter((feld) => !NUR_LOKALE_FELDER.includes(feld as 'dirty'))

    expect([...listenFelder].sort()).toEqual([...ohneLokales(LISTEN_FELDER)].sort())
    expect([...aufgabenFelder].sort()).toEqual([...ohneLokales(AUFGABEN_FELDER)].sort())
    expect([...mitgliederFelder].sort()).toEqual([...ohneLokales(MITGLIEDER_FELDER)].sort())
  })

  it('findet jedes Feld in einer Migration wieder', () => {
    const sql = migrationen()
    const fehlend: string[] = []

    for (const [tabelle, felder] of [
      ['lists', LISTEN_FELDER],
      ['tasks', AUFGABEN_FELDER],
      ['list_members', MITGLIEDER_FELDER],
    ] as const) {
      for (const feld of felder) {
        if (NUR_LOKALE_FELDER.includes(feld as 'dirty')) continue
        // Grobe, aber wirksame Prüfung: Der Spaltenname kommt in den
        // Migrationen vor (in `create table` oder `alter table … add column`).
        if (!new RegExp(`\\b${feld}\\b`).test(sql)) {
          fehlend.push(`${tabelle}.${feld}`)
        }
      }
    }

    expect(fehlend).toEqual([])
  })

  it('prüft auch die Erwartung des Prüfskripts gegen den Katalog', () => {
    const skript = readFileSync(join(process.cwd(), 'scripts', 'db-apply.mjs'), 'utf8')
    const bloecke = [...skript.matchAll(/\['(lists|tasks|list_members)',\s*'([a-z_]+)',\s*'(\d{4})'\]/g)]

    expect(bloecke.length).toBeGreaterThan(0)
    for (const [, tabelle, spalte] of bloecke) {
      const felder: readonly string[] =
        tabelle === 'lists' ? LISTEN_FELDER : tabelle === 'tasks' ? AUFGABEN_FELDER : MITGLIEDER_FELDER
      expect(felder, `${tabelle}.${spalte} steht nicht im Feldkatalog`).toContain(spalte)
    }
  })
})
