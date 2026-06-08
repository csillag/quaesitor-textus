import { describe, it, expect } from 'vitest'
import { resolveMode } from './modes'
import type { MongoSearchConfig } from './config'

const config: MongoSearchConfig = {
  targets: {
    plain: { fields: ['a'] },
    cs: { fields: ['b'], options: { caseSensitive: true } },
  },
}

describe('resolveMode', () => {
  it('prefers explicit options', () => {
    expect(resolveMode(config, 'cs', { diacriticSensitive: true })).toEqual({ diacriticSensitive: true })
  })
  it('falls back to the target options', () => {
    expect(resolveMode(config, 'cs')).toEqual({ caseSensitive: true })
  })
  it('defaults to fully-folded {}', () => {
    expect(resolveMode(config, 'plain')).toEqual({})
  })
  it('defaults to {} for an unknown target', () => {
    expect(resolveMode(config, 'nope')).toEqual({})
  })
})
