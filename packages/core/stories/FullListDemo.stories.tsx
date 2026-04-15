import type { Meta, StoryObj } from '@storybook/react'
import React from 'react'
import { WithSearch, SearchInput, HighlightedText, useSearchContext } from '../src'
import { phrases } from './data/phrases'

const meta: Meta = {
  title: 'Core/FullListDemo',
}

export default meta

const FullList = () => {
  const { executeSearch, patterns, hasPatterns, reset, query } = useSearchContext()
  const filtered = executeSearch(phrases, item => item)
  return (
    <div style={{ fontFamily: 'sans-serif', padding: 16, maxWidth: 480 }}>
      <h2 style={{ marginTop: 0 }}>quaesitor-textus demo</h2>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <SearchInput
          placeholder="Search phrases…"
          style={{ flex: 1, padding: '8px 10px', fontSize: 15, boxSizing: 'border-box' }}
          autoFocus
        />
        {query.length > 0 && (
          <button
            onClick={reset}
            style={{ padding: '6px 10px', fontSize: 15, cursor: 'pointer', lineHeight: 1 }}
            aria-label="Clear search"
          >
            ×
          </button>
        )}
      </div>
      {hasPatterns && (
        <>
          <p style={{ color: '#666', fontSize: 13 }}>
            {filtered.length} of {phrases.length} phrases
          </p>
          <ul style={{ paddingLeft: 20, margin: 0 }}>
            {filtered.map(phrase => (
              <li key={phrase} style={{ marginBottom: 4 }}>
                <HighlightedText text={phrase} patterns={patterns} />
              </li>
            ))}
          </ul>
          {filtered.length === 0 && (
            <p style={{ color: '#999', fontStyle: 'italic' }}>No results — try a different term</p>
          )}
        </>
      )}
    </div>
  )
}

export const Default: StoryObj = {
  render: () => (
    <WithSearch>
      <FullList />
    </WithSearch>
  ),
}
