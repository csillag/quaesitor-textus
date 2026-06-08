import { normalizeText, toNgrams } from '@quaesitor-textus/core'
import type { SearchOptions } from '@quaesitor-textus/core'
import type { Document, Filter } from 'mongodb'
import type { MongoSearchConfig } from './config'
import { DEFAULT_NAMESPACE, DEFAULT_NGRAM_SIZES } from './config'
import { modeKey, escapeRegex, resolveMode } from './modes'

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
  const mode = resolveMode(config, target, options)

  const ngramField = `${ns}.${target}.ngrams`
  const verifyField = `${ns}.${target}.${modeKey(mode)}`

  // Index-backed superset pre-filter: all fully-folded n-grams of all patterns.
  const ngramTerms = [
    ...new Set(patterns.flatMap(p => toNgrams(normalizeText(p, {}), sizes))),
  ]
  // Verify: every pattern must be a substring of the mode-folded verify string (AND).
  const verifyConditions = patterns.map(p => ({
    [verifyField]: { $regex: escapeRegex(normalizeText(p, mode)) },
  }))

  return { $and: [{ [ngramField]: { $all: ngramTerms } }, ...verifyConditions] } as Filter<Document>
}
