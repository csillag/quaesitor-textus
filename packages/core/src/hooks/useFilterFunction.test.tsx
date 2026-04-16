import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import React from 'react'
import { WithSearch } from '../context/WithSearch'
import { useFilterFunction } from './useFilterFunction'

interface Book {
  author: string
  title: string
}

const books: Book[] = [
  { author: 'Jane Austen', title: 'Pride and Prejudice' },
  { author: 'Leo Tolstoy', title: 'Anna Karenina' },
  { author: 'Charles Dickens', title: 'Oliver Twist' },
]

const makeWrapper = (authorQuery = '', titleQuery = '') =>
  ({ children }: { children: React.ReactNode }) => (
    <WithSearch name="author" mapping={(b: Book) => b.author} query={authorQuery} onSetQuery={() => {}}>
      <WithSearch name="title" mapping={(b: Book) => b.title} query={titleQuery} onSetQuery={() => {}}>
        {children}
      </WithSearch>
    </WithSearch>
  )

describe('useFilterFunction', () => {
  it('returns true for all items when no searches have patterns', () => {
    const { result } = renderHook(() => useFilterFunction<Book>(), {
      wrapper: makeWrapper(),
    })
    expect(books.every(result.current)).toBe(true)
  })

  it('AND mode: returns true when all active searches match', () => {
    const { result } = renderHook(() => useFilterFunction<Book>('AND'), {
      wrapper: makeWrapper('austen', ''),
    })
    expect(result.current(books[0])).toBe(true)
    expect(result.current(books[1])).toBe(false)
  })

  it('AND mode: returns false when any active search fails', () => {
    // author=austen, title=karenina — no book matches both
    const { result } = renderHook(() => useFilterFunction<Book>('AND'), {
      wrapper: makeWrapper('austen', 'karenina'),
    })
    expect(result.current(books[0])).toBe(false) // austen matches author but not title
    expect(result.current(books[1])).toBe(false) // karenina matches title but not author
  })

  it('AND mode is the default', () => {
    const { result } = renderHook(() => useFilterFunction<Book>(), {
      wrapper: makeWrapper('austen', ''),
    })
    expect(result.current(books[0])).toBe(true)
    expect(result.current(books[1])).toBe(false)
  })

  it('OR mode: returns true when at least one active search matches', () => {
    const { result } = renderHook(() => useFilterFunction<Book>('OR'), {
      wrapper: makeWrapper('austen', 'karenina'),
    })
    expect(result.current(books[0])).toBe(true)  // author matches 'austen'
    expect(result.current(books[1])).toBe(true)  // title matches 'karenina'
    expect(result.current(books[2])).toBe(false) // neither matches
  })

  it('OR mode: returns false when no active search matches', () => {
    const { result } = renderHook(() => useFilterFunction<Book>('OR'), {
      wrapper: makeWrapper('xyz', ''),
    })
    expect(books.some(result.current)).toBe(false)
  })

  it('entries with zero patterns are neutral in AND mode', () => {
    // title has no patterns — only author entry is active
    const { result } = renderHook(() => useFilterFunction<Book>('AND'), {
      wrapper: makeWrapper('austen', ''),
    })
    expect(result.current(books[0])).toBe(true)
    expect(result.current(books[1])).toBe(false)
  })

  it('entries with zero patterns are neutral in OR mode', () => {
    const { result } = renderHook(() => useFilterFunction<Book>('OR'), {
      wrapper: makeWrapper('austen', ''),
    })
    expect(result.current(books[0])).toBe(true)
    expect(result.current(books[1])).toBe(false)
  })

  it('uses mapping from the context entry', () => {
    const { result } = renderHook(() => useFilterFunction<Book>('AND'), {
      wrapper: makeWrapper('', 'pride'),
    })
    expect(result.current(books[0])).toBe(true)  // "Pride and Prejudice" matches 'pride'
    expect(result.current(books[1])).toBe(false)
  })

  it('returns true for all items when outside any WithSearch (empty map)', () => {
    const { result } = renderHook(() => useFilterFunction<Book>())
    expect(books.every(result.current)).toBe(true)
  })
})
