import React, { useContext, useMemo } from 'react'
import { SearchContext } from './SearchContext'
import type { SearchEntry } from './SearchContext'
import type { SearchOptions } from '../logic/types'
import { useSearchInternalState } from '../hooks/useSearchInternalState'

type WithSearchBaseProps = {
  name?: string
  options?: SearchOptions
  children: React.ReactNode
  query?: string
  onSetQuery?: (q: string) => void
  onReset?: () => void
  onChange?: (oldValue: string, newValue: string) => void
}

export type WithSearchProps = WithSearchBaseProps & (
  | { field?: never; fields?: never }
  | { field: string; fields?: never }
  | { fields: string[]; field?: never }
)

export function WithSearch({
  name: nameProp,
  field,
  fields,
  options,
  children,
  query: controlledQuery,
  onSetQuery,
  onReset,
  onChange,
}: WithSearchProps) {
  if (field !== undefined && fields !== undefined) {
    throw new Error('WithSearch: cannot specify both `field` and `fields`.')
  }

  const resolvedFields = field !== undefined ? [field] : (fields ?? ['$'])
  const name = nameProp ?? resolvedFields.join('+')

  const { query, setQuery, patterns, hasPatterns, reset } = useSearchInternalState({
    options,
    query: controlledQuery,
    onSetQuery,
    onReset,
    onChange,
  })

  const upstreamMap = useContext(SearchContext)

  const entry: SearchEntry = useMemo(
    () => ({
      query,
      setQuery,
      patterns,
      hasPatterns,
      reset,
      fields: field !== undefined ? [field] : (fields ?? ['$']),
      options,
    }),
    [query, setQuery, patterns, hasPatterns, reset, field, fields, options]
  )

  const value = useMemo(() => {
    if (name in upstreamMap) {
      throw new Error(
        `WithSearch: duplicate name "${name}". Each WithSearch in the same tree must have a unique name.`
      )
    }
    return { ...upstreamMap, [name]: entry }
  }, [upstreamMap, name, entry])

  return <SearchContext.Provider value={value}>{children}</SearchContext.Provider>
}
