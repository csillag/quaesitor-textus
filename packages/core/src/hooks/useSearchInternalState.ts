import { useState, useMemo, useCallback } from 'react'
import { parseInput } from '../logic/parseInput'
import type { SearchOptions } from '../logic/types'

export interface UseSearchInternalStateParams {
  options?: SearchOptions
  query?: string
  onSetQuery?: (q: string) => void
  onReset?: () => void
  onChange?: (oldValue: string, newValue: string) => void
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
  onChange,
}: UseSearchInternalStateParams): UseSearchInternalStateResult {
  const [internalQuery, setInternalQuery] = useState('')
  const { caseSensitive = false, diacriticSensitive = false, minLength = 2 } = options ?? {}

  const isControlled = controlledQuery !== undefined
  const query = isControlled ? controlledQuery : internalQuery

  const setQuery = useCallback(
    (newValue: string) => {
      onChange?.(query, newValue)
      if (isControlled) {
        onSetQuery?.(newValue)
      } else {
        setInternalQuery(newValue)
      }
    },
    [query, isControlled, onSetQuery, onChange]
  )

  const patterns = useMemo(
    () => parseInput(query, { caseSensitive, diacriticSensitive, minLength }),
    [query, caseSensitive, diacriticSensitive, minLength]
  )

  const hasPatterns = patterns.length > 0

  const reset = useCallback(() => {
    if (onReset) {
      onChange?.(query, '')
      onReset()
    } else {
      setQuery('')
    }
  }, [onReset, setQuery, query, onChange])

  return { query, setQuery, patterns, hasPatterns, reset }
}
