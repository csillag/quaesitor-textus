import { createContext } from 'react'

export interface SearchContextValue {
  query: string
  setQuery: (q: string) => void
  patterns: string[]
  executeSearch: <T>(items: T[], getCorpus: (item: T) => string) => T[]
}

export const SearchContext = createContext<SearchContextValue | null>(null)
