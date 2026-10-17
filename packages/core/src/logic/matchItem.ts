import type { SearchOptions } from './types'
import { normalizeText } from './normalizeText'

/**
 * Whether the corpus contains every pattern (AND), both normalised with `options`.
 * An empty `patterns` array matches every corpus (the filter is inactive).
 *
 * A pattern that normalises to the empty string ('', or combining marks alone
 * when diacritic-insensitive) is skipped: it constrains nothing. The other
 * patterns decide; when every pattern is such a pattern, every corpus matches,
 * as with an empty array.
 */
export function matchItem(
  corpus: string,
  patterns: string[],
  options: SearchOptions = {}
): boolean {
  if (patterns.length === 0) return true
  const normalizedCorpus = normalizeText(corpus, options)
  return patterns.every(pattern => {
    const normalizedPattern = normalizeText(pattern, options)
    return normalizedPattern === '' || normalizedCorpus.indexOf(normalizedPattern) !== -1
  })
}
