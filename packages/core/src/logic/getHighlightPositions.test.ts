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

  it('matches a diacritic-insensitive pattern against plain text', () => {
    // 'héllo' normalizes to 'hello' and matches 'hello' (both 5 chars); start=0, end=5
    expect(getHighlightPositions('hello world', ['héllo'])).toEqual([
      { start: 0, end: 5 },
    ])
  })

  it('maps spans back to original indices when an expanding fold precedes the match', () => {
    // 'Straße Gasse': ß→ss makes normalized text one char longer, so the match
    // for 'gasse' sits at normalized index 8 but original index 7. Spans index
    // the ORIGINAL text, so we expect { start: 7, end: 12 } — 'Gasse'.
    expect(getHighlightPositions('Straße Gasse', ['gasse'])).toEqual([
      { start: 7, end: 12 },
    ])
  })

  it('ends the span at the original match length, not the raw pattern length', () => {
    // User types the expanded form 'strasse' (7 chars) to find original 'Straße'
    // (6 chars). The span must cover the 6 original chars, not 7.
    expect(getHighlightPositions('Straße', ['strasse'])).toEqual([
      { start: 0, end: 6 },
    ])
  })

  it('returns multiple spans when a pattern appears more than once', () => {
    const result = getHighlightPositions('the cat and the dog', ['the'])
    expect(result).toEqual([
      { start: 0, end: 3 },
      { start: 12, end: 15 },
    ])
  })
})
