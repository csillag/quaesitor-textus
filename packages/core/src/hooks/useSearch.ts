import { useState, useMemo } from 'react'
import { parseInput } from '../logic/parseInput'
import { matchItem } from '../logic/matchItem'
import type { SearchOptions } from '../logic/types'

export interface UseSearchResult<T> {
  query: string
  setQuery: (q: string) => void
  patterns: string[]
  filteredItems: T[]
}

export function useSearch<T>(
  items: T[],
  getCorpus: (item: T) => string,
  options?: SearchOptions
): UseSearchResult<T> {
  const [query, setQuery] = useState('')
  const { caseSensitive = false, diacriticSensitive = false, minLength = 2 } = options ?? {}

  const patterns = useMemo(
    () => parseInput(query, { caseSensitive, diacriticSensitive, minLength }),
    [query, caseSensitive, diacriticSensitive, minLength]
  )

  const filteredItems = useMemo(
    () => items.filter(item => matchItem(getCorpus(item), patterns, { caseSensitive, diacriticSensitive })),
    [items, patterns, getCorpus, caseSensitive, diacriticSensitive]
  )

  return { query, setQuery, patterns, filteredItems }
}
