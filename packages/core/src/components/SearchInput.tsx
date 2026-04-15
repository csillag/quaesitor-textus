import React from 'react'
import { useSearchContext } from '../context/useSearchContext'

type SearchInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'>

export function SearchInput({ style, ...props }: SearchInputProps) {
  const { query, setQuery, reset } = useSearchContext()
  return (
    <div style={{ position: 'relative', display: 'inline-block', width: style?.width ?? undefined }}>
      <input
        type="text"
        value={query}
        onChange={e => setQuery(e.target.value)}
        style={{ ...style, width: style?.width ? '100%' : undefined, paddingRight: '2em', boxSizing: 'border-box' }}
        {...props}
      />
      {query.length > 0 && (
        <button
          onClick={reset}
          aria-label="Clear search"
          style={{
            position: 'absolute',
            right: 4,
            top: '50%',
            transform: 'translateY(-50%)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: '1em',
            lineHeight: 1,
            padding: '0 2px',
            color: '#888',
          }}
        >
          ×
        </button>
      )}
    </div>
  )
}
