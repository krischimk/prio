import { Capacitor, registerPlugin } from '@capacitor/core'

/**
 * Zugriff auf das Installieren einer neuen Fassung – hinter einem Interface,
 * wie die übrigen Systemzugriffe auch.
 *
 * Das eigentliche Laden erledigt der System-Downloader (siehe
 * `UpdaterPlugin.java`). Im Browser gibt es das nicht; dort bleibt nur der
 * gewöhnliche Download.
 */

interface UpdaterNative {
  downloadAndInstall(options: { url: string; fileName: string }): Promise<{ downloadId: number }>
}

const Updater = registerPlugin<UpdaterNative>('Updater')

export interface UpdateInstaller {
  /** Kann eine APK direkt installiert werden? Nur in der App. */
  readonly canInstall: boolean
  /** Lädt die APK und öffnet den Installationsdialog des Systems. */
  install(apkUrl: string, fileName: string): Promise<void>
}

export function createUpdateInstaller(): UpdateInstaller {
  if (Capacitor.isNativePlatform()) {
    return {
      canInstall: true,
      install: async (apkUrl, fileName) => {
        await Updater.downloadAndInstall({ url: apkUrl, fileName })
      },
    }
  }

  return {
    canInstall: false,
    install: async (apkUrl) => {
      window.open(apkUrl, '_blank', 'noopener')
    },
  }
}
