import { useState, type FormEvent } from 'react'
import { useWorkspace } from '../app/useWorkspace'
import { useMembers, useShareContacts } from '../app/hooks'
import { suggestShareContacts } from '../domain/shareContacts'
import type { LocalList } from '../domain/types'
import { cardSoft, errorMessage, input, successMessage } from './styles'
import { LEER_MITGLIEDER } from './emptyTexts'
import { Button } from './components/Button'
import { UserIcon } from './icons'
import { normalizeUsername } from '../domain/username'

/**
 * Teilen mit Benutzername oder E-Mail, über die serverseitige Rechteprüfung.
 * Namen und Adressen werden nur für den Kreis gemeinsamer Listen geliefert.
 * Bekannte Empfänger bleiben beim Wiederverwenden eines Namens an ihre ID
 * gebunden, damit eine spätere Namensvergabe niemand anderem Zugriff gibt.
 */
export function SharePanel({ list, currentUserId }: { list: LocalList; currentUserId: string }) {
  const { shareList, repositories } = useWorkspace()
  const members = useMembers(list.id)
  const contacts = useShareContacts()
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const isOwner = list.owner_id === currentUserId
  const vorschlaege = suggestShareContacts(
    contacts,
    members.map((member) => member.user_id),
  )

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const expected = contacts.find(contact => contact.username && contact.username === normalizeUsername(email))?.user_id
      const { userId } = await shareList(list.id, email, expected)
      // Merken, damit dieselbe Adresse beim nächsten Teilen vorgeschlagen wird.
      const contact = (await repositories.listShareContacts()).find(row => row.user_id === userId)
      if (contact) await repositories.rememberShareContact(contact.email, userId)
      else if (email.includes('@') && !email.startsWith('@')) await repositories.rememberShareContact(email, userId)
      setNotice(`Freigabe für ${email.trim()} gespeichert.`)
      setEmail('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Teilen fehlgeschlagen.')
    } finally {
      setBusy(false)
    }
  }

  if (!isOwner) {
    return (
      <div className={`${cardSoft} text-meta text-ink-muted`}>
        Diese Liste gehört jemand anderem. Nur der Besitzer kann Mitglieder verwalten.
      </div>
    )
  }

  return (
    <div className={`${cardSoft} space-y-3`}>
      <form onSubmit={submit} className="flex flex-wrap gap-2" aria-label="Liste teilen">
        <label htmlFor="share-email" className="sr-only">
          Benutzername oder E-Mail
        </label>
        <input
          id="share-email"
          type="text"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="@benutzername"
          required
          className={`${input} flex-1 min-w-48`}
        />
        <Button type="submit" variant="primary" disabled={busy}>
          <UserIcon />Freigeben
        </Button>
      </form>

      {vorschlaege.length > 0 ? (
        <div>
          <h3 className="mb-1 text-meta font-semibold uppercase tracking-wide text-ink-faint">
            Zuletzt geteilt
          </h3>
          <ul className="flex flex-wrap gap-2">
            {vorschlaege.map((contact) => (
              <li key={contact.email}>
                {/*
                  Ein Klick setzt die Adresse ins Feld, statt sofort freizugeben:
                  Ein zweiter Klick auf „Freigeben" bestätigt. So kann ein
                  versehentlicher Tipp niemandem Zugriff geben.
                */}
                <Button
                  variant="ghost" size="sm"
                  onClick={() => setEmail(contact.username ? `@${contact.username}` : contact.email)}
                >
                  {contact.username ? `@${contact.username}` : contact.email}
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className={errorMessage}>
          {error}
        </p>
      ) : null}
      {notice ? (
        <p role="status" className={successMessage}>
          {notice}
        </p>
      ) : null}

      <div>
        <h3 className="mb-1 text-meta font-semibold uppercase tracking-wide text-ink-faint">
          Mitglieder
        </h3>
        {members.length === 0 ? (
          <p className="text-meta text-ink-faint">{LEER_MITGLIEDER}</p>
        ) : (
          <ul className="space-y-1">
            {members.map((member) => (
              <li key={member.user_id} className="flex items-center justify-between gap-2 text-meta">
                <span className="truncate text-ink-soft">
                  {(() => { const contact = contacts.find(row => row.user_id === member.user_id); return contact?.username ? `@${contact.username}` : contact?.email ?? 'Name noch nicht geladen' })()}
                </span>
                <Button
                  variant="danger" size="sm"
                  onClick={() => {
                    void repositories.removeMember(list.id, member.user_id)
                  }}
                >
                  Entfernen
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {!list.is_shared ? (
        <p className="text-meta text-ink-faint">
          Nach dem Teilen wird die Liste synchronisiert, sobald eine Verbindung besteht.
        </p>
      ) : null}
    </div>
  )
}
