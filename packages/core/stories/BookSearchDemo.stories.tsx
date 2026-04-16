import type { Meta, StoryObj } from '@storybook/react'
import React, { useState } from 'react'
import {
  WithSearch,
  SearchInput,
  HighlightedText,
  useFilterFunction,
  useSearchContext,
} from '../src'
import { books } from './data/books'
import type { Book } from './data/books'

const meta: Meta = {
  title: 'Core/BookSearchDemo',
}

export default meta

const BookList = ({ mode }: { mode: 'AND' | 'OR' }) => {
  const filterFunction = useFilterFunction<Book>(mode)
  const { hasPatterns: authorHasPatterns } = useSearchContext('author')
  const { hasPatterns: titleHasPatterns } = useSearchContext('title')
  const hasPatterns = authorHasPatterns || titleHasPatterns
  const filtered = books.filter(filterFunction)

  return (
    <div style={{ fontFamily: 'sans-serif', padding: 16, maxWidth: 640 }}>
      {hasPatterns && (
        <p style={{ color: '#666', fontSize: 13, margin: '0 0 12px' }}>
          {filtered.length} of {books.length} books
        </p>
      )}
      <ul style={{ paddingLeft: 20, margin: 0 }}>
        {(hasPatterns ? filtered : books.slice(0, 20)).map((book, i) => (
          <li key={i} style={{ marginBottom: 6 }}>
            <HighlightedText text={book.author} searchNames="author" />
            {' — '}
            <HighlightedText text={book.title} searchNames="title" />
            {' '}
            <span style={{ color: '#999', fontSize: 12 }}>({book.year})</span>
          </li>
        ))}
        {!hasPatterns && (
          <li style={{ color: '#999', listStyle: 'none', marginLeft: -20 }}>
            Start typing to search…
          </li>
        )}
      </ul>
    </div>
  )
}

const BookSearchWrapper = () => {
  const [mode, setMode] = useState<'AND' | 'OR'>('AND')

  return (
    <WithSearch name="author" mapping={(b: Book) => b.author}>
      <WithSearch name="title" mapping={(b: Book) => b.title}>
        <div style={{ fontFamily: 'sans-serif', padding: 16, maxWidth: 640 }}>
          <h2 style={{ marginTop: 0 }}>Classical Book Search</h2>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
            <SearchInput
              name="author"
              placeholder="Search for author"
              style={{ flex: 1, padding: '6px 10px', fontSize: 14, boxSizing: 'border-box' }}
            />
            <SearchInput
              name="title"
              placeholder="Search for title"
              style={{ flex: 1, padding: '6px 10px', fontSize: 14, boxSizing: 'border-box' }}
            />
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, whiteSpace: 'nowrap' }}>
              <input
                type="checkbox"
                checked={mode === 'OR'}
                onChange={e => setMode(e.target.checked ? 'OR' : 'AND')}
              />
              OR mode
            </label>
          </div>
          <BookList mode={mode} />
        </div>
      </WithSearch>
    </WithSearch>
  )
}

export const Default: StoryObj = {
  render: () => <BookSearchWrapper />,
}
