import type { SearchOptions, HighlightSpan } from './types'
import { normalizeText } from './normalizeText'
import { normalizeWithMap } from './normalizeWithMap'

/**
 * The spans of `text` to mark for `patterns`, sorted and without overlaps.
 *
 * A pattern that normalises to the empty string ('', or combining marks alone
 * when diacritic-insensitive) marks nothing; the other patterns are marked as usual.
 */
export function getHighlightPositions(
  text: string,
  patterns: string[],
  options: SearchOptions = {}
): HighlightSpan[] {
  if (patterns.length === 0) return []

  const { normalized: normalizedText, map } = normalizeWithMap(text, options)
  const spans: HighlightSpan[] = []

  for (const pattern of patterns) {
    const normalizedPattern = normalizeText(pattern, options)
    // Nothing left to find: indexOf('') never returns -1, so the loop would not end.
    if (normalizedPattern === '') continue
    let searchFrom = 0
    while (true) {
      const normStart = normalizedText.indexOf(normalizedPattern, searchFrom)
      if (normStart === -1) break
      // Map normalized positions back to the original text the spans index into.
      // The matched region's original length can differ from the pattern's (folds
      // change length), so derive both ends from the map rather than pattern.length.
      const start = map[normStart]
      const end = map[normStart + normalizedPattern.length]
      spans.push({ start, end })
      searchFrom = normStart + 1
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
