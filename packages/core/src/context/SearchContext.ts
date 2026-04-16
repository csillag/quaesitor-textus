import { createContext } from 'react'

export interface SearchContextValue {
  query: string
  setQuery: (q: string) => void
  patterns: string[]
  highlightedPatterns: string[]
  hasPatterns: boolean
  reset: () => void
}

export const SearchContext = createContext<SearchContextValue | null>(null)
