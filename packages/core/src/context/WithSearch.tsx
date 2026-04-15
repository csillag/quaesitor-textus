import React, { useMemo } from 'react'
import { SearchContext } from './SearchContext'
import type { SearchContextValue } from './SearchContext'
import { matchItem } from '../logic/matchItem'
import type { SearchOptions } from '../logic/types'
import { useSearchInternalState } from '../hooks/useSearchInternalState'

export interface WithSearchProps {
  options?: SearchOptions
  children: React.ReactNode
  query?: string
  onSetQuery?: (q: string) => void
  onReset?: () => void
}

export function WithSearch({
  options,
  children,
  query: controlledQuery,
  onSetQuery,
  onReset,
}: WithSearchProps) {
  const { caseSensitive = false, diacriticSensitive = false } = options ?? {}

  const { query, setQuery, patterns, hasPatterns, reset } = useSearchInternalState({
    options,
    query: controlledQuery,
    onSetQuery,
    onReset,
  })

  const executeSearch = useMemo(
    (): SearchContextValue['executeSearch'] =>
      function executeSearch<T>(items: T[], getCorpus: (item: T) => string): T[] {
        return items.filter(item =>
          matchItem(getCorpus(item), patterns, { caseSensitive, diacriticSensitive })
        )
      },
    [patterns, caseSensitive, diacriticSensitive]
  )

  const value: SearchContextValue = useMemo(
    () => ({ query, setQuery, patterns, executeSearch, hasPatterns, reset }),
    [query, setQuery, patterns, executeSearch, hasPatterns, reset]
  )

  return <SearchContext.Provider value={value}>{children}</SearchContext.Provider>
}
