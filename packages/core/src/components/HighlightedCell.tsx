import React from 'react'
import type { RecordHighlights } from '../logic/highlightTypes'
import type { SearchOptions } from '../logic/types'
import { HighlightedText } from './HighlightedText'

interface HighlightedCellProps {
  /** The record, optionally carrying a server-attached `_highlights` sidecar. */
  record: { _highlights?: RecordHighlights } & Record<string, unknown>
  /** The field of `record` this cell renders. */
  field: string
  /**
   * Named search(es) whose highlights apply to this cell — e.g. the field's own
   * per-column search plus a global search. Tokens from every named search whose
   * matched fields include this cell's field are unioned.
   */
  searchNames?: string | string[]
  /** Apply every active search's highlights to this cell. */
  all?: boolean
  /** Optional explicit text; defaults to String(record[field] ?? ''). */
  value?: string
  options?: SearchOptions
  markStyle?: React.CSSProperties
}

/**
 * Renders one table cell. When the record carries a server `_highlights` sidecar,
 * highlighting is data-driven: the cell is highlighted with the union of tokens from
 * every named search (or all of them) whose matched fields include this cell's field —
 * supporting the per-field + global search pattern without any live-token subscription.
 * When there is no sidecar, it falls back to the original context-driven highlighting.
 */
export function HighlightedCell({
  record,
  field,
  searchNames,
  all,
  value,
  options,
  markStyle,
}: HighlightedCellProps): React.ReactNode {
  const text = value ?? String(record[field] ?? '')
  const highlights = record._highlights

  // Fallback (no server annotation): context-driven highlighting, itself multi-search.
  if (highlights === undefined) {
    return (
      <HighlightedText
        text={text}
        searchNames={searchNames}
        all={all}
        options={options}
        markStyle={markStyle}
      />
    )
  }

  const names = all
    ? Object.keys(highlights)
    : searchNames === undefined
      ? []
      : Array.isArray(searchNames)
        ? searchNames
        : [searchNames]

  const tokens = [...new Set(
    names.flatMap(n => {
      const h = highlights[n]
      return h && h.fields.includes(field) ? h.tokens : []
    }),
  )]

  if (tokens.length > 0) {
    return <HighlightedText text={text} patterns={tokens} options={options} markStyle={markStyle} />
  }
  return <>{text}</>
}
