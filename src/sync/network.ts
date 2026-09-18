/**
 * Netzwerkzustand.
 *
 * Version 0.1 nutzt `navigator.onLine` und die Browser-Events `online`/`offline`.
 * Das ist bewusst schlicht und funktioniert auch in einem Capacitor-WebView.
 * Für Android ist später `@capacitor/network` der genauere Ersatz – dafür muss
 * nur diese Datei ausgetauscht werden.
 *
 * Achtung: `navigator.onLine === true` bedeutet nur "es gibt ein Netzwerk",
 * nicht "Supabase ist erreichbar". Der Sync behandelt deshalb zusätzlich jeden
 * fehlgeschlagenen Netzwerkzugriff als offline.
 */
export interface NetworkMonitor {
  isOnline(): boolean
  subscribe(listener: (online: boolean) => void): () => void
}

export function createBrowserNetworkMonitor(): NetworkMonitor {
  const listeners = new Set<(online: boolean) => void>()

  const emit = (online: boolean) => {
    for (const listener of listeners) listener(online)
  }
  const handleOnline = () => emit(true)
  const handleOffline = () => emit(false)

  const supported = typeof window !== 'undefined' && typeof window.addEventListener === 'function'
  if (supported) {
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
  }

  return {
    isOnline: () => {
      if (typeof navigator === 'undefined' || typeof navigator.onLine !== 'boolean') return true
      return navigator.onLine
    },
    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}
