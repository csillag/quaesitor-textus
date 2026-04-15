import React from 'react'
import { Input } from 'antd'
import type { InputProps } from 'antd'
import { useSearchContext } from '@quaesitor-textus/core'

export function SearchInput(props: Omit<InputProps, 'value' | 'onChange'>) {
  const { query, setQuery } = useSearchContext()
  return (
    <Input
      {...props}
      value={query}
      onChange={e => setQuery(e.target.value)}
    />
  )
}
