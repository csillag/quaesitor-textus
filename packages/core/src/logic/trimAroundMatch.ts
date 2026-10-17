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

/**
 * A fragment of `text` around the matches of `patterns`, from its start when
 * nothing matches. Matches as {@link getHighlightPositions} marks: a pattern that
 * normalises to the empty string is ignored.
 */
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

  const [minStart, maxEnd] = focus(spans, fragmentLength)
  const buffer = Math.max(0, fragmentLength - (maxEnd - minStart))

  const idealStart = minStart - Math.floor(buffer / 2)
  const startPos = Math.max(0, Math.min(idealStart, text.length - fragmentLength))
  const endPos = Math.min(startPos + fragmentLength, text.length)

  const prefix = startPos > 0 ? '…' : ''
  const suffix = endPos < text.length ? '…' : ''

  return prefix + text.substring(startPos, endPos) + suffix
}

/**
 * The stretch of text to centre the fragment on: all the matches if they fit
 * in one fragment, else the most matches that do (the earliest such group).
 * Centring on matches that do not fit would show the text between them, and
 * none of the matches.
 */
function focus(spans: { start: number; end: number }[], fragmentLength: number): [number, number] {
  // getHighlightPositions returns the spans sorted and without overlaps.
  let best = { first: 0, last: 0 }
  for (let first = 0, last = 0; first < spans.length; first++) {
    last = Math.max(last, first)
    while (last + 1 < spans.length && spans[last + 1].end - spans[first].start <= fragmentLength) last++
    if (last - first > best.last - best.first) best = { first, last }
  }
  return [spans[best.first].start, spans[best.last].end]
}
