import { Capacitor, registerPlugin } from '@capacitor/core'
import type { SupabaseConfig } from '../auth/supabaseAuth'
import type { WidgetCommand, WidgetSnapshot } from './model'
import type { ReminderCandidate } from '../reminders/reminderPlan'

export const hasNativeWidgets = () => Capacitor.getPlatform() === 'android'
export const widgetBridge = registerPlugin<{
  prepare(options: SupabaseConfig & { endpoint: string; legacy: string | null }): Promise<{ session: string | null }>
  storageGet(options: { key: string }): Promise<{ value: string | null }>
  storageSet(options: { key: string; value: string }): Promise<void>
  storageRemove(options: { key: string }): Promise<void>
  acquire(options: { name: 'auth' | 'queue'; timeout?: number }): Promise<{ lease: string }>
  release(options: { lease: string }): Promise<void>
  publish(options: { snapshot: WidgetSnapshot; initial: boolean }): Promise<void>
  commands(): Promise<{ commands: WidgetCommand[] }>
  acknowledge(options: { id: string }): Promise<void>
  theme(options: { preference: 'system' | 'light' | 'dark' }): Promise<void>
  reminders(options: { candidates: ReminderCandidate[] }): Promise<{ count: number }>
  reminderCount(): Promise<{ count: number }>
}>('PrioWidget')

let session: string | null = null
export const cachedNativeSession = () => session
export async function prepareNativeWidgets(config: SupabaseConfig) {
  if (!hasNativeWidgets()) return
  const result = await widgetBridge.prepare({ ...config, endpoint: new URL('/api/widget', import.meta.env.VITE_PUBLIC_APP_URL?.trim() || 'https://prio-krischi.pages.dev').href,
    legacy: localStorage.getItem('prio.auth') })
  session = result.session
  // Migration übernimmt die bestehende Sitzung, ohne eine neue Anmeldung.
  // Danach bleibt kein zweiter, unverschlüsselter Token-Speicher übrig.
  localStorage.removeItem('prio.auth')
  void widgetBridge.theme({ preference: (localStorage.getItem('prio:theme') as 'light' | 'dark') || 'system' }).catch(() => {})
}
export const nativeAuthStorage = {
  async getItem(key: string) { const { value } = await widgetBridge.storageGet({ key }); if (key === 'prio.auth') session = value; return value },
  async setItem(key: string, value: string) { await widgetBridge.storageSet({ key, value }); if (key === 'prio.auth') session = value },
  async removeItem(key: string) { await widgetBridge.storageRemove({ key }); if (key === 'prio.auth') session = null },
}
export async function nativeAuthLock<T>(_name: string, acquireTimeout: number, fn: () => Promise<T>): Promise<T> {
  const { lease } = await widgetBridge.acquire({ name: 'auth', timeout: acquireTimeout > 0 ? acquireTimeout : 30_000 })
  try { return await fn() } finally { await widgetBridge.release({ lease }) }
}
