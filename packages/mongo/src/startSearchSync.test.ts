import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { MongoClient } from 'mongodb'
import { startSearchSync } from './startSearchSync'
import type { MongoSearchConfig } from './config'

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
