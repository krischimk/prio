import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { createSupabaseServices, readSupabaseConfig } from './app/services'
import { registerServiceWorker } from './pwa/registerServiceWorker'
import './index.css'

/**
 * Einstiegspunkt.
 *
 * Die Supabase-Abhängigkeiten werden hier einmalig zusammengesetzt und in die
 * App hineingereicht. Dadurch sind alle Tests in der Lage, dieselbe App mit
 * Fakes zu starten – ohne Cloud und ohne Umgebungsvariablen.
 */
const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('Das Element #root fehlt in index.html.')
}

const root = createRoot(rootElement)

/*
 * Bauteilübersicht: `npm run dev`, dann `?kueche=1`.
 *
 * Sie steht hinter `import.meta.env.DEV`, damit sie nicht im
 * Produktionsbundle landet – der Zweig ist dort tot und der Import wird nicht
 * mitgebaut. Sie zeigt alle Bauteile in allen Zuständen (`DESIGN.md` §12) und
 * braucht weder Anmeldung noch Datenbank.
 */
const kueche = import.meta.env.DEV && new URLSearchParams(window.location.search).has('kueche')

if (kueche) {
  void import('./ui/dev/Kitchen').then(({ Kitchen }) => {
    root.render(
      <StrictMode>
        <Kitchen />
      </StrictMode>,
    )
  })
} else {
  const config = readSupabaseConfig()
  const services = config ? createSupabaseServices(config) : null

  root.render(
    <StrictMode>
      <App services={services} />
    </StrictMode>,
  )

  registerServiceWorker()
}
