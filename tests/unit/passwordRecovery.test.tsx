import { StrictMode } from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, afterEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createSupabaseAuthPort } from '../../src/auth/supabaseAuth'
import { PasswordRecoveryScreen } from '../../src/ui/PasswordRecoveryScreen'
import { FakeAuthPort } from '../support/fakeAuth'
import { AuthError } from '../../src/auth/authPort'

function client() {
  const auth = {
    resetPasswordForEmail: vi.fn().mockResolvedValue({ error: null }),
    exchangeCodeForSession: vi.fn().mockResolvedValue({ error: null }),
    setSession: vi.fn().mockResolvedValue({ error: null }),
    getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'me', email: 'me@example.com' } }, error: null }),
    updateUser: vi.fn().mockResolvedValue({ error: null }),
  }
  return { auth, port: createSupabaseAuthPort({ auth } as unknown as SupabaseClient, 'https://prio.example/konto/passwort') }
}
afterEach(() => window.history.replaceState(null, '', '/'))

describe('Passwort-Link', () => {
  it('verwendet die private E-Mail und die öffentliche Rückkehradresse', async () => {
    const { auth, port } = client()
    await port.requestPasswordReset('  me@example.com  ')
    expect(auth.resetPasswordForEmail).toHaveBeenCalledWith('me@example.com', { redirectTo: 'https://prio.example/konto/passwort' })
  })
  it('löst einen PKCE-Einmalcode auch bei doppelter Initialisierung nur einmal ein', async () => {
    const { auth, port } = client()
    await Promise.all([port.completePasswordRecovery('https://prio.example/konto/passwort?code=once'),
      port.completePasswordRecovery('https://prio.example/konto/passwort?code=once')])
    expect(auth.exchangeCodeForSession).toHaveBeenCalledTimes(1)
    expect(auth.exchangeCodeForSession).toHaveBeenCalledWith('once')
    expect(auth.getUser).toHaveBeenCalledTimes(1)
  })
  it('übernimmt einen Recovery-Link und lässt den Server den Benutzer bestätigen', async () => {
    const { auth, port } = client()
    await expect(port.completePasswordRecovery('https://prio.example/konto/passwort#type=recovery&access_token=access&refresh_token=refresh')).resolves.toMatchObject({ id: 'me' })
    expect(auth.setSession).toHaveBeenCalledWith({ access_token: 'access', refresh_token: 'refresh' })
    await port.setPassword('newpassword')
    expect(auth.updateUser).toHaveBeenCalledWith({ password: 'newpassword' })
  })
  it.each([
    '#error=access_denied&error_code=otp_expired',
    '#type=recovery&access_token=incomplete',
    '?error=access_denied',
    '#type=signup&access_token=other&refresh_token=other',
  ])('verwirft fehlerhafte Links auch bei bestehender Sitzung: %s', async suffix => {
    const { auth, port } = client()
    await expect(port.completePasswordRecovery(`https://prio.example/konto/passwort${suffix}`)).rejects.toMatchObject({ kind: 'recovery-link-invalid' })
    expect(auth.getUser).not.toHaveBeenCalled()
    expect(auth.updateUser).not.toHaveBeenCalled()
  })
  it('weist abgelaufene Sitzungen und fehlgeschlagene Code-Einlösung ab', async () => {
    const first = client()
    first.auth.getUser.mockResolvedValue({ data: { user: null }, error: null })
    await expect(first.port.completePasswordRecovery('https://prio.example/konto/passwort')).rejects.toMatchObject({ kind: 'recovery-link-invalid' })
    const second = client()
    second.auth.exchangeCodeForSession.mockResolvedValue({ error: new Error('expired') })
    await expect(second.port.completePasswordRecovery('https://prio.example/konto/passwort?code=old')).rejects.toMatchObject({ kind: 'recovery-link-invalid' })
  })
  it('bezeichnet einen Netzfehler nicht als abgelaufenen Link', async () => {
    const { auth, port } = client()
    auth.getUser.mockResolvedValue({ data: { user: null }, error: new TypeError('Failed to fetch') })
    await expect(port.completePasswordRecovery('https://prio.example/konto/passwort')).rejects.toMatchObject({ kind: 'offline' })
  })
  it('entfernt Geheimnisse aus der Adresszeile, prüft die Wiederholung und speichert das neue Passwort', async () => {
    const port = new FakeAuthPort()
    const user = port.seed('me@example.com', 'oldpassword')
    port.currentUser = user
    window.history.replaceState(null, '', '/konto/passwort#type=recovery&access_token=secret')
    const save = vi.spyOn(port, 'setPassword')
    render(<StrictMode><PasswordRecoveryScreen port={port} /></StrictMode>)
    await screen.findByRole('form', { name: 'Neues Passwort festlegen' })
    expect(window.location.hash).toBe('')
    fireEvent.change(screen.getByLabelText('Neues Passwort'), { target: { value: 'newpassword' } })
    fireEvent.change(screen.getByLabelText('Passwort wiederholen'), { target: { value: 'different' } })
    fireEvent.click(screen.getByRole('button', { name: 'Passwort speichern' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('stimmen nicht überein')
    expect(save).not.toHaveBeenCalled()
    fireEvent.change(screen.getByLabelText('Passwort wiederholen'), { target: { value: 'newpassword' } })
    fireEvent.click(screen.getByRole('button', { name: 'Passwort speichern' }))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('wurde geändert'))
    await expect(port.signIn(user.email, 'newpassword')).resolves.toMatchObject(user)
    await expect(port.signIn(user.email, 'oldpassword')).rejects.toMatchObject({ kind: 'invalid-credentials' })
  })
  it('zeigt bei einem ungültigen Link kein Passwortformular', async () => {
    const port = new FakeAuthPort()
    vi.spyOn(port, 'completePasswordRecovery').mockRejectedValue(new AuthError('recovery-link-invalid', 'expired'))
    render(<PasswordRecoveryScreen port={port} />)
    expect(await screen.findByRole('alert')).toHaveTextContent('ungültig oder abgelaufen')
    expect(screen.queryByRole('form')).not.toBeInTheDocument()
  })
})
