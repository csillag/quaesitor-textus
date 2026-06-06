import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest'
import { MongoClient } from 'mongodb'
import { computeSearchFields, createSearchIndexes, buildTextSearchFilter, startSearchSync, createLiveSearch } from './index'
import type { MongoSearchConfig } from './config'
import type { LiveEvent } from './createLiveSearch'
import type { SearchSync, SearchSyncEvent, SearchSyncListener } from './startSearchSync'

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

  it('omits projected fields (e.g. _qt) from the snapshot at the source', async () => {
    if (!available) return
    const col = client.db('qt_live_test').collection('docs')
    const sync = startSearchSync(col, config)
    const events: LiveEvent[] = []
    const live = createLiveSearch({ sync, collection: col, config, filter: buildTextSearchFilter('name', ['zola'], config), projection: { _qt: 0 }, sendEvent: e => events.push(e) })
    await new Promise(r => setTimeout(r, 300))
    const snap = events.find(e => e.type === 'snapshot') as any
    const doc = snap?.items.find((d: any) => d._id === 'a')
    expect(doc).toBeDefined()
    expect(doc._qt).toBeUndefined()
    expect(doc.name).toBe('Émile Zola')
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

// --- Coalescing: pure unit tests with a stub SearchSync + stub collection and
// fake timers (no Mongo). The stub collection serves a fixed snapshot and a
// per-id lookup table; the stub SearchSync lets the test fire `indexed` events.

class StubSync implements SearchSync {
  private listeners = new Set<SearchSyncListener>()
  on(l: SearchSyncListener): void { this.listeners.add(l) }
  off(l: SearchSyncListener): void { this.listeners.delete(l) }
  async stop(): Promise<void> { this.listeners.clear() }
  emit(e: SearchSyncEvent): void { for (const l of this.listeners) l(e) }
}

// Minimal Collection stand-in: `find().limit().toArray()` => snapshot,
// `findOne($and:[{_id}, filter])` => the doc registered under that _id.
function stubCollection(snapshot: any[], byId: Record<string, any>): any {
  return {
    find: () => ({
      sort() { return this },
      limit() { return this },
      async toArray() { return snapshot },
    }),
    async findOne(query: any) {
      const idClause = query.$and.find((c: any) => '_id' in c)
      return byId[String(idClause._id)] ?? null
    },
  }
}

// Flush pending promise microtasks (the findOne chain) under fake timers.
const flushMicrotasks = async () => { await Promise.resolve(); await Promise.resolve() }

const stubConfig: MongoSearchConfig = { targets: { name: { fields: ['name'] } } }

describe('createLiveSearch coalescing', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('without coalesceMs emits singular match events (unchanged)', async () => {
    const sync = new StubSync()
    const col = stubCollection([], { x: { _id: 'x', name: 'X' }, y: { _id: 'y', name: 'Y' } })
    const events: LiveEvent[] = []
    createLiveSearch({ sync, collection: col, config: stubConfig, filter: {}, sendEvent: e => events.push(e) })
    await flushMicrotasks() // resolve the empty snapshot

    sync.emit({ type: 'indexed', id: 'x' })
    await flushMicrotasks()
    sync.emit({ type: 'indexed', id: 'y' })
    await flushMicrotasks()

    const matches = events.filter(e => e.type === 'match')
    expect(matches).toHaveLength(2)
    expect(matches.map(m => (m as any).item._id)).toEqual(['x', 'y'])
    expect(events.some(e => e.type === 'matches')).toBe(false)
  })

  it('with coalesceMs batches matches in the window into one matches event', async () => {
    const sync = new StubSync()
    const col = stubCollection([], {
      a: { _id: 'a', name: 'A' }, b: { _id: 'b', name: 'B' }, c: { _id: 'c', name: 'C' },
    })
    const events: LiveEvent[] = []
    createLiveSearch({ sync, collection: col, config: stubConfig, filter: {}, coalesceMs: 100, sendEvent: e => events.push(e) })
    await flushMicrotasks()

    sync.emit({ type: 'indexed', id: 'a' })
    await flushMicrotasks()
    sync.emit({ type: 'indexed', id: 'b' })
    await flushMicrotasks()
    sync.emit({ type: 'indexed', id: 'c' })
    await flushMicrotasks()

    // Nothing flushed before the window elapses.
    expect(events.some(e => e.type === 'matches' || e.type === 'match')).toBe(false)

    await vi.advanceTimersByTimeAsync(100)

    const batches = events.filter(e => e.type === 'matches')
    expect(batches).toHaveLength(1)
    expect((batches[0] as any).items.map((d: any) => d._id)).toEqual(['a', 'b', 'c'])
    expect(events.some(e => e.type === 'match')).toBe(false)
  })

  it('respects cap across batches and flushes before capped', async () => {
    const sync = new StubSync()
    const col = stubCollection([], {
      a: { _id: 'a', name: 'A' }, b: { _id: 'b', name: 'B' }, c: { _id: 'c', name: 'C' },
    })
    const events: LiveEvent[] = []
    createLiveSearch({ sync, collection: col, config: stubConfig, filter: {}, cap: 2, coalesceMs: 100, sendEvent: e => events.push(e) })
    await flushMicrotasks() // empty snapshot, count 0 (< cap, not capped)

    sync.emit({ type: 'indexed', id: 'a' })
    await flushMicrotasks()
    sync.emit({ type: 'indexed', id: 'b' }) // hits cap -> flush + capped, synchronously buffered
    await flushMicrotasks()

    // The buffer was flushed before `capped` even though the window has not elapsed.
    const cappedIdx = events.findIndex(e => e.type === 'capped')
    const matchesIdx = events.findIndex(e => e.type === 'matches')
    expect(matchesIdx).toBeGreaterThanOrEqual(0)
    expect(cappedIdx).toBeGreaterThan(matchesIdx)
    expect((events[matchesIdx] as any).items.map((d: any) => d._id)).toEqual(['a', 'b'])

    // Further indexed events after capped are ignored.
    sync.emit({ type: 'indexed', id: 'c' })
    await flushMicrotasks()
    await vi.advanceTimersByTimeAsync(100)
    expect(events.filter(e => e.type === 'capped')).toHaveLength(1)
    expect(events.filter(e => e.type === 'matches')).toHaveLength(1)
    expect(events.some(e => e.type === 'matches' && (e as any).items.some((d: any) => d._id === 'c'))).toBe(false)
  })
})
