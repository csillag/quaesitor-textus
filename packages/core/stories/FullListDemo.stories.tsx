import type { Meta, StoryObj } from '@storybook/react'
import React from 'react'
import { WithSearch, SearchInput, HighlightedText, useSearchContext } from '../src'
import { phrases } from './data/phrases'

const meta: Meta = {
  title: 'Core/FullListDemo',
}

export default meta

const FullList = () => {
  const { executeSearch, patterns, hasPatterns, reset } = useSearchContext()
  const filtered = executeSearch(phrases, item => item)
  return (
    <div style={{ fontFamily: 'sans-serif', padding: 16, maxWidth: 480 }}>
      <h2 style={{ marginTop: 0 }}>quaesitor-textus demo</h2>
      <SearchInput
        placeholder="Search phrases…"
        style={{ width: '100%', padding: '8px 10px', fontSize: 15, boxSizing: 'border-box' }}
        autoFocus
      />
      {hasPatterns && (
        <>
          <p style={{ color: '#666', fontSize: 13 }}>
            matches: {filtered.length} of {phrases.length} sentences
          </p>
          <ul style={{ paddingLeft: 20, margin: 0 }}>
            {filtered.map(phrase => (
              <li key={phrase} style={{ marginBottom: 4 }}>
                <HighlightedText text={phrase} patterns={patterns} />
              </li>
            ))}
          </ul>
          {filtered.length === 0 && (
            <p style={{ color: '#999', fontStyle: 'italic' }}>
              No results —{' '}
              <span
                onClick={reset}
                style={{ textDecoration: 'underline', color: '#1677ff', cursor: 'pointer' }}
              >
                try a different term
              </span>
            </p>
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
