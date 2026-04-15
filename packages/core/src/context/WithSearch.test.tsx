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

const ResetConsumer = () => {
  const { reset } = useSearchContext()
  return <button data-testid="reset" onClick={reset}>Reset</button>
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

  it('controlled mode: reflects the provided query value', () => {
    render(
      <WithSearch query="hello" onSetQuery={() => {}}>
        <TestConsumer items={items} getCorpus={getCorpus} />
      </WithSearch>
    )
    expect(screen.getByTestId('input')).toHaveValue('hello')
  })

  it('controlled mode: calls onSetQuery when input changes', () => {
    const onSetQuery = vi.fn()
    render(
      <WithSearch query="" onSetQuery={onSetQuery}>
        <TestConsumer items={items} getCorpus={getCorpus} />
      </WithSearch>
    )
    fireEvent.change(screen.getByTestId('input'), { target: { value: 'apple' } })
    expect(onSetQuery).toHaveBeenCalledWith('apple')
  })

  it('controlled mode: reset calls onSetQuery with empty string when no onReset given', () => {
    const onSetQuery = vi.fn()
    render(
      <WithSearch query="hello" onSetQuery={onSetQuery}>
        <ResetConsumer />
      </WithSearch>
    )
    fireEvent.click(screen.getByTestId('reset'))
    expect(onSetQuery).toHaveBeenCalledWith('')
  })

  it('controlled mode: reset calls onReset instead of onSetQuery when onReset is given', () => {
    const onSetQuery = vi.fn()
    const onReset = vi.fn()
    render(
      <WithSearch query="hello" onSetQuery={onSetQuery} onReset={onReset}>
        <ResetConsumer />
      </WithSearch>
    )
    fireEvent.click(screen.getByTestId('reset'))
    expect(onReset).toHaveBeenCalled()
    expect(onSetQuery).not.toHaveBeenCalled()
  })

  it('calls onChange with old and new value when query changes (uncontrolled)', () => {
    const onChange = vi.fn()
    render(
      <WithSearch onChange={onChange}>
        <TestConsumer items={items} getCorpus={getCorpus} />
      </WithSearch>
    )
    fireEvent.change(screen.getByTestId('input'), { target: { value: 'apple' } })
    expect(onChange).toHaveBeenCalledWith('', 'apple')
  })

  it('calls onChange with old value and empty string when reset is called (uncontrolled)', () => {
    const onChange = vi.fn()
    render(
      <WithSearch onChange={onChange}>
        <TestConsumer items={items} getCorpus={getCorpus} />
        <ResetConsumer />
      </WithSearch>
    )
    fireEvent.change(screen.getByTestId('input'), { target: { value: 'apple' } })
    onChange.mockClear()
    fireEvent.click(screen.getByTestId('reset'))
    expect(onChange).toHaveBeenCalledWith('apple', '')
  })

  it('calls onChange with old and new value when query changes (controlled)', () => {
    const onChange = vi.fn()
    render(
      <WithSearch query="" onSetQuery={() => {}} onChange={onChange}>
        <TestConsumer items={items} getCorpus={getCorpus} />
      </WithSearch>
    )
    fireEvent.change(screen.getByTestId('input'), { target: { value: 'apple' } })
    expect(onChange).toHaveBeenCalledWith('', 'apple')
  })

  it('calls onChange with old value and empty string when reset is called with onReset (controlled)', () => {
    const onChange = vi.fn()
    const onReset = vi.fn()
    render(
      <WithSearch query="hello" onSetQuery={() => {}} onReset={onReset} onChange={onChange}>
        <ResetConsumer />
      </WithSearch>
    )
    fireEvent.click(screen.getByTestId('reset'))
    expect(onChange).toHaveBeenCalledWith('hello', '')
  })
})
