import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { MongoClient } from 'mongodb'
import { matchItem, buildCorpus } from '@quaesitor-textus/core'
import { computeSearchFields, createSearchIndexes, buildTextSearchFilter } from './index'
import type { MongoSearchConfig } from './config'

const URL = process.env.MONGO_URL ?? 'mongodb://localhost:27018/?replicaSet=rs0'
const config: MongoSearchConfig = {
  targets: {
    name: { fields: ['name'], queryModes: [{ caseSensitive: true }, { diacriticSensitive: true }] },
  },
}
// Smallest n-gram of 3: a two-letter pattern yields no n-gram.
const triConfig: MongoSearchConfig = { ngramSizes: [3], targets: config.targets }
const configs = { base: config, tri: triConfig }
type ConfigKey = keyof typeof configs
const collectionName = (key: ConfigKey) => (key === 'base' ? 'docs' : `docs_${key}`)
const DOCS = [
  { name: 'Gabriel García Márquez' },
  { name: 'GARCIA lopez' },
  { name: 'Wei Ng' },
  { name: 'Plain Author' },
  { name: 'café society' },
  { name: 'Rene\u0301 Char' },                      // decomposed é
]

let client: MongoClient
// Without a reachable server the tests skip; a setup error after connecting fails the run.
let available = true

beforeAll(async () => {
  try {
    client = await MongoClient.connect(URL, { serverSelectionTimeoutMS: 1500 })
  } catch {
    available = false
    return
  }
  for (const [key, cfg] of Object.entries(configs) as Array<[ConfigKey, MongoSearchConfig]>) {
    const col = client.db('qt_parity_test').collection(collectionName(key))
    await col.deleteMany({})
    await col.insertMany(DOCS.map(d => ({ ...d, ...computeSearchFields(d, cfg) })))
    await createSearchIndexes(col, cfg)
  }
})
afterAll(async () => { await client?.close() })

async function serverMatches(patterns: string[], options?: any, key: ConfigKey = 'base'): Promise<string[]> {
  const col = client.db('qt_parity_test').collection(collectionName(key))
  const filter = buildTextSearchFilter('name', patterns, configs[key], options)
  const rows = await col.find(filter).toArray()
  return rows.map(r => r.name).sort()
}
function clientMatches(patterns: string[], options?: any): string[] {
  return DOCS.filter(d => matchItem(buildCorpus(d, ['name']), patterns, options))
    .map(d => d.name).sort()
}

describe('client↔server parity', () => {
  const cases: Array<{ patterns: string[]; options?: any; config?: ConfigKey }> = [
    { patterns: ['garcia'] },                          // diacritic + case insensitive
    { patterns: ['ng'] },                              // 2-char (bigram path)
    { patterns: ['cafe'] },                            // diacritic fold
    { patterns: ['garcia', 'marquez'] },               // multi-pattern AND
    { patterns: ['GARCIA'], options: { caseSensitive: true } }, // case-sensitive mode
    // Patterns that fold to '' constrain nothing: alone they match everything.
    { patterns: [''] },
    { patterns: ['\u0301\u0301\u0301'] },            // combining marks alone
    { patterns: ['garcia', '\u0301', ''] },           // mixed with a real pattern
    // No pattern long enough for an n-gram: still the client's answer.
    { patterns: ['z'] },                               // one letter
    { patterns: ['g', 'z'] },                          // one letter each, AND
    { patterns: ['e\u0301'] },                         // decomposed é, folds to 'e'
    { patterns: ['ng'], config: 'tri' },               // shorter than the smallest n-gram (3)
    { patterns: ['e\u0301'], options: { diacriticSensitive: true } }, // fully folded, only 'e'
    { patterns: ['\u0301'], options: { diacriticSensitive: true } },  // fully folded, empty
  ]
  for (const c of cases) {
    it(`parity: ${JSON.stringify(c)}`, async (ctx) => {
      if (!available) return ctx.skip()
      expect(await serverMatches(c.patterns, c.options, c.config)).toEqual(clientMatches(c.patterns, c.options))
    })
  }
})
