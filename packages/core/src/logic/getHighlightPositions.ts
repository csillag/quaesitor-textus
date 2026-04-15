import type { HighlightSpan, SearchOptions } from './types'
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
    const start = normalizedText.indexOf(normalizedPattern)
    if (start !== -1) {
      spans.push({ start, end: start + pattern.length })
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
