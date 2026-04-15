import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import { WithSearch } from '../context/WithSearch'
import { useSearchContext } from '../context/useSearchContext'
import { SearchInput } from './SearchInput'

const QueryDisplay = () => {
  const { query } = useSearchContext()
  return <div data-testid="query">{query}</div>
}

describe('SearchInput', () => {
  it('renders a text input', () => {
    render(
      <WithSearch>
        <SearchInput />
      </WithSearch>
    )
    expect(screen.getByRole('textbox')).toBeDefined()
  })

  it('reflects query from context as its value', () => {
    render(
      <WithSearch>
        <SearchInput />
      </WithSearch>
    )
    expect(screen.getByRole('textbox')).toHaveValue('')
  })

  it('updates context query when user types', () => {
    render(
      <WithSearch>
        <SearchInput />
        <QueryDisplay />
      </WithSearch>
    )
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'hello' } })
    expect(screen.getByTestId('query')).toHaveTextContent('hello')
  })

  it('forwards placeholder prop', () => {
    render(
      <WithSearch>
        <SearchInput placeholder="Search here..." />
      </WithSearch>
    )
    expect(screen.getByPlaceholderText('Search here...')).toBeDefined()
  })

  it('forwards additional HTML input props', () => {
    render(
      <WithSearch>
        <SearchInput data-testid="my-input" />
      </WithSearch>
    )
    expect(screen.getByTestId('my-input')).toBeDefined()
  })
})
