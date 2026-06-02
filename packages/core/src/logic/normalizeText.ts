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

export function normalizeText(text: string, options: SearchOptions = {}): string {
  const { caseSensitive = false, diacriticSensitive = false } = options
  let result = text
  if (!diacriticSensitive) {
    // Strip combining diacritics (é, ö, č, ő, …) then fold the precomposed
    // letters NFD leaves intact (ł, ø, ß→ss, æ→ae, …).
    result = result.normalize('NFD').replace(/[̀-ͯ]/g, '')
    result = result.replace(SPECIAL_RE, (c) => SPECIAL_FOLD[c] ?? c)
  }
  if (!caseSensitive) {
    result = result.toLowerCase()
  }
  return result
}
