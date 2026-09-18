import { AuthProvider } from './auth/AuthProvider'
import { useAuth } from './auth/useAuth'
import { BackLayerProvider } from './app/BackLayerProvider'
import { WorkspaceProvider } from './app/WorkspaceProvider'
import type { AppServices } from './app/services'
import { AuthScreen } from './ui/AuthScreen'
import { WorkspaceScreen } from './ui/WorkspaceScreen'

/**
 * Wurzelkomponente.
 *
 * `services` wird von außen übergeben (siehe `main.tsx`). Ist es `null`, fehlt
 * die Supabase-Konfiguration; dann erklärt die App das, statt mit einem
 * technischen Fehler abzustürzen.
 */
export function App({ services }: { services: AppServices | null }) {
  if (!services) return <MissingConfiguration />
  return (
    <AuthProvider port={services.auth}>
      <AuthenticatedArea services={services} />
    </AuthProvider>
  )
}

function AuthenticatedArea({ services }: { services: AppServices }) {
  const { state } = useAuth()

  if (state.status === 'loading') {
    return <FullScreenNotice text="Sitzung wird geprüft…" />
  }
  if (state.status === 'anonymous') {
    return <AuthScreen />
  }

  return (
    <WorkspaceProvider userId={state.user.id} gateway={services.gateway} network={services.network}>
      <BackLayerProvider>
        <WorkspaceScreen />
      </BackLayerProvider>
    </WorkspaceProvider>
  )
}

function FullScreenNotice({ text }: { text: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-950 px-4 text-neutral-400">
      {text}
    </div>
  )
}

function MissingConfiguration() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-950 px-4">
      <div className="max-w-md space-y-3">
        <h1 className="text-xl font-semibold text-neutral-50">Supabase ist nicht konfiguriert</h1>
        <p className="text-sm text-neutral-400">
          Für Anmeldung und Synchronisation werden zwei Umgebungsvariablen benötigt. Lege eine{' '}
          <code className="rounded bg-neutral-900 px-1 py-0.5 text-neutral-200">.env</code> auf Basis von{' '}
          <code className="rounded bg-neutral-900 px-1 py-0.5 text-neutral-200">.env.example</code> an:
        </p>
        <pre className="overflow-x-auto rounded-md border border-neutral-800 bg-neutral-900 p-3 text-xs text-neutral-300">
          {[
            'VITE_SUPABASE_URL=https://<projekt>.supabase.co',
            'VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...',
          ].join('\n')}
        </pre>
        <p className="text-sm text-neutral-400">
          Danach den Dev-Server neu starten. Die Oberfläche arbeitet anschließend offline weiter, wenn
          Supabase nicht erreichbar ist.
        </p>
      </div>
    </div>
  )
}
