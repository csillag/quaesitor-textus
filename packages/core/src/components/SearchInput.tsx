import React from 'react'
import { useSearchContext } from '../context/useSearchContext'

type SearchInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'>

export function SearchInput({ placeholder, ...rest }: SearchInputProps) {
  const { query, setQuery } = useSearchContext()
  return (
    <input
      type="text"
      value={query}
      onChange={e => setQuery(e.target.value)}
      placeholder={placeholder}
      {...rest}
    />
  )
}
