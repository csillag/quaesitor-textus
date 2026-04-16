import { describe, it, expect, vi } from 'vitest'
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

  it('does not show clear button when query is empty', () => {
    render(
      <WithSearch>
        <SearchInput placeholder="Search..." />
      </WithSearch>
    )
    expect(screen.queryByLabelText('Clear search')).toBeNull()
  })

  it('shows clear button when query is non-empty', () => {
    render(
      <WithSearch>
        <SearchInput placeholder="Search..." />
      </WithSearch>
    )
    fireEvent.change(screen.getByPlaceholderText('Search...'), {
      target: { value: 'hello' },
    })
    expect(screen.getByLabelText('Clear search')).toBeTruthy()
  })

  it('clicking clear button resets query to empty', () => {
    render(
      <WithSearch>
        <SearchInput placeholder="Search..." />
        <QueryDisplay />
      </WithSearch>
    )
    fireEvent.change(screen.getByPlaceholderText('Search...'), {
      target: { value: 'hello' },
    })
    fireEvent.click(screen.getByLabelText('Clear search'))
    expect(screen.getByTestId('query')).toHaveTextContent('')
  })

  it('clicking clear button calls onReset when provided', () => {
    const onReset = vi.fn()
    render(
      <WithSearch query="hello" onSetQuery={() => {}} onReset={onReset}>
        <SearchInput placeholder="Search..." />
        <QueryDisplay />
      </WithSearch>
    )
    fireEvent.click(screen.getByLabelText('Clear search'))
    expect(onReset).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('query')).toHaveTextContent('hello')
  })

  it('connects to the named WithSearch when name prop is given', () => {
    const NamedQuery = () => {
      const { query } = useSearchContext('myfield')
      return <div data-testid="named-query">{query}</div>
    }
    render(
      <WithSearch name="myfield">
        <SearchInput placeholder="Search..." name="myfield" />
        <NamedQuery />
      </WithSearch>
    )
    fireEvent.change(screen.getByPlaceholderText('Search...'), { target: { value: 'test' } })
    expect(screen.getByTestId('named-query')).toHaveTextContent('test')
  })
})
