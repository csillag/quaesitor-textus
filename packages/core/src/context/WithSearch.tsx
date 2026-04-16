import React, { useContext, useMemo } from 'react'
import { SearchContext } from './SearchContext'
import type { SearchContextValue } from './SearchContext'
import type { SearchOptions } from '../logic/types'
import { useSearchInternalState } from '../hooks/useSearchInternalState'

export interface WithSearchProps {
  options?: SearchOptions
  children: React.ReactNode
  query?: string
  onSetQuery?: (q: string) => void
  onReset?: () => void
  onChange?: (oldValue: string, newValue: string) => void
}

export function WithSearch({
  options,
  children,
  query: controlledQuery,
  onSetQuery,
  onReset,
  onChange,
}: WithSearchProps) {
  const { query, setQuery, patterns, hasPatterns, reset } = useSearchInternalState({
    options,
    query: controlledQuery,
    onSetQuery,
    onReset,
    onChange,
  })

  const upstreamCtx = useContext(SearchContext)

  const highlightedPatterns = useMemo(
    () => [...new Set([...(upstreamCtx?.highlightedPatterns ?? []), ...patterns])],
    [upstreamCtx?.highlightedPatterns, patterns]
  )

  const value: SearchContextValue = useMemo(
    () => ({ query, setQuery, patterns, highlightedPatterns, hasPatterns, reset }),
    [query, setQuery, patterns, highlightedPatterns, hasPatterns, reset]
  )

  return <SearchContext.Provider value={value}>{children}</SearchContext.Provider>
}
