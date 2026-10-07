import { AuthProvider } from './auth/AuthProvider'
import { useAuth } from './auth/useAuth'
import { BackLayerProvider } from './app/BackLayerProvider'
import { WorkspaceProvider } from './app/WorkspaceProvider'
import type { AppServices } from './app/services'
import { AuthScreen } from './ui/AuthScreen'
import { UndoProvider } from './ui/UndoProvider'
import { UpdateProvider } from './ui/UpdateProvider'
import { WorkspaceScreen } from './ui/WorkspaceScreen'
import { appBackground } from './ui/styles'

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
        <UpdateProvider>
          <UndoProvider>
            <WorkspaceScreen />
          </UndoProvider>
        </UpdateProvider>
      </BackLayerProvider>
    </WorkspaceProvider>
  )
}

function FullScreenNotice({ text }: { text: string }) {
  return (
    <div className={`flex min-h-screen items-center justify-center ${appBackground} px-4 text-ink-muted`}>
      {text}
    </div>
  )
}

function MissingConfiguration() {
  return (
    <div className={`flex min-h-screen items-center justify-center ${appBackground} px-4`}>
      <div className="max-w-md space-y-3">
        <h1 className="text-heading font-semibold text-ink-strong">Supabase ist nicht konfiguriert</h1>
        <p className="text-body text-ink-muted">
          Für Anmeldung und Synchronisation werden zwei Umgebungsvariablen benötigt. Lege eine{' '}
          <code className="rounded-control bg-surface px-1 py-0.5 text-ink-soft">.env</code> auf Basis von{' '}
          <code className="rounded-control bg-surface px-1 py-0.5 text-ink-soft">.env.example</code> an:
        </p>
        <pre className="overflow-x-auto rounded-control border border-line bg-surface p-3 text-meta text-ink-soft">
          {[
            'VITE_SUPABASE_URL=https://<projekt>.supabase.co',
            'VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...',
          ].join('\n')}
        </pre>
        <p className="text-body text-ink-muted">
          Danach den Dev-Server neu starten. Die Oberfläche arbeitet anschließend offline weiter, wenn
          Supabase nicht erreichbar ist.
        </p>
      </div>
    </div>
  )
}
