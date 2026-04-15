import type { SearchOptions } from './types'
import { normalizeText } from './normalizeText'

export function matchItem(
  corpus: string,
  patterns: string[],
  options: SearchOptions = {}
): boolean {
  if (patterns.length === 0) return true
  const normalizedCorpus = normalizeText(corpus, options)
  return patterns.every(pattern => {
    const normalizedPattern = normalizeText(pattern, options)
    return normalizedCorpus.indexOf(normalizedPattern) !== -1
  })
}
