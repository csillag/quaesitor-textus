import { useContext } from 'react'
import { SearchContext } from './SearchContext'
import type { SearchContextValue } from './SearchContext'

export function useSearchContext(): SearchContextValue {
  const ctx = useContext(SearchContext)
  if (!ctx) {
    throw new Error('useSearchContext must be used within <WithSearch>')
  }
  return ctx
}
