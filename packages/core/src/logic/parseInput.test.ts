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

  it('returns all patterns when multiple patterns are present, regardless of length', () => {
    // minLength check only applies when there is exactly one pattern
    expect(parseInput('f b')).toEqual(['f', 'b'])
  })

  it('respects custom minLength option', () => {
    expect(parseInput('f', { minLength: 1 })).toEqual(['f'])
    expect(parseInput('f', { minLength: 3 })).toEqual([])
    expect(parseInput('fo', { minLength: 3 })).toEqual([])
    expect(parseInput('foo', { minLength: 3 })).toEqual(['foo'])
  })

  it('deduplicates repeated patterns', () => {
    expect(parseInput('foo foo')).toEqual(['foo'])
    expect(parseInput('foo bar foo')).toEqual(['foo', 'bar'])
  })
})
