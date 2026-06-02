import { describe, it, expect } from 'vitest'
import { modeKey, targetModes, escapeRegex } from './modes'

describe('modeKey', () => {
  it('base mode is norm', () => { expect(modeKey()).toBe('norm'); expect(modeKey({})).toBe('norm') })
  it('case-sensitive', () => { expect(modeKey({ caseSensitive: true })).toBe('norm_cs') })
  it('diacritic-sensitive', () => { expect(modeKey({ diacriticSensitive: true })).toBe('norm_ds') })
  it('both', () => { expect(modeKey({ caseSensitive: true, diacriticSensitive: true })).toBe('norm_cs_ds') })
})
describe('targetModes', () => {
  it('includes base + queryModes, deduped', () => {
    const modes = targetModes({ fields: ['a'], queryModes: [{ caseSensitive: true }, {}] })
    expect(modes.map(modeKey)).toEqual(['norm', 'norm_cs'])
  })
})
describe('escapeRegex', () => {
  it('escapes regex metacharacters', () => {
    expect(escapeRegex('a.*b')).toBe('a\\.\\*b')
  })
})
