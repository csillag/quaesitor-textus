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
  text: string | undefined
  /** Additional patterns to highlight on top of any context highlightedPatterns. */
  patterns?: string[]
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
  const patterns = [...new Set([...(ctx?.highlightedPatterns ?? []), ...(propPatterns ?? [])])]

  if (text === undefined) return undefined

  const spans = getHighlightPositions(text, patterns, options)

  if (spans.length === 0) {
    return text
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
