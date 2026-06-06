import React from 'react'
import type { SearchOptions } from '../logic/types'
import { useResolvedPatterns } from '../context/useResolvedPatterns'
import { trimAroundMatch } from '../logic/trimAroundMatch'
import { HighlightedText } from './HighlightedText'

interface HighlightedTrimmedTextProps {
  text: string | undefined
  fragmentLength?: number
  patterns?: string[]
  searchNames?: string | string[]
  all?: boolean
  options?: SearchOptions
  markStyle?: React.CSSProperties
}

export function HighlightedTrimmedText({
  text,
  fragmentLength = 80,
  patterns: propPatterns,
  searchNames,
  all,
  options,
  markStyle,
}: HighlightedTrimmedTextProps): React.ReactNode {
  const patterns = useResolvedPatterns(searchNames, all, propPatterns)
  if (text === undefined) return undefined
  const trimmed = trimAroundMatch(text, patterns, { fragmentLength, ...options })
  return (
    <HighlightedText
      text={trimmed}
      patterns={propPatterns}
      searchNames={searchNames}
      all={all}
      options={options}
      markStyle={markStyle}
    />
  )
}
