import { useContext } from 'react'
import { SearchContext } from './SearchContext'

export function useSearchContext(name?: string) {
  const map = useContext(SearchContext)

  if (name === undefined) {
    const entries = Object.values(map)
    if (entries.length === 1) {
      const entry = entries[0]
      return {
        query: entry.query,
        setQuery: entry.setQuery,
        patterns: entry.patterns,
        hasPatterns: entry.hasPatterns,
        reset: entry.reset,
      }
    }
    if (entries.length === 0) {
      throw new Error('useSearchContext: no WithSearch found in the tree.')
    }
    throw new Error(
      `useSearchContext: found ${entries.length} searches in context; pass a name to select one.`
    )
  }

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
