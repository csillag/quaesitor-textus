import { describe, it, expect } from 'vitest'
import { getHighlightPositions } from './getHighlightPositions'

describe('getHighlightPositions', () => {
  it('returns empty array for empty patterns', () => {
    expect(getHighlightPositions('hello world', [])).toEqual([])
  })

  it('returns correct span for a single match', () => {
    expect(getHighlightPositions('hello world', ['hello'])).toEqual([
      { start: 0, end: 5 },
    ])
  })

  it('returns correct span for a match not at position 0', () => {
    expect(getHighlightPositions('hello world', ['world'])).toEqual([
      { start: 6, end: 11 },
    ])
  })

  it('returns spans sorted by start position', () => {
    expect(getHighlightPositions('hello world', ['world', 'hello'])).toEqual([
      { start: 0, end: 5 },
      { start: 6, end: 11 },
    ])
  })

  it('discards overlapping spans (later span discarded if it overlaps with earlier)', () => {
    // 'abc' matches 0–3, 'bcd' matches 1–4 — 'bcd' overlaps, discarded
    expect(getHighlightPositions('abcde', ['abc', 'bcd'])).toEqual([
      { start: 0, end: 3 },
    ])
  })

  it('returns empty array when no pattern matches', () => {
    expect(getHighlightPositions('hello', ['xyz'])).toEqual([])
  })

  it('is case-insensitive by default', () => {
    expect(getHighlightPositions('Hello World', ['hello'])).toEqual([
      { start: 0, end: 5 },
    ])
  })

  it('is diacritic-insensitive by default', () => {
    // 'é' normalizes to 'e'; match found at position 0 in 'élan', raw pattern 'el' has length 2
    expect(getHighlightPositions('élan', ['el'])).toEqual([
      { start: 0, end: 2 },
    ])
  })

  it('skips patterns that do not match', () => {
    expect(getHighlightPositions('hello world', ['hello', 'xyz'])).toEqual([
      { start: 0, end: 5 },
    ])
  })

  it('end position uses raw (un-normalized) pattern length', () => {
    // 'héllo' raw length is 5; normalized to 'hello' which is 5 chars; start=0, end=5
    expect(getHighlightPositions('hello world', ['héllo'])).toEqual([
      { start: 0, end: 5 },
    ])
  })
})
