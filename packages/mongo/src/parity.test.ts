import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { MongoClient } from 'mongodb'
import { matchItem, buildCorpus } from '@quaesitor-textus/core'
import { computeSearchFields, createSearchIndexes, buildTextSearchFilter } from './index'
import type { MongoSearchConfig } from './config'

const URL = process.env.MONGO_URL ?? 'mongodb://localhost:27018/?replicaSet=rs0'
const config: MongoSearchConfig = {
  targets: { name: { fields: ['name'], queryModes: [{ caseSensitive: true }] } },
}
const DOCS = [
  { name: 'Gabriel García Márquez' },
  { name: 'GARCIA lopez' },
  { name: 'Wei Ng' },
  { name: 'Plain Author' },
  { name: 'café society' },
]

let client: MongoClient
let available = true

beforeAll(async () => {
  try {
    client = await MongoClient.connect(URL, { serverSelectionTimeoutMS: 1500 })
    const col = client.db('qt_parity_test').collection('docs')
    await col.deleteMany({})
    await col.insertMany(DOCS.map(d => ({ ...d, ...computeSearchFields(d, config) })))
    await createSearchIndexes(col, config)
  } catch {
    available = false
  }
})
afterAll(async () => { await client?.close() })

async function serverMatches(patterns: string[], options?: any): Promise<string[]> {
  const col = client.db('qt_parity_test').collection('docs')
  const filter = buildTextSearchFilter('name', patterns, config, options)
  const rows = await col.find(filter).toArray()
  return rows.map(r => r.name).sort()
}
function clientMatches(patterns: string[], options?: any): string[] {
  return DOCS.filter(d => matchItem(buildCorpus(d, ['name']), patterns, options))
    .map(d => d.name).sort()
}

describe('client↔server parity', () => {
  const cases: Array<{ patterns: string[]; options?: any }> = [
    { patterns: ['garcia'] },                          // diacritic + case insensitive
    { patterns: ['ng'] },                              // 2-char (bigram path)
    { patterns: ['cafe'] },                            // diacritic fold
    { patterns: ['garcia', 'marquez'] },               // multi-pattern AND
    { patterns: ['GARCIA'], options: { caseSensitive: true } }, // case-sensitive mode
  ]
  for (const c of cases) {
    it(`parity: ${JSON.stringify(c)}`, async () => {
      if (!available) return
      expect(await serverMatches(c.patterns, c.options)).toEqual(clientMatches(c.patterns, c.options))
    })
  }
})
