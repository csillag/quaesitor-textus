import React from 'react'
import { useResolvedPatterns } from '../context/useResolvedPatterns'
import { getHighlightPositions } from '../logic/getHighlightPositions'
import type { SearchOptions } from '../logic/types'

const DEFAULT_MARK_STYLE: React.CSSProperties = {
  background: '#FFFF5480',
  padding: '2px',
  margin: '-2px',
}

interface HighlightedTextProps {
  text: string | undefined
  patterns?: string[]
  searchNames?: string | string[]
  all?: boolean
  options?: SearchOptions
  markStyle?: React.CSSProperties
}

export function HighlightedText({
  text,
  patterns: propPatterns,
  searchNames,
  all,
  options,
  markStyle = DEFAULT_MARK_STYLE,
}: HighlightedTextProps) {
  const patterns = useResolvedPatterns(searchNames, all, propPatterns)

  if (text === undefined) return undefined

  const spans = getHighlightPositions(text, patterns, options)

  if (spans.length === 0) return text

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
