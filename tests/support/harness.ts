import { createRepositories, type Repositories } from '../../src/db/repositories'
import { deleteLocalDatabase, openLocalDatabase, type LocalDatabase } from '../../src/db/localDb'
import { createFixedClock } from '../../src/domain/clock'
import { createSyncEngine, type SyncEngine } from '../../src/sync/syncEngine'
import type { RemoteGateway } from '../../src/sync/remoteGateway'

/** Hilfsmittel, um ein "Gerät" (lokale DB + Repositories + Sync-Engine) zu bauen. */

export type TestClock = ReturnType<typeof createFixedClock>

export interface DeviceHarness {
  db: LocalDatabase
  repositories: Repositories
  engine: SyncEngine
  clock: TestClock
  dispose(): Promise<void>
}

export function createTestUserId(prefix = 'test'): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`
}

export async function createDevice(options: {
  userId: string
  gateway: RemoteGateway
  isOnline?: () => boolean
  clock?: TestClock
}): Promise<DeviceHarness> {
  const clock = options.clock ?? createFixedClock()
  const db = await openLocalDatabase(options.userId)
  const repositories = createRepositories(db, clock)
  const engine = createSyncEngine({
    db,
    gateway: options.gateway,
    currentUserId: options.userId,
    clock,
    isOnline: options.isOnline ?? (() => true),
  })

  return {
    db,
    repositories,
    engine,
    clock,
    async dispose() {
      db.close()
      await deleteLocalDatabase(options.userId)
    },
  }
}
