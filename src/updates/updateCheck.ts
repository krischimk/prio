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
      return { status: 'failed', message: `Abfrage fehlgeschlagen (${antwort.status}).` }
    }

    const release = parseRelease(await antwort.json())
    if (!release) {
      return { status: 'failed', message: 'Die Veröffentlichung enthält keine APK.' }
    }

    return isNewerVersion(release.version, currentVersion)
      ? { status: 'available', current: currentVersion, release }
      : { status: 'up-to-date', current: currentVersion, latest: release.version }
  } catch (error) {
    return {
      status: 'failed',
      message: error instanceof Error ? error.message : 'Unbekannter Fehler bei der Abfrage.',
    }
  }
}
