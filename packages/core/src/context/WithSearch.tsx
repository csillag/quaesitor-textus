import React, { useState, useMemo, useCallback } from 'react'
import { SearchContext } from './SearchContext'
import type { SearchContextValue } from './SearchContext'
import { parseInput } from '../logic/parseInput'
import { matchItem } from '../logic/matchItem'
import type { SearchOptions } from '../logic/types'

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
  const [internalQuery, setInternalQuery] = useState('')
  const { caseSensitive = false, diacriticSensitive = false, minLength = 2 } = options ?? {}

  const isControlled = controlledQuery !== undefined
  const query = isControlled ? controlledQuery : internalQuery
  const setQuery = isControlled ? (onSetQuery ?? (() => {})) : setInternalQuery

  const patterns = useMemo(
    () => parseInput(query, { caseSensitive, diacriticSensitive, minLength }),
    [query, caseSensitive, diacriticSensitive, minLength]
  )

  const executeSearch = useMemo(
    (): SearchContextValue['executeSearch'] =>
      function executeSearch<T>(items: T[], getCorpus: (item: T) => string): T[] {
        return items.filter(item =>
          matchItem(getCorpus(item), patterns, { caseSensitive, diacriticSensitive })
        )
      },
    [patterns, caseSensitive, diacriticSensitive]
  )

  const hasPatterns = patterns.length > 0

  const reset = useCallback(() => {
    if (onReset) {
      onReset()
    } else {
      setQuery('')
    }
  }, [onReset, setQuery])

  const value: SearchContextValue = useMemo(
    () => ({ query, setQuery, patterns, executeSearch, hasPatterns, reset }),
    [query, setQuery, patterns, executeSearch, hasPatterns, reset]
  )

  return <SearchContext.Provider value={value}>{children}</SearchContext.Provider>
}
