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

  it('returns empty string unchanged', () => {
    expect(normalizeText('')).toBe('')
  })
})
