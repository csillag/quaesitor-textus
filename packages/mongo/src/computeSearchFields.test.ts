import { describe, it, expect } from 'vitest'
import { computeSearchFields } from './computeSearchFields'
import type { MongoSearchConfig } from './config'

const config: MongoSearchConfig = {
  targets: {
    author: { fields: ['author'], queryModes: [{ caseSensitive: true }] },
  },
}

describe('computeSearchFields', () => {
  it('stores fully-folded ngrams and per-mode verify strings', () => {
    const out = computeSearchFields({ author: 'Café' }, config) as any
    expect(out._qt.author.norm).toBe('cafe')        // folded: diacritics stripped + lowercased
    expect(out._qt.author.norm_cs).toBe('Cafe')     // case-sensitive: diacritics stripped, case kept
    expect(out._qt.author.ngrams).toContain('ca')
    expect(out._qt.author.ngrams).toContain('caf')
  })
  it('respects a custom namespace', () => {
    const out = computeSearchFields({ author: 'x' }, { namespace: 'qt', targets: config.targets }) as any
    expect(out.qt.author).toBeDefined()
  })
})
