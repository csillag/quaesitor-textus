import { useContext, useCallback } from 'react'
import { SearchContext } from '../context/SearchContext'
import { matchItem } from '../logic/matchItem'

export function useFilterFunction<T = string>(mode: 'AND' | 'OR' = 'AND') {
  const map = useContext(SearchContext)

  return useCallback(
    (item: T): boolean => {
      const activeEntries = Object.values(map).filter(entry => entry.hasPatterns)
      if (activeEntries.length === 0) return true

      if (mode === 'AND') {
        return activeEntries.every(entry =>
          matchItem(
            (entry.mapping as (item: T) => string)(item),
            entry.patterns,
            entry.options
          )
        )
      } else {
        return activeEntries.some(entry =>
          matchItem(
            (entry.mapping as (item: T) => string)(item),
            entry.patterns,
            entry.options
          )
        )
      }
    },
    [map, mode]
  )
}
