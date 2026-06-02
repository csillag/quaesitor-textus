import { describe, it, expect } from 'vitest'
import { normalizeText } from './normalizeText'

describe('normalizeText', () => {
  it('lowercases by default', () => {
    expect(normalizeText('Hello World')).toBe('hello world')
  })

  it('removes diacritics by default', () => {
    expect(normalizeText('é')).toBe('e')
    expect(normalizeText('ñ')).toBe('n')
    expect(normalizeText('ü')).toBe('u')
    expect(normalizeText('Héllo')).toBe('hello')
  })

  it('preserves case when caseSensitive: true', () => {
    expect(normalizeText('Hello', { caseSensitive: true })).toBe('Hello')
  })

  it('preserves diacritics when diacriticSensitive: true', () => {
    expect(normalizeText('é', { diacriticSensitive: true })).toBe('é')
    expect(normalizeText('Héllo', { diacriticSensitive: true })).toBe('héllo')
  })

  it('respects both flags combined', () => {
    expect(
      normalizeText('Héllo', { caseSensitive: true, diacriticSensitive: true })
    ).toBe('Héllo')
  })

  it('folds Hungarian double-acute vowels (combining marks) by default', () => {
    expect(normalizeText('árvíztűrő')).toBe('arvizturo')
    expect(normalizeText('Petőfi')).toBe('petofi')
  })

  it('folds precomposed/stroke letters NFD leaves intact', () => {
    expect(normalizeText('Wisława')).toBe('wislawa')
    expect(normalizeText('Søren')).toBe('soren')
    expect(normalizeText('straße')).toBe('strasse')
    expect(normalizeText('Weiß')).toBe('weiss')
    expect(normalizeText('æsop')).toBe('aesop')
    expect(normalizeText('Œuvre')).toBe('oeuvre')
    expect(normalizeText('Þór')).toBe('thor')
    expect(normalizeText('Đặng')).toBe('dang')
  })

  it('folds special letters but keeps case when caseSensitive: true', () => {
    expect(normalizeText('Wisława', { caseSensitive: true })).toBe('Wislawa')
  })

  it('does not fold special letters when diacriticSensitive: true', () => {
    expect(normalizeText('Wisława', { diacriticSensitive: true })).toBe('wisława')
    expect(normalizeText('straße', { diacriticSensitive: true })).toBe('straße')
  })

  it('returns empty string unchanged', () => {
    expect(normalizeText('')).toBe('')
  })
})
