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
 * Lengths count UTF-16 code units of the normalised word. Diacritic-insensitive,
 * a character that folds to two or more units therefore reaches the default
 * `minLength` of 2 on its own: 'ß', 'æ', 'œ' and 'þ' (searched as 'ss', 'ae',
 * 'oe', 'th'), Hangul syllables (decomposed into jamo), kana with a dakuten or
 * handakuten, Arabic letters with hamza or madda, and precomposed Indic letters
 * with a nukta. Their marks lie outside the stripped combining-diacritics block,
 * so they stay. A decomposed 'é' (searched as 'e') counts 1. Typed Hungarian and
 * English count as typed: each precomposed accented letter folds to one letter.
 * Diacritic-sensitive, only lowercasing can change a length ('İ' becomes 'i̇',
 * 2 units).
 */
export function parseInput(text: string, options: SearchOptions = {}): string[] {
  const { minLength = 2 } = options
  const words = [...new Set(text.trim().split(' '))]
    .map(word => ({ word, length: normalizeText(word, options).length }))
    .filter(({ length }) => length > 0)
  if (!words.some(({ length }) => length >= minLength)) return []
  return words.map(({ word }) => word)
}
