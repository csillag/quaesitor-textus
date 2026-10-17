import { describe, it, expect } from 'vitest'
import { parseInput } from './parseInput'

describe('parseInput', () => {
  it('returns empty array for empty string', () => {
    expect(parseInput('')).toEqual([])
  })

  it('returns empty array for whitespace only', () => {
    expect(parseInput('   ')).toEqual([])
  })

  it('splits on spaces', () => {
    expect(parseInput('foo bar')).toEqual(['foo', 'bar'])
  })

  it('handles multiple consecutive spaces', () => {
    expect(parseInput('foo  bar')).toEqual(['foo', 'bar'])
  })

  it('does not split on commas', () => {
    expect(parseInput('foo,bar')).toEqual(['foo,bar'])
  })

  it('trims leading and trailing whitespace', () => {
    expect(parseInput('  foo  ')).toEqual(['foo'])
  })

  it('returns empty array for single pattern shorter than default minLength (2)', () => {
    expect(parseInput('f')).toEqual([])
  })

  it('returns pattern when single pattern meets minLength', () => {
    expect(parseInput('fo')).toEqual(['fo'])
  })

  it('returns empty array when no pattern meets minLength, even with multiple patterns', () => {
    expect(parseInput('f b')).toEqual([])
  })

  it('returns all patterns when at least one meets minLength', () => {
    expect(parseInput('foo a')).toEqual(['foo', 'a'])
  })

  it('respects custom minLength option', () => {
    expect(parseInput('f', { minLength: 1 })).toEqual(['f'])
    expect(parseInput('f', { minLength: 3 })).toEqual([])
    expect(parseInput('fo', { minLength: 3 })).toEqual([])
    expect(parseInput('foo', { minLength: 3 })).toEqual(['foo'])
  })

  it('returns all patterns when at least one meets custom minLength', () => {
    expect(parseInput('foobar a', { minLength: 4 })).toEqual(['foobar', 'a'])
    expect(parseInput('foo bar', { minLength: 4 })).toEqual([])
  })

  it('deduplicates repeated patterns', () => {
    expect(parseInput('foo foo')).toEqual(['foo'])
    expect(parseInput('foo bar foo')).toEqual(['foo', 'bar'])
  })

  describe('a word that normalises to the empty string is dropped', () => {
    it('drops combining marks alone, which fold away when diacritic-insensitive', () => {
      expect(parseInput('\u0301\u0301\u0301')).toEqual([])
    })

    it('keeps the other words of the query', () => {
      expect(parseInput('foo \u0301\u0301\u0301 bar')).toEqual(['foo', 'bar'])
    })

    it('cannot lift the short words of the query over minLength', () => {
      expect(parseInput('a \u0301\u0301\u0301')).toEqual([])
    })

    it('is empty only after folding: diacritic-sensitive, combining marks are a word', () => {
      expect(parseInput('\u0301\u0301\u0301', { diacriticSensitive: true })).toEqual([
        '\u0301\u0301\u0301',
      ])
    })
  })

  describe('minLength counts the normalised word, as matchItem compares it', () => {
    it('a decomposed letter that folds to one character is below the default minLength', () => {
      // 'e' + combining acute: two code units typed, 'e' searched.
      expect(parseInput('e\u0301')).toEqual([])
    })

    it('a letter that folds to two characters reaches the default minLength', () => {
      // 'ß' is searched as 'ss'.
      expect(parseInput('ß')).toEqual(['ß'])
    })

    it('diacritic-sensitive, the combining mark stays and counts', () => {
      expect(parseInput('e\u0301', { diacriticSensitive: true })).toEqual(['e\u0301'])
    })

    it('returns the words as typed, not normalised', () => {
      expect(parseInput('Straße É')).toEqual(['Straße', 'É'])
    })
  })
})
