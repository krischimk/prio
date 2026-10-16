import { expect, it } from 'vitest'
import { createDevice } from '../support/harness'
import { createFakeServer } from '../support/fakeGateway'
import { ratingValues, startRating } from '../../src/domain/rating'
import { setChecklistWeight, withChecklistWeights } from '../../src/domain/checklist'

it('synchronisiert Bewertungen und Listenregel ohne zeitabhängige Schreibvorgänge', async () => {
  const server = createFakeServer()
  const a = await createDevice({ userId: 'ratings', gateway: server.gatewayFor('ratings') })
  const b = await createDevice({ userId: 'ratings', gateway: server.gatewayFor('ratings') })
  try {
    const list = await a.repositories.createList('Bewertet', 'ratings')
    const task = await a.repositories.createTask({ listId: list.id, title: 'Aufgabe', rating: startRating(8) })
    await a.engine.sync(); await b.engine.sync()
    expect((await b.repositories.getTask(task.id))?.rating).toEqual(startRating(8))
    await a.repositories.updateTask(task.id, { rating: startRating(9) })
    await b.repositories.updateTask(task.id, { description: 'Unabhängig' })
    await a.engine.sync(); await b.engine.sync(); await a.engine.sync()
    expect((await a.repositories.getTask(task.id))).toMatchObject({ rating: startRating(9), description: 'Unabhängig' })
    await a.repositories.setListRatingsEnabled(list.id, 'ratings', false)
    await a.engine.sync(); await b.engine.sync()
    expect((await b.repositories.getList(list.id))?.ratings_enabled).toBe(false)
    expect((await b.repositories.getTask(task.id))?.rating).toEqual(startRating(9))
  } finally { await a.dispose(); await b.dispose() }
})

it('verbindet Gewichtung mit parallelem Abhaken auf einem zweiten Gerät', async () => {
  const server = createFakeServer()
  const a = await createDevice({ userId: 'ratings', gateway: server.gatewayFor('ratings') })
  const b = await createDevice({ userId: 'ratings', gateway: server.gatewayFor('ratings') })
  try {
    const list = await a.repositories.createList('Schritte', 'ratings')
    const checklist = withChecklistWeights(['a', 'b'].map(id => ({ id, text: id, completed: false, deleted_at: null })))
    const task = await a.repositories.createTask({ listId: list.id, title: 'Gemeinsam', rating: { ...startRating(8), effort: 8 }, checklist })
    await a.engine.sync(); await b.engine.sync()
    await a.repositories.updateTask(task.id, { checklist: setChecklistWeight(checklist, 'a', 0.75) })
    await b.repositories.updateTask(task.id, { checklist: checklist.map(item => ({ ...item, completed: item.id === 'a' })) })
    await a.engine.sync(); await b.engine.sync(); await a.engine.sync()
    for (const device of [a, b]) {
      const saved = (await device.repositories.getTask(task.id))!
      expect(saved.checklist[0]).toMatchObject({ completed: true, weight: 0.75 })
      expect(ratingValues(saved.rating!, saved.due_at, device.clock.nowMs(), saved.checklist).effort).toBe(2)
    }
  } finally { await a.dispose(); await b.dispose() }
})
