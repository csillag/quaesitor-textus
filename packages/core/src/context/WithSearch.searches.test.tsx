import React, { useState } from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { WithSearch } from './WithSearch'
import { useSearchContext } from './useSearchContext'
import { SearchContext } from './SearchContext'

const QueryBox = ({ name }: { name: string }) => {
  const { query, setQuery, patterns } = useSearchContext(name)
  return (
    <div>
      <input
        data-testid={`input-${name}`}
        value={query}
        onChange={e => setQuery(e.target.value)}
      />
      <div data-testid={`patterns-${name}`}>{patterns.join(',')}</div>
    </div>
  )
}

const MapKeys = () => {
  const map = React.useContext(SearchContext)
  return <div data-testid="map-keys">{Object.keys(map).sort().join(',')}</div>
}

describe('WithSearch searches prop', () => {
  it('creates one entry per spec, keyed by name', () => {
    render(
      <WithSearch searches={[{ name: 'author', field: 'author' }, { name: 'title', field: 'title' }]}>
        <MapKeys />
      </WithSearch>
    )
    expect(screen.getByTestId('map-keys')).toHaveTextContent('author,title')
  })

  it('runs the searches independently', () => {
    render(
      <WithSearch searches={[{ name: 'author', field: 'author' }, { name: 'title', field: 'title' }]}>
        <QueryBox name="author" />
        <QueryBox name="title" />
      </WithSearch>
    )
    fireEvent.change(screen.getByTestId('input-author'), { target: { value: 'tolstoy' } })
    expect(screen.getByTestId('patterns-author')).toHaveTextContent('tolstoy')
    expect(screen.getByTestId('patterns-title')).toHaveTextContent('')
    fireEvent.change(screen.getByTestId('input-title'), { target: { value: 'war' } })
    expect(screen.getByTestId('patterns-title')).toHaveTextContent('war')
    expect(screen.getByTestId('patterns-author')).toHaveTextContent('tolstoy')
  })

  it('defaults a spec name to its field, and to joined fields', () => {
    render(
      <WithSearch searches={[{ field: 'author' }, { fields: ['title', 'subtitle'] }]}>
        <MapKeys />
      </WithSearch>
    )
    expect(screen.getByTestId('map-keys')).toHaveTextContent('author,title+subtitle')
  })

  it('merges per-search options over WithSearch-level options', () => {
    // WithSearch-level minLength=5 would drop "ab"; per-search minLength=1 keeps it.
    render(
      <WithSearch options={{ minLength: 5 }} searches={[{ name: 'a', field: 'a', options: { minLength: 1 } }]}>
        <QueryBox name="a" />
      </WithSearch>
    )
    fireEvent.change(screen.getByTestId('input-a'), { target: { value: 'ab' } })
    expect(screen.getByTestId('patterns-a')).toHaveTextContent('ab')
  })

  it('does not remount children and preserves queries when the spec count grows', () => {
    let authorMounts = 0
    const MountCountedAuthor = () => {
      React.useEffect(() => {
        authorMounts += 1
      }, [])
      return <QueryBox name="author" />
    }

    const Harness = () => {
      const [specs, setSpecs] = useState([
        { name: 'author', field: 'author' },
        { name: 'title', field: 'title' },
      ])
      return (
        <WithSearch searches={specs}>
          <MountCountedAuthor />
          <button
            data-testid="add"
            onClick={() => setSpecs(s => [...s, { name: 'year', field: 'year' }])}
          >
            add
          </button>
          <MapKeys />
        </WithSearch>
      )
    }

    render(<Harness />)
    fireEvent.change(screen.getByTestId('input-author'), { target: { value: 'tolstoy' } })
    expect(authorMounts).toBe(1)

    fireEvent.click(screen.getByTestId('add'))

    // New entry present, the existing author input did not remount, query preserved.
    expect(screen.getByTestId('map-keys')).toHaveTextContent('author,title,year')
    expect(authorMounts).toBe(1)
    expect(screen.getByTestId('input-author')).toHaveValue('tolstoy')
  })

  it('renders with an empty searches array (no entries)', () => {
    render(
      <WithSearch searches={[]}>
        <MapKeys />
      </WithSearch>
    )
    expect(screen.getByTestId('map-keys')).toHaveTextContent('')
  })

  it('throws on a duplicate name within searches', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() =>
      render(
        <WithSearch searches={[{ name: 'dup', field: 'a' }, { name: 'dup', field: 'b' }]}>
          <div />
        </WithSearch>
      )
    ).toThrow('WithSearch: duplicate name "dup" in searches.')
    spy.mockRestore()
  })

  it('throws when a spec sets both field and fields', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() =>
      render(
        <WithSearch searches={[{ field: 'a', fields: ['a', 'b'] } as any]}>
          <div />
        </WithSearch>
      )
    ).toThrow('WithSearch: a search spec cannot specify both `field` and `fields`.')
    spy.mockRestore()
  })

  it('throws when searches is combined with field/fields/controlled props', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() =>
      render(
        <WithSearch {...({ searches: [{ field: 'a' }], field: 'b' } as any)}>
          <div />
        </WithSearch>
      )
    ).toThrow('WithSearch: cannot combine `searches` with `field`, `fields`, or controlled props.')
    spy.mockRestore()
  })
})
