/** One named search's highlight info for a single record. */
export interface FieldHighlight {
  /** The folded tokens that named search looked for. */
  tokens: string[]
  /** This record's fields to highlight for that search. */
  fields: string[]
}

/**
 * Server-attached per-record sidecar: for each named search (keyed by its name,
 * which equals the mongo target), which fields to highlight and with what tokens.
 */
export type RecordHighlights = Record<string, FieldHighlight>
