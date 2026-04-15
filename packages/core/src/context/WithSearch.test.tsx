import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import { WithSearch } from './WithSearch'
import { useSearchContext } from './useSearchContext'

interface Item { name: string }

const TestConsumer = ({ items, getCorpus }: { items: Item[]; getCorpus: (i: Item) => string }) => {
  const { query, setQuery, patterns, executeSearch } = useSearchContext()
  const filtered = executeSearch(items, getCorpus)
  return (
    <div>
      <input
        value={query}
        onChange={e => setQuery(e.target.value)}
        data-testid="input"
      />
      <div data-testid="count">{filtered.length}</div>
      <div data-testid="patterns">{patterns.join(',')}</div>
    </div>
  )
}

const items: Item[] = [{ name: 'Apple' }, { name: 'Banana' }, { name: 'Cherry' }]
const getCorpus = (i: Item) => i.name

describe('WithSearch + useSearchContext', () => {
  it('provides initial empty query', () => {
    render(
      <WithSearch>
        <TestConsumer items={items} getCorpus={getCorpus} />
      </WithSearch>
    )
    expect(screen.getByTestId('input')).toHaveValue('')
  })

  it('executeSearch returns all items when query is empty', () => {
    render(
      <WithSearch>
        <TestConsumer items={items} getCorpus={getCorpus} />
      </WithSearch>
    )
    expect(screen.getByTestId('count')).toHaveTextContent('3')
  })

  it('executeSearch filters items as query changes', () => {
    render(
      <WithSearch>
        <TestConsumer items={items} getCorpus={getCorpus} />
      </WithSearch>
    )
    fireEvent.change(screen.getByTestId('input'), { target: { value: 'an' } })
    expect(screen.getByTestId('count')).toHaveTextContent('1')
  })

  it('exposes parsed patterns', () => {
    render(
      <WithSearch>
        <TestConsumer items={items} getCorpus={getCorpus} />
      </WithSearch>
    )
    fireEvent.change(screen.getByTestId('input'), { target: { value: 'apple' } })
    expect(screen.getByTestId('patterns')).toHaveTextContent('apple')
  })

  it('throws a descriptive error when used outside WithSearch', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() =>
      render(<TestConsumer items={items} getCorpus={getCorpus} />)
    ).toThrow('useSearchContext must be used within <WithSearch>')
    consoleSpy.mockRestore()
  })
})
