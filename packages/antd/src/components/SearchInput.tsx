import React from 'react'
import { Input } from 'antd'
import type { InputProps } from 'antd'
import { useSearchContext } from '@quaesitor-textus/core'

export function SearchInput(props: Omit<InputProps, 'value' | 'onChange' | 'suffix'>) {
  const { query, setQuery, reset } = useSearchContext()
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
        ) : <span />
      }
    />
  )
}
