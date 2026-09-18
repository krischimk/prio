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
const config = readSupabaseConfig()
const services = config ? createSupabaseServices(config) : null

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('Das Element #root fehlt in index.html.')
}

createRoot(rootElement).render(
  <StrictMode>
    <App services={services} />
  </StrictMode>,
)

registerServiceWorker()
