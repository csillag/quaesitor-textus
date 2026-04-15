import { createContext } from 'react'

export interface SearchContextValue {
  query: string
  setQuery: (q: string) => void
  patterns: string[]
  executeSearch: <T>(items: T[], getCorpus: (item: T) => string) => T[]
  hasPatterns: boolean
  reset: () => void
}

export const SearchContext = createContext<SearchContextValue | null>(null)
