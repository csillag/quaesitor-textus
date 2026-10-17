import type { SearchOptions } from './types'
import { normalizeText } from './normalizeText'

/**
 * Split a query into search patterns: its space-separated words, deduplicated,
 * in input order and as typed (not normalised).
 *
 * Each word is judged by its normalised form, folded with `options` as
 * {@link matchItem} folds it before comparing:
 * - A word that normalises to the empty string (combining marks alone when
 *   diacritic-insensitive) is dropped: it would constrain nothing.
 * - If no remaining word is at least `minLength` (default 2) long after
 *   normalising, the result is `[]` and the search is inactive. Otherwise every
 *   remaining word is returned, shorter ones included.
 *
 * Lengths count UTF-16 code units of the normalised word, so 'ß' (searched as
 * 'ss') counts 2 and a decomposed 'é' (searched as 'e') counts 1.
 */
export function parseInput(text: string, options: SearchOptions = {}): string[] {
  const { minLength = 2 } = options
  const words = [...new Set(text.trim().split(' '))]
    .map(word => ({ word, length: normalizeText(word, options).length }))
    .filter(({ length }) => length > 0)
  if (!words.some(({ length }) => length >= minLength)) return []
  return words.map(({ word }) => word)
}
