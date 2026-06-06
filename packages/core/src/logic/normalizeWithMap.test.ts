import { describe, it, expect } from 'vitest'
import { normalizeWithMap } from './normalizeWithMap'

describe('normalizeWithMap', () => {
  it('maps each normalized char back to its originating original index for an expanding fold', () => {
    // 'Straße' (6 chars) → 'strasse' (7 chars). ß at original index 4 expands to
    // two 's' chars, both originating from index 4. The end sentinel = 6.
    const { normalized, map } = normalizeWithMap('Straße')
    expect(normalized).toBe('strasse')
    expect(map).toEqual([0, 1, 2, 3, 4, 4, 5, 6])
  })
})
