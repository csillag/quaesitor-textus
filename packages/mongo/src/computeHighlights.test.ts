import { describe, it, expect } from 'vitest'
import { computeHighlights } from './computeHighlights'
import type { HighlightSpec } from './computeHighlights'
import type { MongoSearchConfig } from './config'

const config: MongoSearchConfig = {
  targets: {
    author: { fields: ['author'] },
    title: { fields: ['title'], queryModes: [{ caseSensitive: true }] },
    meta: { fields: ['author', 'title'] },
  },
}
const spec = (target: string, patterns: string[], options?: any): HighlightSpec => ({ target, patterns, options })

describe('computeHighlights', () => {
  it('flags a single-field target whose stored folded text contains the folded token', () => {
    const doc = { author: 'Tolstoy', _qt: { author: { norm: 'tolstoy' } } }
    expect(computeHighlights([spec('author', ['Tolst'])], doc, config)).toEqual({
      author: { tokens: ['tolst'], fields: ['author'] },
    })
  })

  it('omits a target whose token is absent', () => {
    const doc = { author: 'Tolstoy', _qt: { author: { norm: 'tolstoy' } } }
    expect(computeHighlights([spec('author', ['dostoy'])], doc, config)).toEqual({})
  })

  it('marks all fields of a multi-field target (fallback) when the corpus matches', () => {
    const doc = { author: 'Tolstoy', title: 'War', _qt: { meta: { norm: 'tolstoy war' } } }
    expect(computeHighlights([spec('meta', ['war'])], doc, config)).toEqual({
      meta: { tokens: ['war'], fields: ['author', 'title'] },
    })
  })

  it('refolds from raw fields when the stored folded text is absent (fallback)', () => {
    const doc = { title: 'Weiß' } // no _qt projected; ß→ss folding must still match
    expect(computeHighlights([spec('title', ['weiss'])], doc, config)).toEqual({
      title: { tokens: ['weiss'], fields: ['title'] },
    })
  })

  it('builds entries for multiple specs (compound query)', () => {
    const doc = { author: 'Tolstoy', title: 'War', _qt: { author: { norm: 'tolstoy' }, title: { norm: 'war' } } }
    expect(computeHighlights([spec('author', ['tolst']), spec('title', ['war'])], doc, config)).toEqual({
      author: { tokens: ['tolst'], fields: ['author'] },
      title: { tokens: ['war'], fields: ['title'] },
    })
  })

  it('uses the per-spec options to select the verify mode (case-sensitive)', () => {
    // caseSensitive mode reads _qt.title.norm_cs and does not lowercase the token.
    const doc = { title: 'War', _qt: { title: { norm: 'war', norm_cs: 'War' } } }
    expect(computeHighlights([spec('title', ['War'], { caseSensitive: true })], doc, config)).toEqual({
      title: { tokens: ['War'], fields: ['title'] },
    })
    // The same token folded to the default mode would NOT match norm_cs.
    expect(computeHighlights([spec('title', ['war'], { caseSensitive: true })], doc, config)).toEqual({})
  })

  it('ignores specs for unknown targets', () => {
    const doc = { author: 'Tolstoy', _qt: { author: { norm: 'tolstoy' } } }
    expect(computeHighlights([spec('nope', ['x'])], doc, config)).toEqual({})
  })
})
