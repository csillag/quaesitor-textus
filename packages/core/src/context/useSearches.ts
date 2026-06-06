import { useContext } from 'react'
import { SearchContext } from './SearchContext'
import type { SearchContextValue } from './SearchContext'

/**
 * Read the full map of named searches from the nearest `WithSearch` tree.
 *
 * Returns every entry keyed by name (`query`, `patterns`, `setQuery`, `reset`,
 * `fields`, …). This is the complement of `useFilterFunction`: instead of
 * filtering rows client-side, consumers can read the live search state to build
 * a server-side query (e.g. compile the patterns into a backend filter).
 *
 * Returns an empty object when no `WithSearch` is present in the tree.
 */
export function useSearches(): SearchContextValue {
  return useContext(SearchContext)
}
