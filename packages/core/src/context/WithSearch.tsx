import React, { useState, useMemo } from 'react'
import { SearchContext } from './SearchContext'
import type { SearchContextValue } from './SearchContext'
import { parseInput } from '../logic/parseInput'
import { matchItem } from '../logic/matchItem'
import type { SearchOptions } from '../logic/types'

export interface WithSearchProps {
  options?: SearchOptions
  children: React.ReactNode
}

export function WithSearch({ options, children }: WithSearchProps) {
  const [query, setQuery] = useState('')
  const { caseSensitive = false, diacriticSensitive = false, minLength = 2 } = options ?? {}

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

  const value: SearchContextValue = useMemo(
    () => ({ query, setQuery, patterns, executeSearch }),
    [query, setQuery, patterns, executeSearch]
  )

  return <SearchContext.Provider value={value}>{children}</SearchContext.Provider>
}
