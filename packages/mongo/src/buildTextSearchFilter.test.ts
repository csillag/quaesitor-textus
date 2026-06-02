import { describe, it, expect } from 'vitest'
import { buildTextSearchFilter } from './buildTextSearchFilter'
import type { MongoSearchConfig } from './config'

const config: MongoSearchConfig = {
  targets: { author: { fields: ['author'], queryModes: [{ caseSensitive: true }] } },
}

describe('buildTextSearchFilter', () => {
  it('empty patterns match everything', () => {
    expect(buildTextSearchFilter('author', [], config)).toEqual({})
  })
  it('builds ngram $all + per-pattern verify regex (base mode)', () => {
    const f = buildTextSearchFilter('author', ['café'], config) as any
    const ngram = f.$and[0]['_qt.author.ngrams'].$all
    expect(ngram).toContain('ca')      // fully folded ngrams
    expect(f.$and[1]['_qt.author.norm'].$regex).toBe('cafe')
  })
  it('selects the case-sensitive verify field + folding', () => {
    const f = buildTextSearchFilter('author', ['Café'], config, { caseSensitive: true }) as any
    expect(f.$and[1]['_qt.author.norm_cs'].$regex).toBe('Cafe')
  })
  it('escapes regex metacharacters in the verify pattern', () => {
    const f = buildTextSearchFilter('author', ['a.b'], config) as any
    expect(f.$and[1]['_qt.author.norm'].$regex).toBe('a\\.b')
  })
  it('throws on unknown target', () => {
    expect(() => buildTextSearchFilter('nope', ['x'], config)).toThrow(/Unknown search target/)
  })
})
