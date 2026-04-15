import type { Meta, StoryObj } from '@storybook/react'
import React from 'react'
import { WithSearch, SearchInput, HighlightedText, useSearchContext } from '../src'

const meta: Meta = {
  title: 'Core/SearchInput',
  decorators: [
    (Story) => (
      <WithSearch>
        <Story />
      </WithSearch>
    ),
  ],
}

export default meta

const SmallListDemo = () => {
  const { executeSearch, patterns } = useSearchContext()
  const items = ['Apple', 'Banana', 'Cherry', 'Date', 'Elderberry', 'Fig', 'Grape']
  const filtered = executeSearch(items, item => item)
  return (
    <div style={{ fontFamily: 'sans-serif', padding: 16, maxWidth: 320 }}>
      <SearchInput placeholder="Filter fruits..." style={{ width: '100%', padding: '6px 8px', fontSize: 14 }} />
      <ul style={{ marginTop: 8, paddingLeft: 20 }}>
        {filtered.map(item => (
          <li key={item}>
            <HighlightedText text={item} patterns={patterns} />
          </li>
        ))}
      </ul>
      {filtered.length === 0 && (
        <p style={{ color: '#999', fontStyle: 'italic' }}>No results</p>
      )}
    </div>
  )
}

export const Default: StoryObj = {
  render: () => <SmallListDemo />,
}
