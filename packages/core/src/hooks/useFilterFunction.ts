import { useContext, useCallback } from 'react'
import { SearchContext } from '../context/SearchContext'
import type { SearchEntry } from '../context/SearchContext'
import { matchItem } from '../logic/matchItem'
import { buildCorpus } from '../utils/buildCorpus'

export function useFilterFunction(mode: 'AND' | 'OR' = 'AND') {
  const map = useContext(SearchContext)

  return useCallback(
    (item: unknown): boolean => {
      const activeEntries = Object.values(map).filter(entry => entry.hasPatterns)
      if (activeEntries.length === 0) return true

      const check = (entry: SearchEntry) =>
        matchItem(buildCorpus(item, entry.fields), entry.patterns, entry.options)

      return mode === 'AND'
        ? activeEntries.every(check)
        : activeEntries.some(check)
    },
    [map, mode]
  )
}
