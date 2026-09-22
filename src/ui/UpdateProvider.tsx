import { Capacitor } from '@capacitor/core'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { currentVersion } from '../updates/currentVersion'
import { checkForUpdate } from '../updates/updateCheck'
import { createUpdateInstaller } from '../updates/updateInstaller'
import { UpdateContext, type UpdateContextValue, type UpdateState } from './updateContext'

/**
 * Sucht nach einer neuen Fassung und stößt das Installieren an.
 *
 * Automatisch gesucht wird nur in der App: Dort gibt es etwas zu installieren.
 * In der Web-Oberfläche bleibt die Prüfung ein Knopf, der bei Bedarf zeigt, was
 * veröffentlicht ist.
 *
 * Bewusst *keine* Benachrichtigung im System: Ohne Hintergrunddienst kann die
 * App nicht prüfen, während sie geschlossen ist. Ein Hinweis beim Öffnen ist
 * ehrlicher als eine Meldung, die nie kommen kann.
 */
export function UpdateProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<UpdateState>({ status: 'idle' })
  const [installing, setInstalling] = useState(false)
  const [installError, setInstallError] = useState<string | null>(null)
  const installer = useMemo(() => createUpdateInstaller(), [])
  const laeuft = useRef(false)

  const check = useCallback(async () => {
    if (laeuft.current) return
    laeuft.current = true
    setState({ status: 'checking' })
    try {
      setState(await checkForUpdate(await currentVersion()))
    } finally {
      laeuft.current = false
    }
  }, [])

  useEffect(() => {
    if (Capacitor.isNativePlatform()) void check()
  }, [check])

  // Der System-Downloader meldet das Ergebnis später – ein Fehlschlag darf
  // nicht unbemerkt bleiben.
  useEffect(
    () =>
      installer.onDownloadFailed((message) => {
        setInstalling(false)
        setInstallError(message)
      }),
    [installer],
  )

  const install = useCallback(async () => {
    if (state.status !== 'available') return
    setInstalling(true)
    setInstallError(null)
    try {
      await installer.install(state.release.apkUrl, state.release.fileName)
    } catch (error) {
      setInstallError(
        error instanceof Error ? error.message : 'Das Installieren konnte nicht gestartet werden.',
      )
    } finally {
      setInstalling(false)
    }
  }, [installer, state])

  const value = useMemo<UpdateContextValue>(
    () => ({ state, check, install, installing, installError, canInstall: installer.canInstall }),
    [state, check, install, installing, installError, installer.canInstall],
  )

  return <UpdateContext.Provider value={value}>{children}</UpdateContext.Provider>
}
