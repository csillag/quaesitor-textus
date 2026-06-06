import type { SearchOptions } from './types'

// Precomposed/stroke letters that NFD does NOT decompose into base + combining
// mark (so the NFD-strip below misses them). Both cases are listed so the fold
// also applies in the case-sensitive search mode (where toLowerCase is skipped).
const SPECIAL_FOLD: Record<string, string> = {
  ł: 'l', Ł: 'L', ø: 'o', Ø: 'O', đ: 'd', Đ: 'D', ħ: 'h', Ħ: 'H',
  ı: 'i', ŋ: 'n', Ŋ: 'N', æ: 'ae', Æ: 'AE', œ: 'oe', Œ: 'OE',
  ß: 'ss', ẞ: 'SS', ð: 'd', Ð: 'D', þ: 'th', Þ: 'TH',
}
const SPECIAL_RE = /[łŁøØđĐħĦıŋŊæÆœŒßẞðÐþÞ]/g

export interface NormalizationResult {
  /** The normalized text. */
  normalized: string
  /**
   * Offset map: `map[i]` is the UTF-16 index in the ORIGINAL text from which
   * normalized char `i` originates. `map[normalized.length]` is a sentinel equal
   * to the original text's length, so a normalized span `[start, end)` maps to the
   * original span `[map[start], map[end])`. Needed because folds can change length
   * (ß→ss, æ→ae, þ→th, combining-mark stripping), so normalized and original
   * indices diverge.
   */
  map: number[]
}

/**
 * Normalize `text` the same way as {@link normalizeText}, additionally returning
 * an offset map that translates normalized character positions back to the
 * original text. Process each original code point independently so we can record,
 * for every normalized char it produces, the original index it came from.
 */
export function normalizeWithMap(
  text: string,
  options: SearchOptions = {}
): NormalizationResult {
  const { caseSensitive = false, diacriticSensitive = false } = options
  let normalized = ''
  const map: number[] = []

  let i = 0
  while (i < text.length) {
    const cp = text.codePointAt(i)!
    const charLen = cp > 0xffff ? 2 : 1
    let fragment = text.slice(i, i + charLen)
    if (!diacriticSensitive) {
      fragment = fragment.normalize('NFD').replace(/[̀-ͯ]/g, '')
      fragment = fragment.replace(SPECIAL_RE, (c) => SPECIAL_FOLD[c] ?? c)
    }
    if (!caseSensitive) {
      fragment = fragment.toLowerCase()
    }
    for (let k = 0; k < fragment.length; k++) {
      map.push(i)
    }
    normalized += fragment
    i += charLen
  }
  map.push(text.length)

  return { normalized, map }
}
