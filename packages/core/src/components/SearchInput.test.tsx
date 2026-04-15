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

  it('does not show a clear button when query is empty', () => {
    render(
      <WithSearch>
        <SearchInput />
      </WithSearch>
    )
    expect(screen.queryByRole('button', { name: /clear/i })).toBeNull()
  })

  it('shows a clear button when query is non-empty', () => {
    render(
      <WithSearch>
        <SearchInput />
      </WithSearch>
    )
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'hello' } })
    expect(screen.getByRole('button', { name: /clear/i })).toBeDefined()
  })

  it('clears the query when the clear button is clicked', () => {
    render(
      <WithSearch>
        <SearchInput />
        <QueryDisplay />
      </WithSearch>
    )
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'hello' } })
    fireEvent.click(screen.getByRole('button', { name: /clear/i }))
    expect(screen.getByTestId('query')).toHaveTextContent('')
  })
})
