import React, { useContext } from 'react'
import { SearchContext } from '../context/SearchContext'
import { getHighlightPositions } from '../logic/getHighlightPositions'
import type { SearchOptions } from '../logic/types'

const DEFAULT_MARK_STYLE: React.CSSProperties = {
  background: '#FFFF5480',
  padding: '2px',
  margin: '-2px',
}

interface HighlightedTextProps {
  text: string
  /** Explicit patterns to highlight. When omitted, patterns come from the nearest WithSearch context. */
  patterns?: string[]
  /**
   * Search options used for position computation.
   * Only meaningful when `patterns` is also supplied directly.
   * When using context patterns, the options are already baked into those patterns by WithSearch.
   */
  options?: SearchOptions
  markStyle?: React.CSSProperties
}

export function HighlightedText({
  text,
  patterns: propPatterns,
  options,
  markStyle = DEFAULT_MARK_STYLE,
}: HighlightedTextProps) {
  const ctx = useContext(SearchContext)
  const patterns = propPatterns ?? ctx?.patterns ?? []

  const spans = getHighlightPositions(text, patterns, options)

  if (spans.length === 0) {
    return <span>{text}</span>
  }

  const nodes: React.ReactNode[] = []
  let cursor = 0

  for (const span of spans) {
    if (span.start > cursor) {
      nodes.push(text.substring(cursor, span.start))
    }
    nodes.push(
      <mark key={span.start} style={markStyle}>
        {text.substring(span.start, span.end)}
      </mark>
    )
    cursor = span.end
  }

  if (cursor < text.length) {
    nodes.push(text.substring(cursor))
  }

  return <span>{nodes}</span>
}
