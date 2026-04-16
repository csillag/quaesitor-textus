import { createContext } from 'react'
import type { SearchOptions } from '../logic/types'

export const DEFAULT_SEARCH_NAME = 'default search'

export interface SearchEntry<T = unknown> {
  query: string
  setQuery: (q: string) => void
  patterns: string[]
  hasPatterns: boolean
  reset: () => void
  mapping: (item: T) => string
  options?: SearchOptions
}

export type SearchContextValue = Record<string, SearchEntry<unknown>>

export const SearchContext = createContext<SearchContextValue>({})
