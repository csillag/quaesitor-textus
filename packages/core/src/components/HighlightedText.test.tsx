import { describe, it, expect } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import React from 'react'
import { HighlightedText } from './HighlightedText'
import { WithSearch } from '../context/WithSearch'
import { useSearchContext } from '../context/useSearchContext'

describe('HighlightedText', () => {
  it('renders plain text without marks or wrapper when patterns are empty', () => {
    const { container } = render(<HighlightedText text="hello world" patterns={[]} />)
    expect(container.querySelector('mark')).toBeNull()
    expect(container.querySelector('span')).toBeNull()
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
    expect(marks[0].textContent).toBe('hello')
    expect(marks[1].textContent).toBe('world')
  })

  it('renders only one mark when patterns overlap', () => {
    // 'abc' and 'bcd' overlap — only 'abc' should be marked
    const { container } = render(
      <HighlightedText text="abcde" patterns={['abc', 'bcd']} />
    )
    const marks = container.querySelectorAll('mark')
    expect(marks).toHaveLength(1)
    expect(marks[0].textContent).toBe('abc')
  })

  it('renders text without marks when used outside WithSearch and no patterns prop', () => {
    const { container } = render(<HighlightedText text="hello world" />)
    expect(container.querySelector('mark')).toBeNull()
  })

  it('reads patterns from context when no patterns prop is given', async () => {
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
    // After setQuery('hello'), patterns = ['hello'] (length 5 ≥ minLength 2)
    await act(async () => {})
    const mark = container.querySelector('mark')
    expect(mark?.textContent).toBe('hello')
  })

  it('explicit patterns prop highlights when context has no patterns', () => {
    const { container } = render(
      <WithSearch>
        <HighlightedText text="hello world" patterns={['world']} />
      </WithSearch>
    )
    const mark = container.querySelector('mark')
    expect(mark?.textContent).toBe('world')
  })

  it('applies custom markStyle', () => {
    const { container } = render(
      <HighlightedText
        text="hello"
        patterns={['hello']}
        markStyle={{ background: 'red' }}
      />
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
    expect(container.querySelector('mark')).toBeNull()
    expect(container.textContent).toBe('hello')
  })

  it('merges prop patterns with context highlightedPatterns', async () => {
    const Setter = () => {
      const { setQuery } = useSearchContext()
      React.useEffect(() => { setQuery('hello') }, [setQuery])
      return null
    }
    const { container } = render(
      <WithSearch>
        <Setter />
        <HighlightedText text="hello world" patterns={['world']} />
      </WithSearch>
    )
    await act(async () => {})
    const marks = container.querySelectorAll('mark')
    expect(marks).toHaveLength(2)
    expect(marks[0].textContent).toBe('hello')
    expect(marks[1].textContent).toBe('world')
  })
})
