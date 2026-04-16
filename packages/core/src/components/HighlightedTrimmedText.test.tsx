import React from 'react'
import { render } from '@testing-library/react'
import { HighlightedTrimmedText } from './HighlightedTrimmedText'
import { SearchContext } from '../context/SearchContext'
import type { SearchContextValue } from '../context/SearchContext'

function makeCtx(highlightedPatterns: string[]): SearchContextValue {
  return {
    query: '',
    setQuery: () => {},
    patterns: highlightedPatterns,
    highlightedPatterns,
    hasPatterns: highlightedPatterns.length > 0,
    reset: () => {},
  }
}

describe('HighlightedTrimmedText', () => {
  it('returns nothing when text is undefined', () => {
    const { container } = render(
      <SearchContext.Provider value={makeCtx(['hello'])}>
        <HighlightedTrimmedText text={undefined} />
      </SearchContext.Provider>
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders full text with highlights when text is shorter than fragmentLength', () => {
    const { container } = render(
      <SearchContext.Provider value={makeCtx(['fox'])}>
        <span>
          <HighlightedTrimmedText text="The quick brown fox" fragmentLength={80} />
        </span>
      </SearchContext.Provider>
    )
    expect(container.textContent).toBe('The quick brown fox')
    expect(container.querySelector('mark')).not.toBeNull()
  })

  it('renders trimmed text with ellipsis and highlights when text exceeds fragmentLength', () => {
    const longText = 'The quick brown fox jumps over the lazy dog and keeps on running through the forest'
    const { container } = render(
      <SearchContext.Provider value={makeCtx(['lazy'])}>
        <span>
          <HighlightedTrimmedText text={longText} fragmentLength={40} />
        </span>
      </SearchContext.Provider>
    )
    expect(container.textContent).toContain('…')
    expect(container.querySelector('mark')).not.toBeNull()
    // trimmed content (excluding ellipsis chars) should be at most fragmentLength characters
    const textWithoutEllipsis = container.textContent!.replace(/…/g, '')
    expect(textWithoutEllipsis.length).toBeLessThanOrEqual(40)
  })

  it('reads patterns from context with no explicit prop', () => {
    const { container } = render(
      <SearchContext.Provider value={makeCtx(['brown'])}>
        <span>
          <HighlightedTrimmedText text="The quick brown fox" />
        </span>
      </SearchContext.Provider>
    )
    const mark = container.querySelector('mark')
    expect(mark).not.toBeNull()
    expect(mark!.textContent).toBe('brown')
  })
})
