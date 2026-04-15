import type { SearchOptions, HighlightSpan } from './types'
import { normalizeText } from './normalizeText'

export function getHighlightPositions(
  text: string,
  patterns: string[],
  options: SearchOptions = {}
): HighlightSpan[] {
  if (patterns.length === 0) return []

  const normalizedText = normalizeText(text, options)
  const spans: HighlightSpan[] = []

  for (const pattern of patterns) {
    const normalizedPattern = normalizeText(pattern, options)
    let searchFrom = 0
    while (true) {
      const start = normalizedText.indexOf(normalizedPattern, searchFrom)
      if (start === -1) break
      spans.push({ start, end: start + pattern.length })
      searchFrom = start + 1
    }
  }

  spans.sort((a, b) => a.start - b.start)

  const result: HighlightSpan[] = []
  let cursor = 0
  for (const span of spans) {
    if (span.start >= cursor) {
      result.push(span)
      cursor = span.end
    }
  }

  return result
}
