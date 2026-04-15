import { useMemo } from 'react'
import { matchItem } from '../logic/matchItem'
import type { SearchOptions } from '../logic/types'
import { useSearchInternalState } from './useSearchInternalState'

export interface UseSearchResult<T> {
  query: string
  setQuery: (q: string) => void
  patterns: string[]
  filteredItems: T[]
  hasPatterns: boolean
  reset: () => void
}

/**
 * A self-contained hook for text search and filtering.
 *
 * @param items - The items to filter.
 * @param getCorpus - Function that extracts the searchable text from an item.
 *   Pass a stable reference (e.g. wrap with `useCallback`) to avoid
 *   recomputing `filteredItems` on every render.
 * @param options - Optional search configuration.
 * @param onChange - Optional callback fired on every query change with (oldValue, newValue).
 */
export function useSearch<T>(
  items: T[],
  getCorpus: (item: T) => string,
  options?: SearchOptions,
  onChange?: (oldValue: string, newValue: string) => void
): UseSearchResult<T> {
  const { caseSensitive = false, diacriticSensitive = false } = options ?? {}

  const { query, setQuery, patterns, hasPatterns, reset } = useSearchInternalState({
    options,
    onChange,
  })

  const filteredItems = useMemo(
    () => items.filter(item => matchItem(getCorpus(item), patterns, { caseSensitive, diacriticSensitive })),
    [items, patterns, getCorpus, caseSensitive, diacriticSensitive]
  )

  return { query, setQuery, patterns, filteredItems, hasPatterns, reset }
}
