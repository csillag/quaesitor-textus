import { useContext, useMemo } from 'react'
import { SearchContext } from './SearchContext'
import { matchItem } from '../logic/matchItem'

export interface ItemOptions<T> {
  mapping?: (item: T) => string
}

export function useSearchContext<T = string>(itemOptions?: ItemOptions<T>) {
  const ctx = useContext(SearchContext)
  if (!ctx) {
    throw new Error('useSearchContext must be used within <WithSearch>')
  }
  const { query, setQuery, patterns, highlightedPatterns, hasPatterns, reset } = ctx
  const filterFunction = useMemo(
    () => {
      const mapping: (item: T) => string =
        itemOptions?.mapping ?? ((x: unknown) => x as string)
      return (item: T): boolean => matchItem(mapping(item), patterns)
    },
    [itemOptions?.mapping, patterns]
  )
  return { query, setQuery, patterns, highlightedPatterns, filterFunction, hasPatterns, reset }
}
