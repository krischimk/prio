import { isNewerVersion } from './version'

/**
 * Prüfung auf eine neue Version.
 *
 * Die App fragt die Veröffentlichungen des eigenen Repositories ab. Das ist
 * bewusst die einzige Stelle, die mit GitHub spricht – die Zerlegung der Antwort
 * ist eine reine Funktion und damit ohne Netzwerk prüfbar.
 */

/** Repository, aus dem die Update-Informationen kommen. */
export const RELEASE_REPO = 'krischimk/prio'

const RELEASE_URL = `https://api.github.com/repos/${RELEASE_REPO}/releases/latest`

export interface ReleaseInfo {
  /** Version ohne führendes `v`, z. B. `0.5.0`. */
  version: string
  /** Direkter Verweis auf die APK. */
  apkUrl: string
  /** Dateiname beim Herunterladen. */
  fileName: string
  /** Größe in Bytes, `0` wenn unbekannt. */
  sizeBytes: number
  /** Anmerkungen zur Veröffentlichung, unverändert. */
  notes: string
}

interface GithubAsset {
  name?: unknown
  browser_download_url?: unknown
  size?: unknown
}

/**
 * Zerlegt die Antwort der GitHub-Schnittstelle.
 *
 * Liefert `null`, wenn keine APK dabei ist – dann gibt es nichts anzubieten.
 */
export function parseRelease(payload: unknown): ReleaseInfo | null {
  if (typeof payload !== 'object' || payload === null) return null
  const daten = payload as { tag_name?: unknown; body?: unknown; assets?: unknown }

  const tag = typeof daten.tag_name === 'string' ? daten.tag_name.trim() : ''
  if (tag === '') return null

  const assets = Array.isArray(daten.assets) ? (daten.assets as GithubAsset[]) : []
  const apk = assets.find(
    (asset) =>
      typeof asset?.name === 'string' &&
      asset.name.toLowerCase().endsWith('.apk') &&
      typeof asset.browser_download_url === 'string',
  )
  if (!apk) return null

  return {
    version: tag.replace(/^v/i, ''),
    apkUrl: apk.browser_download_url as string,
    fileName: apk.name as string,
    sizeBytes: typeof apk.size === 'number' ? apk.size : 0,
    notes: typeof daten.body === 'string' ? daten.body : '',
  }
}

/**
 * Sagt, was schiefging – in Worten statt in einem Statuscode.
 *
 * Der häufigste Fehler ist keine Störung, sondern eine Grenze: GitHub erlaubt
 * **60 Abfragen pro Stunde und IP** ohne Anmeldung. Adresse, Emulator, die
 * Web-Fassung und jedes Skript auf demselben Anschluss teilen sich diese Zahl;
 * die App selbst braucht eine Abfrage je Start. Ein „403" sagt davon nichts.
 */
export function describeFailure(antwort: Response): string {
  if (antwort.status === 403 || antwort.status === 429) {
    const reset = antwort.headers.get('x-ratelimit-reset')
    const sekunden = reset === null ? null : Number(reset) - Math.floor(Date.now() / 1000)
    if (sekunden !== null && Number.isFinite(sekunden) && sekunden > 0) {
      const minuten = Math.max(1, Math.ceil(sekunden / 60))
      return `GitHub begrenzt gerade die Abfragen (60 je Stunde). In etwa ${minuten} Minuten wieder möglich.`
    }
    return 'GitHub begrenzt gerade die Abfragen (60 je Stunde). Bitte später erneut versuchen.'
  }
  if (antwort.status === 404) {
    return 'Keine Veröffentlichung gefunden. Ist das Repository öffentlich?'
  }
  return `Abfrage fehlgeschlagen (${antwort.status}).`
}

/**
 * Ergebnis der Prüfung.
 *
 * Dieselbe Form wie der Zustand in der Oberfläche (`UpdateState`), damit das
 * Ergebnis ohne Umformung übernommen werden kann.
 */
export type UpdateCheckResult =
  | { status: 'up-to-date'; current: string; latest: string }
  | { status: 'available'; current: string; release: ReleaseInfo }
  | { status: 'failed'; message: string }

/**
 * Fragt die neueste Veröffentlichung ab und vergleicht sie mit der laufenden
 * Version.
 *
 * `fetchImpl` ist austauschbar, damit die Prüfung ohne Netzwerk getestet werden
 * kann.
 */
export async function checkForUpdate(
  currentVersion: string,
  fetchImpl: typeof fetch = fetch,
): Promise<UpdateCheckResult> {
  try {
    const antwort = await fetchImpl(RELEASE_URL, {
      headers: { accept: 'application/vnd.github+json' },
    })
    if (!antwort.ok) {
      return { status: 'failed', message: describeFailure(antwort) }
    }

    const release = parseRelease(await antwort.json())
    if (!release) {
      return { status: 'failed', message: 'Die Veröffentlichung enthält keine APK.' }
    }

    return isNewerVersion(release.version, currentVersion)
      ? { status: 'available', current: currentVersion, release }
      : { status: 'up-to-date', current: currentVersion, latest: release.version }
  } catch (error) {
    // „Failed to fetch" ist die Meldung des Browsers für „kein Netz" – im
    // App-Kontext sagt das niemandem etwas.
    const roh = error instanceof Error ? error.message : ''
    const ohneNetz = error instanceof TypeError || /failed to fetch|networkerror|load failed/i.test(roh)
    return {
      status: 'failed',
      message: ohneNetz
        ? 'GitHub ist gerade nicht erreichbar. Besteht eine Verbindung?'
        : roh || 'Unbekannter Fehler bei der Abfrage.',
    }
  }
}
