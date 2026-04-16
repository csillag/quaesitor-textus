import React, { useContext, useMemo } from 'react'
import { SearchContext, DEFAULT_SEARCH_NAME } from './SearchContext'
import type { SearchEntry } from './SearchContext'
import type { SearchOptions } from '../logic/types'
import { useSearchInternalState } from '../hooks/useSearchInternalState'

export interface WithSearchProps<T = unknown> {
  name?: string
  mapping?: (item: T) => string
  options?: SearchOptions
  children: React.ReactNode
  query?: string
  onSetQuery?: (q: string) => void
  onReset?: () => void
  onChange?: (oldValue: string, newValue: string) => void
}

export function WithSearch<T = unknown>({
  name = DEFAULT_SEARCH_NAME,
  mapping = String as (item: unknown) => string,
  options,
  children,
  query: controlledQuery,
  onSetQuery,
  onReset,
  onChange,
}: WithSearchProps<T>) {
  const { query, setQuery, patterns, hasPatterns, reset } = useSearchInternalState({
    options,
    query: controlledQuery,
    onSetQuery,
    onReset,
    onChange,
  })

  const upstreamMap = useContext(SearchContext)

  if (name in upstreamMap) {
    throw new Error(
      `WithSearch: duplicate name "${name}". Each WithSearch in the same tree must have a unique name.`
    )
  }

  const entry: SearchEntry<unknown> = useMemo(
    () => ({
      query,
      setQuery,
      patterns,
      hasPatterns,
      reset,
      mapping: mapping as (item: unknown) => string,
      options,
    }),
    [query, setQuery, patterns, hasPatterns, reset, mapping, options]
  )

  const value = useMemo(
    () => ({ ...upstreamMap, [name]: entry }),
    [upstreamMap, name, entry]
  )

  return <SearchContext.Provider value={value}>{children}</SearchContext.Provider>
}
