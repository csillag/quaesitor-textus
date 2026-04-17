import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import { WithSearch } from './WithSearch'
import { useSearchContext } from './useSearchContext'
import { SearchContext } from './SearchContext'

const QueryDisplay = ({ name }: { name?: string } = {}) => {
  const { query, setQuery } = useSearchContext(name)
  return (
    <div>
      <input value={query} onChange={e => setQuery(e.target.value)} data-testid="input" />
      <div data-testid="query">{query}</div>
    </div>
  )
}

const PatternDisplay = ({ name }: { name?: string } = {}) => {
  const { patterns } = useSearchContext(name)
  return <div data-testid="patterns">{patterns.join(',')}</div>
}

const ResetButton = ({ name }: { name?: string } = {}) => {
  const { reset } = useSearchContext(name)
  return <button data-testid="reset" onClick={reset}>Reset</button>
}

const MapKeys = () => {
  const map = React.useContext(SearchContext)
  return <div data-testid="map-keys">{Object.keys(map).sort().join(',')}</div>
}

describe('WithSearch + useSearchContext', () => {
  it('provides initial empty query', () => {
    render(<WithSearch><QueryDisplay /></WithSearch>)
    expect(screen.getByTestId('input')).toHaveValue('')
  })

  it('updates query when user types', () => {
    render(<WithSearch><QueryDisplay /></WithSearch>)
    fireEvent.change(screen.getByTestId('input'), { target: { value: 'hello' } })
    expect(screen.getByTestId('query')).toHaveTextContent('hello')
  })

  it('parses patterns from query', () => {
    render(
      <WithSearch>
        <QueryDisplay />
        <PatternDisplay />
      </WithSearch>
    )
    fireEvent.change(screen.getByTestId('input'), { target: { value: 'apple' } })
    expect(screen.getByTestId('patterns')).toHaveTextContent('apple')
  })

  it('defaults name to "default search"', () => {
    render(<WithSearch><MapKeys /></WithSearch>)
    expect(screen.getByTestId('map-keys')).toHaveTextContent('default search')
  })

  it('uses provided name in the context map', () => {
    render(<WithSearch name="title"><MapKeys /></WithSearch>)
    expect(screen.getByTestId('map-keys')).toHaveTextContent('title')
  })

  it('nested WithSearch instances accumulate keys in the map', () => {
    render(
      <WithSearch name="author">
        <WithSearch name="title">
          <MapKeys />
        </WithSearch>
      </WithSearch>
    )
    const text = screen.getByTestId('map-keys').textContent
    expect(text).toContain('author')
    expect(text).toContain('title')
  })

  it('throws when duplicate name is used', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() =>
      render(
        <WithSearch name="search">
          <WithSearch name="search"><div /></WithSearch>
        </WithSearch>
      )
    ).toThrow('WithSearch: duplicate name "search"')
    spy.mockRestore()
  })

  it('useSearchContext throws when named entry is not found', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() =>
      render(<QueryDisplay name="missing" />)
    ).toThrow('useSearchContext: no WithSearch with name "missing"')
    spy.mockRestore()
  })

  it('useSearchContext looks up named entry independently', () => {
    render(
      <WithSearch name="title">
        <QueryDisplay name="title" />
      </WithSearch>
    )
    fireEvent.change(screen.getByTestId('input'), { target: { value: 'gatsby' } })
    expect(screen.getByTestId('query')).toHaveTextContent('gatsby')
  })

  it('controlled mode: reflects the provided query value', () => {
    render(
      <WithSearch query="hello" onSetQuery={() => {}}>
        <QueryDisplay />
      </WithSearch>
    )
    expect(screen.getByTestId('input')).toHaveValue('hello')
  })

  it('controlled mode: calls onSetQuery when input changes', () => {
    const onSetQuery = vi.fn()
    render(
      <WithSearch query="" onSetQuery={onSetQuery}>
        <QueryDisplay />
      </WithSearch>
    )
    fireEvent.change(screen.getByTestId('input'), { target: { value: 'apple' } })
    expect(onSetQuery).toHaveBeenCalledWith('apple')
  })

  it('controlled mode: reset calls onReset instead of onSetQuery when onReset is given', () => {
    const onSetQuery = vi.fn()
    const onReset = vi.fn()
    render(
      <WithSearch query="hello" onSetQuery={onSetQuery} onReset={onReset}>
        <ResetButton />
      </WithSearch>
    )
    fireEvent.click(screen.getByTestId('reset'))
    expect(onReset).toHaveBeenCalled()
    expect(onSetQuery).not.toHaveBeenCalled()
  })

  it('reset clears the query', () => {
    render(
      <WithSearch>
        <QueryDisplay />
        <ResetButton />
      </WithSearch>
    )
    fireEvent.change(screen.getByTestId('input'), { target: { value: 'apple' } })
    fireEvent.click(screen.getByTestId('reset'))
    expect(screen.getByTestId('query')).toHaveTextContent('')
  })

  it('calls onChange with old and new value when query changes', () => {
    const onChange = vi.fn()
    render(
      <WithSearch onChange={onChange}>
        <QueryDisplay />
      </WithSearch>
    )
    fireEvent.change(screen.getByTestId('input'), { target: { value: 'apple' } })
    expect(onChange).toHaveBeenCalledWith('', 'apple')
  })

  it('calls onChange with old value and empty string when reset is called', () => {
    const onChange = vi.fn()
    render(
      <WithSearch onChange={onChange}>
        <QueryDisplay />
        <ResetButton />
      </WithSearch>
    )
    fireEvent.change(screen.getByTestId('input'), { target: { value: 'apple' } })
    onChange.mockClear()
    fireEvent.click(screen.getByTestId('reset'))
    expect(onChange).toHaveBeenCalledWith('apple', '')
  })

  it('stores fields in the context entry', () => {
    const FieldsCheck = () => {
      const map = React.useContext(SearchContext)
      const entry = map['default search']
      return <div data-testid="fields">{entry?.fields.join(',')}</div>
    }
    render(
      <WithSearch fields={['author', 'title']}>
        <FieldsCheck />
      </WithSearch>
    )
    expect(screen.getByTestId('fields')).toHaveTextContent('author,title')
  })

  it('field prop is stored as a single-element array', () => {
    const FieldsCheck = () => {
      const map = React.useContext(SearchContext)
      const entry = map['default search']
      return <div data-testid="fields">{entry?.fields.join(',')}</div>
    }
    render(
      <WithSearch field="name">
        <FieldsCheck />
      </WithSearch>
    )
    expect(screen.getByTestId('fields')).toHaveTextContent('name')
  })

  it('defaults fields to ["$"] when neither field nor fields is provided', () => {
    const FieldsCheck = () => {
      const map = React.useContext(SearchContext)
      const entry = map['default search']
      return <div data-testid="fields">{entry?.fields.join(',')}</div>
    }
    render(
      <WithSearch>
        <FieldsCheck />
      </WithSearch>
    )
    expect(screen.getByTestId('fields')).toHaveTextContent('$')
  })

  it('throws when both field and fields are provided', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() =>
      render(
        <WithSearch {...{ field: 'name', fields: ['name', 'title'] } as any}>
          <div />
        </WithSearch>
      )
    ).toThrow('WithSearch: cannot specify both `field` and `fields`.')
    spy.mockRestore()
  })
})
