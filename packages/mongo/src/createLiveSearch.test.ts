import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { MongoClient } from 'mongodb'
import { computeSearchFields, createSearchIndexes, buildTextSearchFilter, startSearchSync, createLiveSearch } from './index'
import type { MongoSearchConfig } from './config'
import type { LiveEvent } from './createLiveSearch'

const URL = process.env.MONGO_URL ?? 'mongodb://localhost:27018/?directConnection=true'
const config: MongoSearchConfig = { targets: { name: { fields: ['name'] } } }
let client: MongoClient
let available = true

beforeAll(async () => {
  try {
    client = await MongoClient.connect(URL, { serverSelectionTimeoutMS: 1500 })
    const col = client.db('qt_live_test').collection('docs')
    await col.deleteMany({})
    await col.insertMany([{ _id: 'a', name: 'Émile Zola', ...computeSearchFields({ name: 'Émile Zola' }, config) }] as never[])
    await createSearchIndexes(col, config)
  } catch { available = false }
})
afterAll(async () => { await client?.close() })

describe('createLiveSearch', () => {
  it('emits a snapshot of current matches', async () => {
    if (!available) return
    const col = client.db('qt_live_test').collection('docs')
    const sync = startSearchSync(col, config)
    const events: LiveEvent[] = []
    const live = createLiveSearch({ sync, collection: col, config, filter: buildTextSearchFilter('name', ['zola'], config), sendEvent: e => events.push(e) })
    await new Promise(r => setTimeout(r, 300))
    expect(events[0]?.type).toBe('snapshot')
    expect((events[0] as any).items.map((d: any) => d._id)).toContain('a')
    live.stop(); await sync.stop()
  })

  it('pushes a match for a newly-inserted matching doc', async () => {
    if (!available) return
    const col = client.db('qt_live_test').collection('docs')
    const sync = startSearchSync(col, config)
    const events: LiveEvent[] = []
    const live = createLiveSearch({ sync, collection: col, config, filter: buildTextSearchFilter('name', ['borges'], config), sendEvent: e => events.push(e) })
    await new Promise(r => setTimeout(r, 200))
    await col.insertOne({ _id: 'b', name: 'Jorge Luis Borges' } as never) // raw; watcher derives
    await new Promise(r => setTimeout(r, 1500))
    expect(events.some(e => e.type === 'match' && (e as any).item._id === 'b')).toBe(true)
    live.stop(); await sync.stop()
  })
})
