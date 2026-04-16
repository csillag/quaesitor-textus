import React, { useContext } from 'react'
import type { SearchOptions } from '../logic/types'
import { SearchContext } from '../context/SearchContext'
import { trimAroundMatch } from '../logic/trimAroundMatch'
import { HighlightedText } from './HighlightedText'

interface HighlightedTrimmedTextProps {
  text: string | undefined
  fragmentLength?: number
  /** Search options applied to both trimming (window placement) and highlight rendering. */
  options?: SearchOptions
  markStyle?: React.CSSProperties
}

export function HighlightedTrimmedText({
  text,
  fragmentLength = 80,
  options,
  markStyle,
}: HighlightedTrimmedTextProps): React.ReactNode {
  const ctx = useContext(SearchContext)
  const highlightedPatterns = ctx?.highlightedPatterns ?? []
  if (text === undefined) return undefined
  const trimmed = trimAroundMatch(text, highlightedPatterns, { fragmentLength, ...options })
  return <HighlightedText text={trimmed} options={options} markStyle={markStyle} />
}
