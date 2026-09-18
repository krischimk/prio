import { describe, expect, it } from 'vitest'
import { readSupabaseConfig } from '../../src/auth/supabaseAuth'

/**
 * Lesen der Supabase-Konfiguration aus den Umgebungsvariablen.
 *
 * Hintergrund: Supabase schafft die alten Keys `anon` und `service_role` bis
 * Ende 2026 ab. Der neue **Publishable Key** (`sb_publishable_…`) ist der
 * direkte Ersatz für `anon`. Der alte Variablenname wird weiterhin akzeptiert,
 * damit bestehende Installationen nicht brechen.
 */
function env(values: Record<string, string | undefined>): ImportMetaEnv {
  return values as unknown as ImportMetaEnv
}

const URL = 'https://beispiel.supabase.co'

describe('Supabase-Konfiguration lesen', () => {
  it('liest URL und Publishable Key', () => {
    const config = readSupabaseConfig(
      env({ VITE_SUPABASE_URL: URL, VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_abc' }),
    )
    expect(config).toEqual({ url: URL, publishableKey: 'sb_publishable_abc' })
  })

  it('akzeptiert weiterhin den alten Variablennamen VITE_SUPABASE_ANON_KEY', () => {
    const config = readSupabaseConfig(
      env({ VITE_SUPABASE_URL: URL, VITE_SUPABASE_ANON_KEY: 'eyJ-legacy-anon' }),
    )
    expect(config).toEqual({ url: URL, publishableKey: 'eyJ-legacy-anon' })
  })

  it('bevorzugt den Publishable Key, wenn beide gesetzt sind', () => {
    const config = readSupabaseConfig(
      env({
        VITE_SUPABASE_URL: URL,
        VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_neu',
        VITE_SUPABASE_ANON_KEY: 'eyJ-legacy',
      }),
    )
    expect(config?.publishableKey).toBe('sb_publishable_neu')
  })

  it('entfernt überflüssige Leerzeichen', () => {
    const config = readSupabaseConfig(
      env({ VITE_SUPABASE_URL: `  ${URL}  `, VITE_SUPABASE_PUBLISHABLE_KEY: '  sb_publishable_abc  ' }),
    )
    expect(config).toEqual({ url: URL, publishableKey: 'sb_publishable_abc' })
  })

  it('liefert null, wenn nichts konfiguriert ist', () => {
    expect(readSupabaseConfig(env({}))).toBeNull()
  })

  it('liefert null bei leerem Schlüssel', () => {
    expect(readSupabaseConfig(env({ VITE_SUPABASE_URL: URL, VITE_SUPABASE_PUBLISHABLE_KEY: '   ' }))).toBeNull()
    expect(readSupabaseConfig(env({ VITE_SUPABASE_URL: '   ', VITE_SUPABASE_PUBLISHABLE_KEY: 'x' }))).toBeNull()
  })
})
