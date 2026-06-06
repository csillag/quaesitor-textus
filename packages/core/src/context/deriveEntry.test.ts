import { describe, it, expect, vi } from 'vitest'
import { deriveEntry } from './deriveEntry'

describe('deriveEntry', () => {
  it('derives patterns from the query and reports hasPatterns', () => {
    const entry = deriveEntry({
      query: 'war peace',
      setQuery: () => {},
      reset: () => {},
      fields: ['title'],
    })
    expect(entry.patterns).toEqual(['war', 'peace'])
    expect(entry.hasPatterns).toBe(true)
    expect(entry.fields).toEqual(['title'])
  })

  it('produces no patterns and hasPatterns=false for a sub-minLength query', () => {
    const entry = deriveEntry({
      query: 'a',
      setQuery: () => {},
      reset: () => {},
      fields: ['$'],
    })
    expect(entry.patterns).toEqual([])
    expect(entry.hasPatterns).toBe(false)
  })

  it('passes options through to parseInput (minLength override)', () => {
    const entry = deriveEntry({
      query: 'a',
      setQuery: () => {},
      reset: () => {},
      fields: ['$'],
      options: { minLength: 1 },
    })
    expect(entry.patterns).toEqual(['a'])
    expect(entry.hasPatterns).toBe(true)
    expect(entry.options).toEqual({ minLength: 1 })
  })

  it('wires setQuery and reset straight through', () => {
    const setQuery = vi.fn()
    const reset = vi.fn()
    const entry = deriveEntry({ query: '', setQuery, reset, fields: ['$'] })
    entry.setQuery('x')
    entry.reset()
    expect(setQuery).toHaveBeenCalledWith('x')
    expect(reset).toHaveBeenCalled()
  })
})
