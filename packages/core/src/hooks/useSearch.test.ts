import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSearch } from './useSearch'

const items = [
  { id: 1, name: 'Apple' },
  { id: 2, name: 'Banana' },
  { id: 3, name: 'Cherry' },
]

const getCorpus = (item: { name: string }) => item.name

describe('useSearch', () => {
  it('returns all items when query is empty', () => {
    const { result } = renderHook(() => useSearch(items, getCorpus))
    expect(result.current.filteredItems).toEqual(items)
  })

  it('returns all items when query is below minLength', () => {
    const { result } = renderHook(() => useSearch(items, getCorpus))
    act(() => result.current.setQuery('a'))
    expect(result.current.filteredItems).toEqual(items)
  })

  it('filters items by query', () => {
    const { result } = renderHook(() => useSearch(items, getCorpus))
    act(() => result.current.setQuery('an'))
    expect(result.current.filteredItems).toEqual([{ id: 2, name: 'Banana' }])
  })

  it('returns parsed patterns', () => {
    const { result } = renderHook(() => useSearch(items, getCorpus))
    act(() => result.current.setQuery('apple'))
    expect(result.current.patterns).toEqual(['apple'])
  })

  it('returns the current query string', () => {
    const { result } = renderHook(() => useSearch(items, getCorpus))
    act(() => result.current.setQuery('apple'))
    expect(result.current.query).toBe('apple')
  })

  it('returns empty patterns when query is below minLength', () => {
    const { result } = renderHook(() => useSearch(items, getCorpus))
    act(() => result.current.setQuery('a'))
    expect(result.current.patterns).toEqual([])
  })

  it('is case-insensitive by default', () => {
    const { result } = renderHook(() => useSearch(items, getCorpus))
    act(() => result.current.setQuery('APPLE'))
    expect(result.current.filteredItems).toEqual([{ id: 1, name: 'Apple' }])
  })
})
