import { useContext, useCallback } from 'react'
import { SearchContext } from '../context/SearchContext'
import type { SearchEntry } from '../context/SearchContext'
import { matchItem } from '../logic/matchItem'
import { getByPath } from '../utils/getByPath'
import { harvestStrings } from '../utils/harvestStrings'

export function useFilterFunction(mode: 'AND' | 'OR' = 'AND') {
  const map = useContext(SearchContext)

  return useCallback(
    (item: unknown): boolean => {
      const activeEntries = Object.values(map).filter(entry => entry.hasPatterns)
      if (activeEntries.length === 0) return true

      const check = (entry: SearchEntry) =>
        matchItem(
          entry.fields
            .map(f => harvestStrings(getByPath(item, f)).join(' '))
            .filter(Boolean)
            .join(' '),
          entry.patterns,
          entry.options
        )

      return mode === 'AND'
        ? activeEntries.every(check)
        : activeEntries.some(check)
    },
    [map, mode]
  )
}
