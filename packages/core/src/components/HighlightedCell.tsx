import React from 'react'
import type { RecordHighlights } from '../logic/highlightTypes'
import type { SearchOptions } from '../logic/types'
import { HighlightedText } from './HighlightedText'

interface HighlightedCellProps {
  /** The record, optionally carrying a server-attached `_highlights` sidecar. */
  record: { _highlights?: RecordHighlights } & Record<string, unknown>
  /** The field of `record` this cell renders. */
  field: string
  /** The named search whose highlights apply to this cell. */
  searchName: string
  /** Optional explicit text; defaults to String(record[field] ?? ''). */
  value?: string
  options?: SearchOptions
  markStyle?: React.CSSProperties
}

/**
 * Renders one table cell. When the record carries a server `_highlights` sidecar,
 * highlighting is data-driven: a cell is highlighted only when its field is flagged
 * for `searchName`, using the tokens from the sidecar (no live-token subscription).
 * When there is no sidecar, it falls back to the original context-driven highlighting.
 */
export function HighlightedCell({
  record,
  field,
  searchName,
  value,
  options,
  markStyle,
}: HighlightedCellProps): React.ReactNode {
  const text = value ?? String(record[field] ?? '')

  // Fallback (no server annotation): context-driven highlighting, original behavior.
  if (record._highlights === undefined) {
    return (
      <HighlightedText
        text={text}
        searchNames={searchName}
        options={options}
        markStyle={markStyle}
      />
    )
  }

  const h = record._highlights[searchName]
  if (h && h.fields.includes(field)) {
    return (
      <HighlightedText text={text} patterns={h.tokens} options={options} markStyle={markStyle} />
    )
  }
  return <>{text}</>
}
