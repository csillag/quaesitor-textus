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

  describe('a pattern that folds to the empty string constrains nothing, as in matchItem', () => {
    it('matches everything when every pattern folds to the empty string', () => {
      expect(buildTextSearchFilter('author', [''], config)).toEqual({})
      expect(buildTextSearchFilter('author', ['\u0301\u0301\u0301'], config)).toEqual({})
    })

    it('is dropped and leaves the other patterns to decide', () => {
      expect(buildTextSearchFilter('author', ['café', '\u0301', ''], config)).toEqual(
        buildTextSearchFilter('author', ['café'], config),
      )
    })

    it('is empty only after folding with the query mode: diacritic-sensitive, a combining mark is a pattern', () => {
      expect(buildTextSearchFilter('author', ['\u0301'], config, { diacriticSensitive: true })).toEqual({
        $and: [{ '_qt.author.norm_ds': { $regex: '\u0301' } }],
      })
    })
  })

  describe('patterns too short for an n-gram are verified without the n-gram pre-filter', () => {
    it('leaves out $all when no pattern yields an n-gram', () => {
      expect(buildTextSearchFilter('author', ['x', 'y'], config)).toEqual({
        $and: [{ '_qt.author.norm': { $regex: 'x' } }, { '_qt.author.norm': { $regex: 'y' } }],
      })
    })

    it('measures the patterns against the configured n-gram sizes', () => {
      const tri: MongoSearchConfig = { ngramSizes: [3], targets: config.targets }
      expect(buildTextSearchFilter('author', ['ng'], tri)).toEqual({
        $and: [{ '_qt.author.norm': { $regex: 'ng' } }],
      })
    })

    it('keeps $all when at least one pattern yields an n-gram', () => {
      const f = buildTextSearchFilter('author', ['ng', 'w'], config) as any
      expect(f.$and[0]).toEqual({ '_qt.author.ngrams': { $all: ['ng'] } })
      expect(f.$and).toHaveLength(3)
    })
  })
})
