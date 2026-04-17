import { describe, it, expect, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import React from 'react'
import { HighlightedText } from './HighlightedText'
import { WithSearch } from '../context/WithSearch'
import { useSearchContext } from '../context/useSearchContext'

describe('HighlightedText', () => {
  it('renders plain text without marks when no patterns', () => {
    const { container } = render(<HighlightedText text="hello world" patterns={[]} />)
    expect(container.querySelector('mark')).toBeNull()
    expect(container.textContent).toBe('hello world')
  })

  it('wraps matched text in a mark element', () => {
    const { container } = render(<HighlightedText text="hello world" patterns={['hello']} />)
    const mark = container.querySelector('mark')
    expect(mark).not.toBeNull()
    expect(mark?.textContent).toBe('hello')
  })

  it('renders multiple non-overlapping marks', () => {
    const { container } = render(
      <HighlightedText text="hello world" patterns={['hello', 'world']} />
    )
    const marks = container.querySelectorAll('mark')
    expect(marks).toHaveLength(2)
  })

  it('renders only one mark when patterns overlap', () => {
    const { container } = render(
      <HighlightedText text="abcde" patterns={['abc', 'bcd']} />
    )
    expect(container.querySelectorAll('mark')).toHaveLength(1)
  })

  it('shows no highlights when neither searchNames nor all is given', () => {
    const Setter = () => {
      const { setQuery } = useSearchContext()
      React.useEffect(() => { setQuery('hello') }, [setQuery])
      return null
    }
    const { container } = render(
      <WithSearch>
        <Setter />
        <HighlightedText text="hello world" />
      </WithSearch>
    )
    // No searchNames or all — context patterns not picked up
    expect(container.querySelector('mark')).toBeNull()
  })

  it('highlights from context when searchNames matches the WithSearch name', async () => {
    const Setter = () => {
      const { setQuery } = useSearchContext()
      React.useEffect(() => { setQuery('hello') }, [setQuery])
      return null
    }
    const { container } = render(
      <WithSearch>
        <Setter />
        <HighlightedText text="hello world" searchNames="$" />
      </WithSearch>
    )
    await act(async () => {})
    expect(container.querySelector('mark')?.textContent).toBe('hello')
  })

  it('highlights from context when all is true', async () => {
    const Setter = () => {
      const { setQuery } = useSearchContext()
      React.useEffect(() => { setQuery('hello') }, [setQuery])
      return null
    }
    const { container } = render(
      <WithSearch>
        <Setter />
        <HighlightedText text="hello world" all />
      </WithSearch>
    )
    await act(async () => {})
    expect(container.querySelector('mark')?.textContent).toBe('hello')
  })

  it('searchNames as array works', async () => {
    const Setter = () => {
      const { setQuery } = useSearchContext('mySearch')
      React.useEffect(() => { setQuery('fox') }, [setQuery])
      return null
    }
    const { container } = render(
      <WithSearch name="mySearch">
        <Setter />
        <HighlightedText text="the quick brown fox" searchNames={['mySearch']} />
      </WithSearch>
    )
    await act(async () => {})
    expect(container.querySelector('mark')?.textContent).toBe('fox')
  })

  it('warns and skips when searchNames references unknown name', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { container } = render(
      <WithSearch>
        <HighlightedText text="hello world" searchNames="nonexistent" />
      </WithSearch>
    )
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('"nonexistent"'))
    expect(container.querySelector('mark')).toBeNull()
    warn.mockRestore()
  })

  it('merges context patterns with explicit patterns prop', async () => {
    const Setter = () => {
      const { setQuery } = useSearchContext()
      React.useEffect(() => { setQuery('hello') }, [setQuery])
      return null
    }
    const { container } = render(
      <WithSearch>
        <Setter />
        <HighlightedText text="hello world" patterns={['world']} all />
      </WithSearch>
    )
    await act(async () => {})
    expect(container.querySelectorAll('mark')).toHaveLength(2)
  })

  it('applies custom markStyle', () => {
    const { container } = render(
      <HighlightedText text="hello" patterns={['hello']} markStyle={{ background: 'red' }} />
    )
    const mark = container.querySelector('mark') as HTMLElement
    expect(mark.style.background).toBe('red')
  })

  it('returns nothing when text is undefined', () => {
    const { container } = render(<HighlightedText text={undefined} />)
    expect(container.firstChild).toBeNull()
  })

  it('returns raw string without span wrapper when no patterns match', () => {
    const { container } = render(<HighlightedText text="hello" patterns={['xyz']} />)
    expect(container.querySelector('span')).toBeNull()
    expect(container.textContent).toBe('hello')
  })
})
