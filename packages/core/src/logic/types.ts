export interface SearchOptions {
  caseSensitive?: boolean
  diacriticSensitive?: boolean
  minLength?: number
}

export interface HighlightSpan {
  start: number
  end: number
}
