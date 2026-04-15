import { useState, useMemo, useCallback } from 'react'
import { parseInput } from '../logic/parseInput'
import type { SearchOptions } from '../logic/types'

export interface UseSearchInternalStateParams {
  options?: SearchOptions
  query?: string
  onSetQuery?: (q: string) => void
  onReset?: () => void
}

export interface UseSearchInternalStateResult {
  query: string
  setQuery: (q: string) => void
  patterns: string[]
  hasPatterns: boolean
  reset: () => void
}

export function useSearchInternalState({
  options,
  query: controlledQuery,
  onSetQuery,
  onReset,
}: UseSearchInternalStateParams): UseSearchInternalStateResult {
  const [internalQuery, setInternalQuery] = useState('')
  const { caseSensitive = false, diacriticSensitive = false, minLength = 2 } = options ?? {}

  const isControlled = controlledQuery !== undefined
  const query = isControlled ? controlledQuery : internalQuery

  const setQuery = useCallback(
    (newValue: string) => {
      if (isControlled) {
        onSetQuery?.(newValue)
      } else {
        setInternalQuery(newValue)
      }
    },
    [isControlled, onSetQuery]
  )

  const patterns = useMemo(
    () => parseInput(query, { caseSensitive, diacriticSensitive, minLength }),
    [query, caseSensitive, diacriticSensitive, minLength]
  )

  const hasPatterns = patterns.length > 0

  const reset = useCallback(() => {
    if (onReset) {
      onReset()
    } else {
      setQuery('')
    }
  }, [onReset, setQuery])

  return { query, setQuery, patterns, hasPatterns, reset }
}
