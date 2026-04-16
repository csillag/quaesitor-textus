import type { Meta, StoryObj } from '@storybook/react'
import React, { useState, useEffect } from 'react'
import { WithSearch, SearchInput, HighlightedTrimmedText, useSearchContext } from '../src'
import { sentences } from './data/sentences'

const meta: Meta = {
  title: 'Core/FullListDemo',
}

export default meta

const FullList = () => {
  const { filterFunction, hasPatterns, reset } = useSearchContext<string>()
  const filtered = sentences.filter(filterFunction)
  const [selectedSentence, setSelectedSentence] = useState<string | null>(null)

  useEffect(() => {
    if (selectedSentence !== null) {
      if (!(filtered.length === 1 && filtered[0] === selectedSentence)) {
        setSelectedSentence(null)
      }
    }
  }, [filtered, selectedSentence])

  return (
    <div style={{ fontFamily: 'sans-serif', padding: 16, maxWidth: 480 }}>
      <h2 style={{ marginTop: 0 }}>quaesitor-textus demo</h2>
      <SearchInput
        placeholder="Search sentences…"
        style={{ width: '100%', padding: '8px 10px', fontSize: 15, boxSizing: 'border-box' }}
        autoFocus
        onKeyDown={e => {
          if (e.key === 'Enter' && filtered.length === 1) {
            setSelectedSentence(filtered[0])
          }
        }}
      />
      {hasPatterns && (
        <>
          <p style={{ color: '#666', fontSize: 13 }}>
            matches: {filtered.length} of {sentences.length} sentences
          </p>
          <ul style={{ paddingLeft: 20, margin: 0 }}>
            {filtered.map(sentence => (
              <li key={sentence} style={{ marginBottom: 4 }}>
                <HighlightedTrimmedText text={sentence} fragmentLength={40} />
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
          {selectedSentence !== null && (
            <div
              style={{
                marginTop: 16,
                border: '1.5px solid #d0d0d0',
                borderRadius: 12,
                padding: '16px 20px',
                background: '#fafafa',
                fontSize: 16,
              }}
            >
              {selectedSentence}
            </div>
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
