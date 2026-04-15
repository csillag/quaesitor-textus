import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import { WithSearch, useSearchContext } from '@quaesitor-textus/core'
import { SearchInput } from './SearchInput'

const QueryDisplay = () => {
  const { query } = useSearchContext()
  return <div data-testid="query">{query}</div>
}

describe('antd SearchInput', () => {
  it('renders an input element', () => {
    render(
      <WithSearch>
        <SearchInput placeholder="Search..." />
      </WithSearch>
    )
    expect(screen.getByPlaceholderText('Search...')).toBeDefined()
  })

  it('updates context query when user types', () => {
    render(
      <WithSearch>
        <SearchInput placeholder="Search..." />
        <QueryDisplay />
      </WithSearch>
    )
    fireEvent.change(screen.getByPlaceholderText('Search...'), {
      target: { value: 'apple' },
    })
    expect(screen.getByTestId('query')).toHaveTextContent('apple')
  })

  it('reflects context query as input value', () => {
    render(
      <WithSearch>
        <SearchInput placeholder="Search..." />
        <QueryDisplay />
      </WithSearch>
    )
    const input = screen.getByPlaceholderText('Search...')
    fireEvent.change(input, { target: { value: 'banana' } })
    expect(input).toHaveValue('banana')
  })
})
