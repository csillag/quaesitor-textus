import React from 'react'
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { HighlightedTrimmedText } from './HighlightedTrimmedText'
import { WithSearch } from '../context/WithSearch'

describe('HighlightedTrimmedText', () => {
  it('returns nothing when text is undefined', () => {
    const { container } = render(
      <WithSearch query="hello" onSetQuery={() => {}}>
        <HighlightedTrimmedText text={undefined} all />
      </WithSearch>
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders full text with highlights when text is shorter than fragmentLength', () => {
    const { container } = render(
      <WithSearch query="fox" onSetQuery={() => {}}>
        <span>
          <HighlightedTrimmedText text="The quick brown fox" fragmentLength={80} all />
        </span>
      </WithSearch>
    )
    expect(container.textContent).toBe('The quick brown fox')
    expect(container.querySelector('mark')).not.toBeNull()
  })

  it('renders trimmed text with ellipsis when text exceeds fragmentLength', () => {
    const longText = 'The quick brown fox jumps over the lazy dog and keeps on running through the forest'
    const { container } = render(
      <WithSearch query="lazy" onSetQuery={() => {}}>
        <span>
          <HighlightedTrimmedText text={longText} fragmentLength={40} all />
        </span>
      </WithSearch>
    )
    expect(container.textContent).toContain('…')
    expect(container.querySelector('mark')).not.toBeNull()
    const textWithoutEllipsis = container.textContent!.replace(/…/g, '')
    expect(textWithoutEllipsis.length).toBeLessThanOrEqual(40)
  })

  it('reads patterns via searchNames prop', () => {
    const { container } = render(
      <WithSearch name="main" query="brown" onSetQuery={() => {}}>
        <span>
          <HighlightedTrimmedText text="The quick brown fox" searchNames="main" />
        </span>
      </WithSearch>
    )
    expect(container.querySelector('mark')?.textContent).toBe('brown')
  })

  it('shows no highlights when neither searchNames nor all is given', () => {
    const { container } = render(
      <WithSearch query="fox" onSetQuery={() => {}}>
        <span>
          <HighlightedTrimmedText text="The quick brown fox" />
        </span>
      </WithSearch>
    )
    expect(container.querySelector('mark')).toBeNull()
  })
})
