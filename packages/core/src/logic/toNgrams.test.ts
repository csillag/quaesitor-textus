import { describe, it, expect } from 'vitest'
import { toNgrams } from './toNgrams'

describe('toNgrams', () => {
  it('produces bigrams and trigrams by default', () => {
    expect(toNgrams('hello')).toEqual(['he','el','ll','lo','hel','ell','llo'])
  })
  it('dedups repeated grams', () => {
    expect(toNgrams('aaa', [2])).toEqual(['aa'])
  })
  it('handles 2-char text (bigram only, no trigram)', () => {
    expect(toNgrams('ng')).toEqual(['ng'])
  })
  it('returns empty for text shorter than smallest size', () => {
    expect(toNgrams('a')).toEqual([])
  })
  it('respects custom sizes', () => {
    expect(toNgrams('abcd', [3])).toEqual(['abc','bcd'])
  })
})
