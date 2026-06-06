import React, { useContext, useMemo, useState, useCallback } from 'react'
import { SearchContext } from './SearchContext'
import type { SearchEntry, SearchContextValue } from './SearchContext'
import type { SearchOptions } from '../logic/types'
import { useSearchInternalState } from '../hooks/useSearchInternalState'
import { deriveEntry } from './deriveEntry'

export interface SearchSpec {
  name?: string
  field?: string
  fields?: string[]
  options?: SearchOptions
}

type WithSearchBaseProps = {
  options?: SearchOptions
  children: React.ReactNode
}

type SingleSearchProps = WithSearchBaseProps & {
  name?: string
  query?: string
  onSetQuery?: (q: string) => void
  onReset?: () => void
  onChange?: (oldValue: string, newValue: string) => void
  searches?: never
} & (
  | { field?: never; fields?: never }
  | { field: string; fields?: never }
  | { fields: string[]; field?: never }
)

type MultiSearchProps = WithSearchBaseProps & {
  searches: SearchSpec[]
  name?: never
  field?: never
  fields?: never
  query?: never
  onSetQuery?: never
  onReset?: never
  onChange?: never
}

export type WithSearchProps = SingleSearchProps | MultiSearchProps

function resolveSpecFields(field?: string, fields?: string[]): string[] {
  return field !== undefined ? [field] : (fields ?? ['$'])
}

export function WithSearch(props: WithSearchProps) {
  const { options, children } = props
  const searches = (props as MultiSearchProps).searches
  const isMulti = searches !== undefined

  // Single-search props (undefined in multi mode — harmless).
  const single = props as SingleSearchProps

  // Hooks are always called unconditionally (rules of hooks). The single-search
  // internal state is unused in multi mode; the multi query map is unused in
  // single mode.
  const singleState = useSearchInternalState({
    options,
    query: single.query,
    onSetQuery: single.onSetQuery,
    onReset: single.onReset,
    onChange: single.onChange,
  })

  const [queryMap, setQueryMap] = useState<Record<string, string>>({})

  const setQueryFor = useCallback(
    (name: string, value: string) =>
      setQueryMap(m => ({ ...m, [name]: value })),
    []
  )

  const upstreamMap = useContext(SearchContext)

  // --- Single-search entry (existing behavior, now via deriveEntry) ---
  const singleEntry: SearchEntry = useMemo(() => {
    if (single.field !== undefined && single.fields !== undefined) {
      throw new Error('WithSearch: cannot specify both `field` and `fields`.')
    }
    return deriveEntry({
      query: singleState.query,
      setQuery: singleState.setQuery,
      reset: singleState.reset,
      fields: resolveSpecFields(single.field, single.fields),
      options,
    })
  }, [singleState.query, singleState.setQuery, singleState.reset, single.field, single.fields, options])

  const singleName = single.name ?? resolveSpecFields(single.field, single.fields).join('+')

  // --- Multi-search entries (new) ---
  const multiEntries: SearchContextValue = useMemo(() => {
    const result: SearchContextValue = {}
    if (!isMulti) return result
    for (const spec of searches!) {
      if (spec.field !== undefined && spec.fields !== undefined) {
        throw new Error('WithSearch: a search spec cannot specify both `field` and `fields`.')
      }
      const specFields = resolveSpecFields(spec.field, spec.fields)
      const name = spec.name ?? specFields.join('+')
      if (name in result) {
        throw new Error(`WithSearch: duplicate name "${name}" in searches.`)
      }
      const query = queryMap[name] ?? ''
      result[name] = deriveEntry({
        query,
        setQuery: (q: string) => setQueryFor(name, q),
        reset: () => setQueryFor(name, ''),
        fields: specFields,
        options: { ...options, ...spec.options },
      })
    }
    return result
  }, [isMulti, searches, queryMap, options, setQueryFor])

  // --- Runtime guard for JS callers (TS union already forbids this) ---
  if (isMulti) {
    if (
      single.field !== undefined ||
      single.fields !== undefined ||
      single.name !== undefined ||
      single.query !== undefined ||
      single.onSetQuery !== undefined ||
      single.onReset !== undefined ||
      single.onChange !== undefined
    ) {
      throw new Error(
        'WithSearch: cannot combine `searches` with `field`, `fields`, or controlled props.'
      )
    }
  }

  const value = useMemo(() => {
    const additions = isMulti ? multiEntries : { [singleName]: singleEntry }
    const merged: SearchContextValue = { ...upstreamMap }
    for (const [k, v] of Object.entries(additions)) {
      if (k in merged) {
        throw new Error(
          `WithSearch: duplicate name "${k}". Each WithSearch in the same tree must have a unique name.`
        )
      }
      merged[k] = v
    }
    return merged
  }, [upstreamMap, isMulti, multiEntries, singleName, singleEntry])

  return <SearchContext.Provider value={value}>{children}</SearchContext.Provider>
}
