import type { Meta, StoryObj } from '@storybook/react'
import React from 'react'
import { WithSearch, SearchInput, useSearchContext } from '../src'

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

const SearchInputDemo = () => {
  const { patterns } = useSearchContext()
  return (
    <div style={{ fontFamily: 'sans-serif', padding: 16, maxWidth: 320 }}>
      <SearchInput placeholder="Type to search..." style={{ width: '100%', padding: '6px 8px', fontSize: 14 }} />
      <p style={{ marginTop: 8, fontSize: 13, color: '#555' }}>
        Patterns: {patterns.length > 0 ? patterns.join(', ') : <em>none</em>}
      </p>
    </div>
  )
}

export const Default: StoryObj = {
  render: () => <SearchInputDemo />,
}
