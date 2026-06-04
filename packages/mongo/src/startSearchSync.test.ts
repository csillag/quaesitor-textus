import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { MongoClient } from 'mongodb'
import { startSearchSync } from './startSearchSync'
import type { MongoSearchConfig } from './config'
import { searchFieldsVersion } from './version'

const URL = process.env.MONGO_URL ?? 'mongodb://localhost:27018/?directConnection=true'
const config: MongoSearchConfig = { targets: { name: { fields: ['name'] } } }
let client: MongoClient
let available = true

beforeAll(async () => {
  try { client = await MongoClient.connect(URL, { serverSelectionTimeoutMS: 1500 }) }
  catch { available = false }
})
afterAll(async () => { await client?.close() })

describe('startSearchSync backfill', () => {
  it('derives a pre-existing doc written before the watcher starts', async () => {
    if (!available) return
    const col = client.db('qt_backfill_test').collection('docs')
    await col.deleteMany({})
    await col.insertOne({ _id: 'pre', name: 'Émile Zola' } as never) // raw, before watcher
    const sync = startSearchSync(col, config, { backfill: true })
    await new Promise(r => setTimeout(r, 1200))
    const doc = await col.findOne({ _id: 'pre' as never }) as any
    expect(doc?._qt?.name?.norm).toBe('emile zola')
    await sync.stop()
  })

  it('re-derives a doc whose stored version is stale', async () => {
    if (!available) return
    const col = client.db('qt_backfill_test').collection('docs')
    await col.deleteMany({})
    // Doc that already has derived fields but stamped with an obsolete version.
    await col.insertOne({ _id: 'stale', name: 'Wisława', _qt: { name: { norm: 'WRONG', ngrams: [] }, _v: 'old:0' } } as never)
    const sync = startSearchSync(col, config, { backfill: true })
    await new Promise(r => setTimeout(r, 1200))
    const doc = await col.findOne({ _id: 'stale' as never }) as any
    expect(doc?._qt?.name?.norm).toBe('wislawa') // re-derived with current folding
    await sync.stop()
  })
})

describe('startSearchSync config provider', () => {
  const titleOnly: MongoSearchConfig = { targets: { title: { fields: ['title'] } } }
  const titleAndBody: MongoSearchConfig = {
    targets: { title: { fields: ['title'] }, body: { fields: ['body'] } },
  }

  it('resolves a provider at start and backfills with it', async () => {
    if (!available) return
    const col = client.db('qt_provider_test').collection('start')
    await col.deleteMany({})
    await col.insertOne({ _id: 'a', title: 'Hello', body: 'World' } as never)
    const sync = startSearchSync(col, () => titleOnly, { backfill: true, idleMs: 100 })
    await new Promise(r => setTimeout(r, 700))
    const doc = await col.findOne({ _id: 'a' as never }) as any
    expect(doc?._qt?.title).toBeTruthy()
    expect(doc?._qt?.body).toBeFalsy()
    await sync.stop()
  })

  it('re-derives existing docs when the provider returns a grown config', async () => {
    if (!available) return
    const col = client.db('qt_provider_test').collection('grow')
    await col.deleteMany({})
    await col.insertOne({ _id: 'a', title: 'Hello', body: 'World' } as never)
    let cfg: MongoSearchConfig = titleOnly
    const sync = startSearchSync(col, () => cfg, { backfill: true, idleMs: 100 })
    await new Promise(r => setTimeout(r, 700))
    let doc = await col.findOne({ _id: 'a' as never }) as any
    expect(doc?._qt?.body).toBeFalsy()
    // Grow the field set, then cause a burst → idle → reconfigure → re-backfill.
    cfg = titleAndBody
    await col.insertOne({ _id: 'b', title: 'Foo', body: 'Bar' } as never)
    await new Promise(r => setTimeout(r, 900))
    doc = await col.findOne({ _id: 'a' as never }) as any
    expect(doc?._qt?.body).toBeTruthy() // pre-existing doc re-derived for the new field
    await sync.stop()
  })

  it('does not re-backfill when the provider returns an unchanged version', async () => {
    if (!available) return
    const col = client.db('qt_provider_test').collection('stable')
    await col.deleteMany({})
    await col.insertOne({ _id: 'a', title: 'Hello' } as never)
    let started = 0
    const sync = startSearchSync(col, () => titleOnly, { backfill: true, idleMs: 100 })
    sync.on((e) => { if (e.type === 'indexing-started') started += 1 })
    await new Promise(r => setTimeout(r, 500)) // initial backfill settles (started === 1)
    await col.insertOne({ _id: 'b', title: 'World' } as never) // one live burst (started === 2)
    await new Promise(r => setTimeout(r, 700)) // idle → reconfigure(same version) → no backfill
    expect(started).toBe(2) // not 3 — the unchanged-version reconfigure did not backfill
    await sync.stop()
  })

  it('static config is unchanged and the library does not create indexes', async () => {
    if (!available) return
    const col = client.db('qt_provider_test').collection('static')
    await col.deleteMany({})
    await col.insertOne({ _id: 'a', title: 'Hello' } as never)
    const sync = startSearchSync(col, titleOnly, { backfill: true, idleMs: 100 })
    await new Promise(r => setTimeout(r, 700))
    const doc = await col.findOne({ _id: 'a' as never }) as any
    expect(doc?._qt?.title).toBeTruthy() // behaves as before
    const names = (await col.indexes()).map((i: any) => i.name)
    expect(names).not.toContain('_qt_title_ngrams') // static path must NOT auto-create indexes
    await sync.stop()
  })

  it('creates indexes for newly added targets on reconfigure', async () => {
    if (!available) return
    const col = client.db('qt_provider_test').collection('reidx')
    await col.deleteMany({})
    await col.insertOne({ _id: 'a', title: 'Hello', body: 'World' } as never)
    let cfg: MongoSearchConfig = titleOnly
    const sync = startSearchSync(col, () => cfg, { backfill: true, idleMs: 100 })
    await new Promise(r => setTimeout(r, 700))
    cfg = titleAndBody
    await col.insertOne({ _id: 'b', title: 'Foo', body: 'Bar' } as never)
    await new Promise(r => setTimeout(r, 900))
    const names = (await col.indexes()).map((i: any) => i.name)
    expect(names).toContain('_qt_body_ngrams') // new target's ngram index ensured
    await sync.stop()
  })

  it('keeps a consistent final state under rapid config changes', async () => {
    if (!available) return
    const col = client.db('qt_provider_test').collection('rapid')
    await col.deleteMany({})
    await col.insertOne({ _id: 'a', title: 'Hello', body: 'World' } as never)
    let cfg: MongoSearchConfig = titleOnly
    const sync = startSearchSync(col, () => cfg, { backfill: true, idleMs: 80 })
    cfg = titleAndBody
    for (let i = 0; i < 3; i++) {
      await col.insertOne({ _id: `x${i}`, title: 't', body: 'b' } as never)
      await new Promise(r => setTimeout(r, 120))
    }
    await new Promise(r => setTimeout(r, 600))
    const doc = await col.findOne({ _id: 'a' as never }) as any
    expect(doc?._qt?._v).toBe(searchFieldsVersion(titleAndBody)) // settled on the final config
    expect(doc?._qt?.body).toBeTruthy()
    await sync.stop()
  })
})
