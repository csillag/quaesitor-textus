import { createContext } from 'react'
import type { SearchOptions } from '../logic/types'

export const DEFAULT_SEARCH_NAME = 'default search'

export interface SearchEntry {
  query: string
  setQuery: (q: string) => void
  patterns: string[]
  hasPatterns: boolean
  reset: () => void
  fields: string[]
  options?: SearchOptions
}

export type SearchContextValue = Record<string, SearchEntry>

export const SearchContext = createContext<SearchContextValue>({})
