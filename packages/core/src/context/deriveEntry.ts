import { parseInput } from '../logic/parseInput'
import type { SearchOptions } from '../logic/types'
import type { SearchEntry } from './SearchContext'

/**
 * Build a SearchEntry from a query plus its wiring. Single source of truth for
 * pattern derivation and entry shape, shared by the single-search and
 * multi-search (`searches`) paths of WithSearch.
 */
export function deriveEntry(params: {
  query: string
  setQuery: (q: string) => void
  reset: () => void
  fields: string[]
  options?: SearchOptions
}): SearchEntry {
  const { query, setQuery, reset, fields, options } = params
  const patterns = parseInput(query, options ?? {})
  return {
    query,
    setQuery,
    patterns,
    hasPatterns: patterns.length > 0,
    reset,
    fields,
    options,
  }
}
