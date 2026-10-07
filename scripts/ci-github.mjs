#!/usr/bin/env node
/**
 * GitHub-Läufe ansehen, Logs lesen, gescheiterte Läufe neu starten.
 *
 * Warum es das gibt: Von einem roten Lauf war bisher nur bekannt, **dass** er
 * rot ist. Das Job-Log liegt bei GitHub hinter „Must have admin rights" - ohne
 * Zugangsschlüssel nicht abrufbar, der Playwright-Bericht als Artefakt ebenso.
 * Übrig blieb „Process completed with exit code 1", und die Ursache musste
 * lokal nachgestellt werden.
 *
 * Der Schlüssel ist **nur lesend** und liegt wie die übrigen privaten Daten in
 * `~/.prio-android/github.env` (oder als `GITHUB_TOKEN` in der Umgebung).
 * Ohne ihn funktionieren `status` und die Prüf-Vermerke weiterhin, `log` und
 * `rerun` sagen, was fehlt.
 *
 *   node scripts/ci-github.mjs status [--sha <sha>]
 *   node scripts/ci-github.mjs log [--sha <sha>]      # Logs + Prüf-Vermerke
 *   node scripts/ci-github.mjs rerun [--sha <sha>]    # gescheiterte Jobs neu
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const API = 'https://api.github.com'
const SCHLUESSEL_DATEI = join(homedir(), '.prio-android', 'github.env')
const LOG_DATEI = 'test-results/ci-log.txt'

function repoSlug() {
  try {
    const url = execFileSync('git', ['config', '--get', 'remote.origin.url'], {
      encoding: 'utf8',
    }).trim()
    const treffer = /github\.com[:/]([^/]+\/[^/.]+)/.exec(url)
    if (treffer) return treffer[1]
  } catch {
    // Kein Remote – dann der bekannte Name.
  }
  return 'krischimk/prio'
}

/** Der Schlüssel, wenn vorhanden. Nur lesend gedacht. */
function token() {
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN.trim()
  if (process.env.GH_TOKEN) return process.env.GH_TOKEN.trim()
  try {
    const inhalt = readFileSync(SCHLUESSEL_DATEI, 'utf8')
    for (const zeile of inhalt.split('\n')) {
      const treffer = /^(?:GITHUB_TOKEN|GH_TOKEN)\s*=\s*(.+)$/.exec(zeile.trim())
      if (treffer) return treffer[1].trim().replace(/^["']|["']$/g, '')
    }
  } catch {
    // Keine Datei – das ist der Normalfall, solange der Schlüssel fehlt.
  }
  return null
}

const FEHLT = `
Kein Zugangsschlüssel gefunden. Einmalig anlegen (dauert eine Minute):

  1. https://github.com/settings/personal-access-tokens/new
  2. Token name:  prio-ci (oder ähnlich)
  3. Expiration:  nach Wahl, z. B. 1 Jahr
  4. Repository access: Only select repositories -> krischimk/prio
  5. Permissions -> Repository permissions:
       Actions     : Read-only   (Logs lesen, Läufe neu starten)
       Metadata    : Read-only   (wird automatisch mitgesetzt)
  6. Generate token, kopieren, dann:

       mkdir -p ~/.prio-android
       printf 'GITHUB_TOKEN=%s\\n' '<der-schlüssel>' > ~/.prio-android/github.env
       chmod 600 ~/.prio-android/github.env

Der Schlüssel ist ausschließlich lesend und liegt damit wie die übrigen
privaten Daten außerhalb des Repositories.
`

async function hole(pfad, optionen = {}) {
  const kopf = {
    accept: 'application/vnd.github+json',
    'user-agent': 'prio-ci-skript',
    ...(optionen.headers ?? {}),
  }
  const schluessel = token()
  if (schluessel) kopf.authorization = `Bearer ${schluessel}`
  const antwort = await fetch(`${API}${pfad}`, { ...optionen, headers: kopf })
  return antwort
}

function shaAusArgumenten() {
  const index = process.argv.indexOf('--sha')
  if (index > -1 && process.argv[index + 1]) return process.argv[index + 1]
  return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
}

async function letzterLauf(sha) {
  const antwort = await hole(`/repos/${repoSlug()}/actions/runs?head_sha=${sha}&per_page=5`)
  const daten = await antwort.json()
  const lauf = (daten.workflow_runs ?? [])[0]
  if (!lauf) {
    console.error(`Kein Lauf für ${sha.slice(0, 7)} gefunden.`)
    process.exit(1)
  }
  return lauf
}

async function jobsVon(laufId) {
  const antwort = await hole(`/repos/${repoSlug()}/actions/runs/${laufId}/jobs`)
  const daten = await antwort.json()
  return daten.jobs ?? []
}

async function status() {
  const sha = shaAusArgumenten()
  const lauf = await letzterLauf(sha)
  console.log(`Lauf ${lauf.id} (${lauf.name}) für ${sha.slice(0, 7)}: ${lauf.status}/${lauf.conclusion ?? '-'}`)
  console.log(`  ${lauf.html_url}`)
  for (const job of await jobsVon(lauf.id)) {
    console.log(`  ${job.conclusion === 'success' ? '✓' : job.conclusion === 'skipped' ? '·' : '✗'} ${job.name}: ${job.conclusion ?? job.status}`)
  }
  return lauf
}

async function vermerke(lauf) {
  const antwort = await hole(`/repos/${repoSlug()}/commits/${lauf.head_sha}/check-runs`)
  const daten = await antwort.json()
  for (const check of daten.check_runs ?? []) {
    if (check.conclusion !== 'failure') continue
    const a = await hole(`/repos/${repoSlug()}/check-runs/${check.id}/annotations`)
    const liste = await a.json()
    if (Array.isArray(liste) && liste.length > 0) {
      console.log(`\n--- Prüf-Vermerke: ${check.name} ---`)
      for (const eintrag of liste) {
        console.log(`  ${eintrag.path ?? ''}${eintrag.start_line ? ':' + eintrag.start_line : ''} ${eintrag.title ?? ''}`)
        if (eintrag.message) console.log(`    ${eintrag.message}`)
      }
    }
  }
}

async function log() {
  const lauf = await status()
  const schluessel = token()
  const gescheitert = (await jobsVon(lauf.id)).filter((job) => job.conclusion === 'failure')
  if (gescheitert.length === 0) {
    console.log('\nKein gescheiterter Job – nichts zu lesen.')
    return
  }
  if (!schluessel) {
    await vermerke(lauf)
    console.error(FEHLT)
    process.exit(1)
  }

  const teile = []
  for (const job of gescheitert) {
    const antwort = await hole(`/repos/${repoSlug()}/actions/jobs/${job.id}/logs`, { redirect: 'follow' })
    if (!antwort.ok) {
      teile.push(`### ${job.name}: Log nicht abrufbar (${antwort.status})`)
      continue
    }
    teile.push(`### ${job.name}\n\n${await antwort.text()}`)
  }
  mkdirSync('test-results', { recursive: true })
  writeFileSync(LOG_DATEI, teile.join('\n\n'))
  console.log(`\nVollständiges Log: ${LOG_DATEI}`)
  for (const teil of teile) {
    const zeilen = teil.split('\n')
    console.log('\n' + zeilen.slice(0, 3).join('\n'))
    console.log(`… ${zeilen.length} Zeilen, hier die letzten 60:`)
    console.log(zeilen.slice(-60).join('\n'))
  }
  await vermerke(lauf)
}

async function rerun() {
  const schluessel = token()
  if (!schluessel) {
    console.error(FEHLT)
    process.exit(1)
  }
  const lauf = await letzterLauf(shaAusArgumenten())
  const antwort = await hole(`/repos/${repoSlug()}/actions/runs/${lauf.id}/rerun-failed-jobs`, {
    method: 'POST',
  })
  if (antwort.status === 201) {
    console.log(`Neu gestartet: ${lauf.html_url}`)
    return
  }
  console.error(`Neustart fehlgeschlagen (${antwort.status}): ${await antwort.text()}`)
  process.exit(1)
}

const befehl = process.argv[2] ?? 'status'
if (befehl === 'status') await status()
else if (befehl === 'log') await log()
else if (befehl === 'rerun') await rerun()
else {
  console.error('Aufruf: node scripts/ci-github.mjs [status|log|rerun] [--sha <sha>]')
  process.exit(1)
}
