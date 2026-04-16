import type { SearchOptions } from './types'
import { getHighlightPositions } from './getHighlightPositions'

export interface TrimOptions extends SearchOptions {
  /**
   * Maximum number of characters in the returned fragment.
   * Ellipsis characters (…) are appended/prepended on top of this count.
   * Defaults to 80.
   */
  fragmentLength?: number
}

export function trimAroundMatch(
  text: string,
  patterns: string[],
  options: TrimOptions = {}
): string {
  const { fragmentLength = 80, ...searchOptions } = options

  if (text.length <= fragmentLength) return text

  const spans = getHighlightPositions(text, patterns, searchOptions)

  if (spans.length === 0) {
    return text.substring(0, fragmentLength) + '…'
  }

  const minStart = Math.min(...spans.map(s => s.start))
  const maxEnd = Math.max(...spans.map(s => s.end))
  const buffer = fragmentLength - (maxEnd - minStart)

  const idealStart = minStart - Math.floor(buffer / 2)
  const startPos = Math.max(0, Math.min(idealStart, text.length - fragmentLength))
  const endPos = Math.min(startPos + fragmentLength, text.length)

  const prefix = startPos > 0 ? '…' : ''
  const suffix = endPos < text.length ? '…' : ''

  return prefix + text.substring(startPos, endPos) + suffix
}
