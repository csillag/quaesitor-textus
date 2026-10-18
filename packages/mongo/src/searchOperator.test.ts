import { describe, it, expect } from 'vitest'
import { searchOperator } from './searchOperator'
import { buildTextSearchFilter } from './buildTextSearchFilter'
import type { MongoSearchConfig } from './config'

const config: MongoSearchConfig = {
  targets: {
    text: { fields: ['text'] },
    title: { fields: ['title'], queryModes: [{ caseSensitive: true }] },
  },
}

describe('searchOperator', () => {
  it('equals buildTextSearchFilter for the same target and patterns', () => {
    const op = searchOperator(config)
    expect(op('text', ['alma', 'körte'])).toEqual(
      buildTextSearchFilter('text', ['alma', 'körte'], config),
    )
    expect(op('title', ['alma', 'körte'])).toEqual(
      buildTextSearchFilter('title', ['alma', 'körte'], config),
    )
  })
  it('answers {} for no patterns', () => {
    expect(searchOperator(config)('text', [])).toEqual({})
  })
  it('throws a TypeError for a value that is not an array of strings', () => {
    // The message pins the guard: without it 'alma' fails on `.map` and [1]
    // yields {} (every document).
    const op = searchOperator(config)
    for (const value of ['alma', [1]]) {
      expect(() => op('text', value)).toThrow(TypeError)
      expect(() => op('text', value)).toThrow(/array of strings/)
    }
  })
})
