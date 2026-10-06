import { describe, expect, it } from 'vitest'
import {
  SHARE_CONTACTS_MAX,
  parseShareContacts,
  suggestShareContacts,
  withCoMemberContacts,
  withShareContact,
} from '../../src/domain/shareContacts'
import type { ShareContact } from '../../src/domain/types'

/**
 * Die gemerkten Adressen für das Teilen.
 *
 * Sie sind eine Eingabehilfe: zuletzt verwendete zuerst, keine Dopplungen, und
 * niemand wird vorgeschlagen, der in dieser Liste schon Mitglied ist.
 */
function kontakt(email: string, userId: string, at: string): ShareContact {
  return { email, user_id: userId, last_used_at: at }
}

describe('Gemerkte Adressen', () => {
  it('legt die zuletzt verwendete Adresse nach vorn', () => {
    const alt = [kontakt('anna@example.com', 'u-anna', '2026-01-01T00:00:00.000Z')]
    const neu = withShareContact(alt, 'bea@example.com', 'u-bea', '2026-02-01T00:00:00.000Z')

    expect(neu.map((eintrag) => eintrag.email)).toEqual(['bea@example.com', 'anna@example.com'])
  })

  it('führt eine bekannte Adresse nicht doppelt, sondern rückt sie nach vorn', () => {
    const alt = [
      kontakt('bea@example.com', 'u-bea', '2026-02-01T00:00:00.000Z'),
      kontakt('anna@example.com', 'u-anna', '2026-01-01T00:00:00.000Z'),
    ]
    const neu = withShareContact(alt, 'anna@example.com', 'u-anna', '2026-03-01T00:00:00.000Z')

    expect(neu).toHaveLength(2)
    expect(neu[0].email).toBe('anna@example.com')
    expect(neu[0].last_used_at).toBe('2026-03-01T00:00:00.000Z')
  })

  it('vergleicht Adressen ohne Rücksicht auf Schreibweise und Leerzeichen', () => {
    const alt = [kontakt('anna@example.com', 'u-anna', '2026-01-01T00:00:00.000Z')]
    const neu = withShareContact(alt, '  Anna@Example.COM ', 'u-anna', '2026-02-01T00:00:00.000Z')

    expect(neu).toHaveLength(1)
    expect(neu[0].last_used_at).toBe('2026-02-01T00:00:00.000Z')
  })

  it('behält nur die letzten Adressen', () => {
    let liste: ShareContact[] = []
    for (let i = 0; i < SHARE_CONTACTS_MAX + 5; i += 1) {
      liste = withShareContact(
        liste,
        `person-${i}@example.com`,
        `u-${i}`,
        `2026-01-${String((i % 28) + 1).padStart(2, '0')}T00:00:00.000Z`,
      )
    }

    expect(liste).toHaveLength(SHARE_CONTACTS_MAX)
    expect(liste[0].email).toBe(`person-${SHARE_CONTACTS_MAX + 4}@example.com`)
  })

  it('schlägt niemanden vor, der schon Mitglied der Liste ist', () => {
    const liste = [
      kontakt('anna@example.com', 'u-anna', '2026-02-01T00:00:00.000Z'),
      kontakt('bea@example.com', 'u-bea', '2026-01-01T00:00:00.000Z'),
    ]

    expect(suggestShareContacts(liste, ['u-anna']).map((e) => e.email)).toEqual([
      'bea@example.com',
    ])
  })

  it('zeigt höchstens fünf Vorschläge', () => {
    let liste: ShareContact[] = []
    for (let i = 0; i < 8; i += 1) {
      liste = withShareContact(liste, `person-${i}@example.com`, `u-${i}`, `2026-01-0${i + 1}T00:00:00.000Z`)
    }

    expect(suggestShareContacts(liste, [])).toHaveLength(5)
  })
})

describe('Gelesene Adressen', () => {
  it('liefert nichts, wenn nichts gespeichert ist', () => {
    expect(parseShareContacts(null)).toEqual([])
  })

  it('lässt unbrauchbare Einträge fallen, statt das Teilen zu blockieren', () => {
    const roh = JSON.stringify([
      { email: 'anna@example.com', user_id: 'u-anna', last_used_at: '2026-01-01T00:00:00.000Z' },
      { email: 'ohne-id@example.com' },
      'kein Objekt',
      { email: '', user_id: 'u-leer', last_used_at: '2026-01-01T00:00:00.000Z' },
    ])

    expect(parseShareContacts(roh)).toEqual([
      { email: 'anna@example.com', user_id: 'u-anna', last_used_at: '2026-01-01T00:00:00.000Z' },
    ])
  })

  it('verträgt kaputtes JSON', () => {
    expect(parseShareContacts('{kein json')).toEqual([])
  })
})

describe('Adressen aus gemeinsamen Listen', () => {
  it('nimmt Personen auf, mit denen eine Liste geteilt wird', () => {
    const neu = withCoMemberContacts(
      [],
      [{ userId: 'u-anna', email: 'anna@example.com' }],
      '2026-01-01T00:00:00.000Z',
    )

    expect(neu).toEqual([
      { email: 'anna@example.com', user_id: 'u-anna', last_used_at: '2026-01-01T00:00:00.000Z' },
    ])
  })

  it('lässt bekannte Adressen und ihre Reihenfolge unangetastet', () => {
    const bekannt = [
      kontakt('bea@example.com', 'u-bea', '2026-03-01T00:00:00.000Z'),
      kontakt('anna@example.com', 'u-anna', '2026-01-01T00:00:00.000Z'),
    ]
    const neu = withCoMemberContacts(
      bekannt,
      [{ userId: 'u-anna', email: 'anna@example.com' }],
      '2026-04-01T00:00:00.000Z',
    )

    expect(neu).toBe(bekannt)
  })

  it('stellt neu gefundene Adressen nach vorn', () => {
    const bekannt = [kontakt('bea@example.com', 'u-bea', '2026-03-01T00:00:00.000Z')]
    const neu = withCoMemberContacts(
      bekannt,
      [{ userId: 'u-anna', email: 'anna@example.com' }],
      '2026-04-01T00:00:00.000Z',
    )

    expect(neu.map((eintrag) => eintrag.email)).toEqual(['anna@example.com', 'bea@example.com'])
  })

  it('führt dieselbe Adresse aus mehreren Listen nur einmal', () => {
    const neu = withCoMemberContacts(
      [],
      [
        { userId: 'u-anna', email: 'anna@example.com' },
        { userId: 'u-anna', email: 'Anna@Example.com' },
      ],
      '2026-01-01T00:00:00.000Z',
    )

    expect(neu).toHaveLength(1)
  })
})
