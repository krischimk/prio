import { useState, type FormEvent } from 'react'
import { useWorkspace } from '../app/useWorkspace'
import { useMembers, useShareContacts } from '../app/hooks'
import { suggestShareContacts } from '../domain/shareContacts'
import type { LocalList } from '../domain/types'
import { cardSoft, errorMessage, input, successMessage } from './styles'
import { Button } from './components/Button'

/**
 * Teilen einer Liste über die E-Mail-Adresse eines registrierten Nutzers.
 *
 * Bewusste Einschränkung für Version 0.1: Teilen erfordert eine Verbindung,
 * weil nur der Server die Zuordnung E-Mail → Benutzer-ID kennt. Und: Mitglieder
 * werden lokal nur über ihre Benutzer-ID geführt – E-Mail-Adressen anderer
 * Nutzer werden nicht synchronisiert (Datensparsamkeit). Angezeigt wird
 * deshalb eine Kurzform der ID.
 *
 * Was der Benutzer selbst einträgt, wird dagegen gemerkt: Adressen, mit denen
 * schon einmal geteilt wurde, stehen beim nächsten Mal als Vorschlag bereit.
 * Ohne das müsste man dieselbe Adresse für jede weitere Liste erneut tippen.
 * Die Vorschläge liegen nur auf diesem Gerät (siehe `domain/shareContacts.ts`)
 * und werden über die Benutzer-ID gegen die Mitglieder der Liste geprüft.
 */
export function SharePanel({ list, currentUserId }: { list: LocalList; currentUserId: string }) {
  const { shareListByEmail, repositories } = useWorkspace()
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
      const { userId } = await shareListByEmail(list.id, email)
      // Merken, damit dieselbe Adresse beim nächsten Teilen vorgeschlagen wird.
      await repositories.rememberShareContact(email, userId)
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
          E-Mail-Adresse des Mitglieds
        </label>
        <input
          id="share-email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="mitglied@example.com"
          required
          className={`${input} flex-1 min-w-48`}
        />
        <Button type="submit" variant="primary" disabled={busy}>
          Freigeben
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
                  onClick={() => setEmail(contact.email)}
                >
                  {contact.email}
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
          <p className="text-meta text-ink-faint">Noch keine Mitglieder.</p>
        ) : (
          <ul className="space-y-1">
            {members.map((member) => (
              <li key={member.user_id} className="flex items-center justify-between gap-2 text-meta">
                <span className="truncate font-mono text-ink-soft" title={member.user_id}>
                  Mitglied {member.user_id.slice(0, 8)}
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
