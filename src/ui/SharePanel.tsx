import { useState, type FormEvent } from 'react'
import { useWorkspace } from '../app/useWorkspace'
import { useMembers, useShareContacts } from '../app/hooks'
import { suggestShareContacts } from '../domain/shareContacts'
import type { LocalList } from '../domain/types'
import { buttonClass, errorMessage, input, primaryButton, successMessage } from './styles'

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
      <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-3 text-xs text-neutral-400">
        Diese Liste gehört jemand anderem. Nur der Besitzer kann Mitglieder verwalten.
      </div>
    )
  }

  return (
    <div className="space-y-3 rounded-lg border border-neutral-800 bg-neutral-900/40 p-3">
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
        <button type="submit" className={primaryButton} disabled={busy}>
          Freigeben
        </button>
      </form>

      {vorschlaege.length > 0 ? (
        <div>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">
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
                <button
                  type="button"
                  className={buttonClass('ghost', 'sm')}
                  onClick={() => setEmail(contact.email)}
                >
                  {contact.email}
                </button>
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
        <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Mitglieder
        </h3>
        {members.length === 0 ? (
          <p className="text-xs text-neutral-500">Noch keine Mitglieder.</p>
        ) : (
          <ul className="space-y-1">
            {members.map((member) => (
              <li key={member.user_id} className="flex items-center justify-between gap-2 text-xs">
                <span className="truncate font-mono text-neutral-300" title={member.user_id}>
                  Mitglied {member.user_id.slice(0, 8)}
                </span>
                <button
                  type="button"
                  className={buttonClass('danger', 'sm')}
                  onClick={() => {
                    void repositories.removeMember(list.id, member.user_id)
                  }}
                >
                  Entfernen
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {!list.is_shared ? (
        <p className="text-xs text-neutral-500">
          Nach dem Teilen wird die Liste synchronisiert, sobald eine Verbindung besteht.
        </p>
      ) : null}
    </div>
  )
}
