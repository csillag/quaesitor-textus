import { describe, it, expect } from 'vitest'
import { matchItem } from './matchItem'

describe('matchItem', () => {
  it('returns true when single pattern matches', () => {
    expect(matchItem('hello world', ['hello'])).toBe(true)
  })

  it('returns false when pattern does not match', () => {
    expect(matchItem('hello world', ['xyz'])).toBe(false)
  })

  it('returns true only when all patterns match (AND logic)', () => {
    expect(matchItem('hello world', ['hello', 'world'])).toBe(true)
    expect(matchItem('hello world', ['hello', 'xyz'])).toBe(false)
  })

  it('returns true for empty patterns array (filter inactive)', () => {
    expect(matchItem('hello world', [])).toBe(true)
  })

  it('is case-insensitive by default', () => {
    expect(matchItem('Hello World', ['hello'])).toBe(true)
    expect(matchItem('hello world', ['HELLO'])).toBe(true)
  })

  it('is diacritic-insensitive by default', () => {
    expect(matchItem('héllo', ['hello'])).toBe(true)
    expect(matchItem('hello', ['héllo'])).toBe(true)
  })

  it('order of patterns does not matter', () => {
    expect(matchItem('hello world', ['world', 'hello'])).toBe(true)
  })

  it('allows overlapping matches', () => {
    expect(matchItem('abcabc', ['abc', 'bca'])).toBe(true)
  })

  it('respects caseSensitive option', () => {
    expect(matchItem('Hello', ['hello'], { caseSensitive: true })).toBe(false)
    expect(matchItem('Hello', ['Hello'], { caseSensitive: true })).toBe(true)
  })

  it('respects diacriticSensitive option', () => {
    expect(matchItem('héllo', ['hello'], { diacriticSensitive: true })).toBe(false)
    expect(matchItem('héllo', ['héllo'], { diacriticSensitive: true })).toBe(true)
  })

  describe('a pattern that normalises to the empty string constrains nothing', () => {
    it('matches every text when it is the only pattern, like an empty patterns array', () => {
      expect(matchItem('hello world', [''])).toBe(true)
      expect(matchItem('', [''])).toBe(true)
    })

    it('matches every text when combining marks alone are the only pattern', () => {
      // Diacritic-insensitive by default: the marks fold away and nothing is left.
      expect(matchItem('hello world', ['\u0301\u0301\u0301'])).toBe(true)
    })

    it('leaves the decision to the other patterns of the call', () => {
      expect(matchItem('hello world', ['\u0301', 'world', ''])).toBe(true)
      expect(matchItem('hello world', ['\u0301', 'xyz', ''])).toBe(false)
    })

    it('is empty only after folding: diacritic-sensitive, a combining mark is a pattern', () => {
      expect(matchItem('hello', ['\u0301'], { diacriticSensitive: true })).toBe(false)
      expect(matchItem('he\u0301llo', ['\u0301'], { diacriticSensitive: true })).toBe(true)
    })
  })
})
