import { normalizeText, toNgrams } from '@quaesitor-textus/core'
import type { SearchOptions } from '@quaesitor-textus/core'
import type { Document, Filter } from 'mongodb'
import type { MongoSearchConfig } from './config'
import { DEFAULT_NAMESPACE, DEFAULT_NGRAM_SIZES } from './config'
import { modeKey, escapeRegex } from './modes'

/**
 * A Mongo filter for the documents whose `target` corpus contains every pattern
 * (AND), matching exactly what core's `matchItem` matches over the same corpus.
 *
 * - Folding uses `options`, else the target's base mode, else `{}`.
 * - A pattern that folds to the empty string constrains nothing and is dropped,
 *   as in `matchItem`. With no pattern left (or none given) the result is `{}`:
 *   every document matches.
 * - The fully folded n-grams of the patterns are an index-backed pre-filter
 *   (`$all`), and each pattern is then verified by `$regex` against the mode's
 *   verify string. When no pattern is as long as the smallest n-gram size, there
 *   are no n-grams and the `$all` is left out: the result is the same, but the
 *   query does not use the n-gram index.
 */
export function buildTextSearchFilter(
  target: string,
  patterns: string[],
  config: MongoSearchConfig,
  options?: SearchOptions,
): Filter<Document> {
  if (patterns.length === 0) return {}
  const ns = config.namespace ?? DEFAULT_NAMESPACE
  const sizes = config.ngramSizes ?? DEFAULT_NGRAM_SIZES
  const t = config.targets[target]
  if (!t) throw new Error(`Unknown search target: ${target}`)
  const mode = options ?? t.options ?? {}

  // Fold each pattern with the query mode; one that folds to '' constrains nothing.
  const kept = patterns
    .map(raw => ({ raw, folded: normalizeText(raw, mode) }))
    .filter(({ folded }) => folded !== '')
  if (kept.length === 0) return {}

  const ngramField = `${ns}.${target}.ngrams`
  const verifyField = `${ns}.${target}.${modeKey(mode)}`

  // Index-backed superset pre-filter: all fully-folded n-grams of all patterns.
  const ngramTerms = [
    ...new Set(kept.flatMap(({ raw }) => toNgrams(normalizeText(raw, {}), sizes))),
  ]
  // Verify: every pattern must be a substring of the mode-folded verify string (AND).
  const verifyConditions = kept.map(({ folded }) => ({
    [verifyField]: { $regex: escapeRegex(folded) },
  }))

  // $all of an empty array matches no document, so it is left out when no
  // pattern is long enough for an n-gram.
  const prefilter = ngramTerms.length > 0 ? [{ [ngramField]: { $all: ngramTerms } }] : []
  return { $and: [...prefilter, ...verifyConditions] } as Filter<Document>
}
