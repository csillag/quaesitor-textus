import { useContext } from 'react'
import { SearchContext, DEFAULT_SEARCH_NAME } from './SearchContext'

export function useSearchContext(name: string = DEFAULT_SEARCH_NAME) {
  const map = useContext(SearchContext)
  const entry = map[name]
  if (!entry) {
    throw new Error(
      `useSearchContext: no WithSearch with name "${name}" found in the tree.`
    )
  }
  return {
    query: entry.query,
    setQuery: entry.setQuery,
    patterns: entry.patterns,
    hasPatterns: entry.hasPatterns,
    reset: entry.reset,
  }
}
