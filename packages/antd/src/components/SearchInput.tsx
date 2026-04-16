import React from 'react'
import { Input } from 'antd'
import type { InputProps } from 'antd'
import { useSearchContext, DEFAULT_SEARCH_NAME } from '@quaesitor-textus/core'

interface SearchInputProps extends Omit<InputProps, 'value' | 'onChange' | 'suffix'> {
  name?: string
}

export function SearchInput({ name = DEFAULT_SEARCH_NAME, ...props }: SearchInputProps) {
  const { query, setQuery, reset } = useSearchContext(name)
  return (
    <Input
      {...props}
      value={query}
      onChange={e => setQuery(e.target.value)}
      suffix={
        query.length > 0 ? (
          <span
            onClick={reset}
            aria-label="Clear search"
            style={{ cursor: 'pointer', color: 'rgba(0,0,0,0.45)', lineHeight: 1 }}
          >
            ×
          </span>
        ) : (
          <span />
        )
      }
    />
  )
}
