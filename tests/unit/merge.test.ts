import { describe, expect, it } from 'vitest'
import { resolveMerge } from '../../src/domain/merge'
import type { LocalTask } from '../../src/domain/types'
import { localTask, remoteTask, T0, T1 } from '../support/factories'

/**
 * Last-Write-Wins-Konfliktlogik (unit).
 *
 * Bewusste Vereinfachung für Version 0.1: Pro Datensatz gewinnt der jüngere
 * `updated_at`. Es gibt keinen Feld-Merge.
 */
describe('resolveMerge (Last Write Wins)', () => {
  it('übernimmt die Serverversion, wenn lokal nichts existiert', () => {
    const result = resolveMerge<LocalTask>(undefined, remoteTask({ title: 'vom Server' }))
    expect(result.outcome).toBe('inserted')
    expect(result.row.title).toBe('vom Server')
    expect(result.row.dirty).toBe(0)
    expect(result.needsPush).toBe(false)
  })

  it('behält die lokale Version, wenn sie jünger ist, und lädt sie hoch', () => {
    const local = localTask({ title: 'lokal', updated_at: T1, dirty: 0 })
    const remote = remoteTask({ title: 'server', updated_at: T0 })

    const result = resolveMerge(local, remote)

    expect(result.outcome).toBe('local-wins')
    expect(result.row.title).toBe('lokal')
    expect(result.needsPush).toBe(true)
    expect(result.row.dirty).toBe(1)
  })

  it('übernimmt die Serverversion, wenn sie jünger ist', () => {
    const local = localTask({ title: 'lokal', updated_at: T0, dirty: 1 })
    const remote = remoteTask({ title: 'server', updated_at: T1 })

    const result = resolveMerge(local, remote)

    expect(result.outcome).toBe('remote-wins')
    expect(result.row.title).toBe('server')
    expect(result.row.dirty).toBe(0)
    expect(result.needsPush).toBe(false)
  })

  it('behält bei gleichem Zeitstempel die noch nicht hochgeladene lokale Änderung', () => {
    const local = localTask({ title: 'lokal', updated_at: T0, dirty: 1 })
    const remote = remoteTask({ title: 'server', updated_at: T0 })

    const result = resolveMerge(local, remote)

    expect(result.outcome).toBe('local-wins')
    expect(result.row.title).toBe('lokal')
    expect(result.needsPush).toBe(true)
  })

  it('übernimmt bei gleichem Zeitstempel die Serverversion, wenn lokal sauber ist', () => {
    const local = localTask({ title: 'lokal', updated_at: T0, dirty: 0 })
    const remote = remoteTask({ title: 'server', updated_at: T0 })

    const result = resolveMerge(local, remote)

    expect(result.outcome).toBe('unchanged')
    expect(result.row.title).toBe('server')
    expect(result.needsPush).toBe(false)
  })

  it('überträgt einen neueren Soft Delete vom Server', () => {
    const local = localTask({ updated_at: T0, dirty: 0 })
    const remote = remoteTask({ updated_at: T1, deleted_at: T1 })

    const result = resolveMerge(local, remote)

    expect(result.row.deleted_at).toBe(T1)
    expect(result.row.dirty).toBe(0)
  })

  it('überträgt einen neueren lokalen Soft Delete zum Server', () => {
    const local = localTask({ updated_at: T1, deleted_at: T1, dirty: 1 })
    const remote = remoteTask({ updated_at: T0, deleted_at: null })

    const result = resolveMerge(local, remote)

    expect(result.outcome).toBe('local-wins')
    expect(result.row.deleted_at).toBe(T1)
    expect(result.needsPush).toBe(true)
  })
})
