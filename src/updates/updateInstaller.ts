import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core'

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
  addListener(
    eventName: 'downloadFailed' | 'installerOpened',
    listener: (event: { message?: string }) => void,
  ): Promise<PluginListenerHandle>
}

const Updater = registerPlugin<UpdaterNative>('Updater')

export interface UpdateInstaller {
  /** Kann eine APK direkt installiert werden? Nur in der App. */
  readonly canInstall: boolean
  /** Lädt die APK und öffnet den Installationsdialog des Systems. */
  install(apkUrl: string, fileName: string): Promise<void>
  /**
   * Meldet, wenn der Download **nicht** geklappt hat.
   *
   * Nötig, weil `install` nur bestätigt, dass der Download angestoßen wurde –
   * das Ergebnis kennt der System-Downloader erst später. Ohne diese Meldung
   * bliebe ein Fehlschlag unbemerkt.
   *
   * Gibt eine Funktion zum Abmelden zurück.
   */
  onDownloadFailed(listener: (message: string) => void): () => void
}

export function createUpdateInstaller(): UpdateInstaller {
  if (Capacitor.isNativePlatform()) {
    return {
      canInstall: true,
      install: async (apkUrl, fileName) => {
        await Updater.downloadAndInstall({ url: apkUrl, fileName })
      },
      onDownloadFailed: (listener) => {
        let abmelden: (() => void) | null = null
        void Updater.addListener('downloadFailed', (event) => {
          listener(event.message ?? 'Der Download ist fehlgeschlagen.')
        }).then((handle) => {
          abmelden = () => {
            void handle.remove()
          }
        })
        return () => abmelden?.()
      },
    }
  }

  return {
    canInstall: false,
    install: async (apkUrl) => {
      window.open(apkUrl, '_blank', 'noopener')
    },
    // Im Browser gibt es nichts zu melden – der Download läuft dort sichtbar
    // im Browserfenster.
    onDownloadFailed: () => () => {},
  }
}
