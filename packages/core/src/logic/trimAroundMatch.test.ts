import { describe, it, expect } from 'vitest'
import { trimAroundMatch } from './trimAroundMatch'

describe('trimAroundMatch', () => {
  it('returns text unchanged when shorter than fragmentLength', () => {
    expect(trimAroundMatch('hello', ['h'], { fragmentLength: 10 })).toBe('hello')
  })

  it('returns text unchanged when exactly equal to fragmentLength', () => {
    expect(trimAroundMatch('hello', ['h'], { fragmentLength: 5 })).toBe('hello')
  })

  it('truncates from start with trailing ellipsis when no match found', () => {
    expect(trimAroundMatch('abcdefghijklmno', ['zzz'], { fragmentLength: 5 })).toBe('abcde…')
  })

  it('truncates from start with trailing ellipsis when patterns are empty', () => {
    expect(trimAroundMatch('abcdefghijklmno', [], { fragmentLength: 5 })).toBe('abcde…')
  })

  it('returns fragment with no leading ellipsis when match is near the start', () => {
    // 'hello world' (11), pattern 'hello' at 0–5, fragmentLength=8
    // buffer=3, idealStart=-1, startPos=0, endPos=8 → 'hello wo…'
    expect(trimAroundMatch('hello world', ['hello'], { fragmentLength: 8 })).toBe('hello wo…')
  })

  it('returns fragment with no trailing ellipsis when match is near the end', () => {
    // 'hello world' (11), pattern 'world' at 6–11, fragmentLength=8
    // buffer=3, idealStart=5, startPos=3, endPos=11 → '…lo world'
    expect(trimAroundMatch('hello world', ['world'], { fragmentLength: 8 })).toBe('…lo world')
  })

  it('returns fragment with both ellipses when match is in the middle', () => {
    // 'aaaaabcdeaaaaa' (14), pattern 'bcd' at 5–8, fragmentLength=5
    // buffer=2, idealStart=4, startPos=4, endPos=9 → '…abcde…'
    expect(trimAroundMatch('aaaaabcdeaaaaa', ['bcd'], { fragmentLength: 5 })).toBe('…abcde…')
  })

  it('uses default fragmentLength of 80 when not specified', () => {
    const text = 'x'.repeat(100)
    const result = trimAroundMatch(text, [])
    // no match → first 80 chars + ellipsis
    expect(result).toBe('x'.repeat(80) + '…')
  })

  it('shows the first match when the matches lie further apart than the fragment', () => {
    // matches at 0–4 and 34–38, fragmentLength=10: centring on both would show only dots
    const text = 'sark' + '.'.repeat(30) + 'sark'
    expect(trimAroundMatch(text, ['sark'], { fragmentLength: 10 })).toBe('sark' + '.'.repeat(6) + '…')
  })

  it('centres on the most matches that fit in one fragment', () => {
    // 'ab' at 0, 22 and 25; fragmentLength=9 fits the last two (22–27): window 20–29
    const text = 'ab' + '.'.repeat(20) + 'ab.ab' + '.'.repeat(20)
    expect(trimAroundMatch(text, ['ab'], { fragmentLength: 9 })).toBe('…..ab.ab..…')
  })

  it('starts at a match that is longer than the fragment', () => {
    expect(trimAroundMatch('....abcdefgh....', ['abcdefgh'], { fragmentLength: 5 })).toBe('…abcde…')
  })

  it('keeps an accent-insensitive match in view when another one is far away', () => {
    const text = 'A sárkány, ' + 'x'.repeat(200) + ' sárkány'
    expect(trimAroundMatch(text, ['sark'], { fragmentLength: 40 }).startsWith('A sárkány')).toBe(true)
  })

  it('is case-insensitive by default when locating the trim window', () => {
    // 'hello world' (11), pattern 'HELLO', fragmentLength=8
    // same window as lowercase: 'hello wo…'
    expect(trimAroundMatch('hello world', ['HELLO'], { fragmentLength: 8 })).toBe('hello wo…')
  })
})
