import { normalizeText, buildCorpus } from '@quaesitor-textus/core'
import type { RecordHighlights, SearchOptions } from '@quaesitor-textus/core'
import type { Document } from 'mongodb'
import type { MongoSearchConfig } from './config'
import { DEFAULT_NAMESPACE } from './config'
import { modeKey, resolveMode } from './modes'

/**
 * A highlight request for one text-search target: the same `{ target, patterns,
 * options }` triple a consumer passes to `buildTextSearchFilter`. The consumer
 * collects these during its own predicate walk and passes them to the live search.
 */
export interface HighlightSpec {
  target: string
  patterns: string[]
  options?: SearchOptions
}

/**
 * Build the per-record `_highlights` sidecar from the query's highlight specs.
 * For each spec, fold its patterns (mode resolved the same way buildTextSearchFilter
 * does) and test them against the record's already-stored folded target text
 * `ns.<target>.<modeKey>`; if that field was projected out, refold the target's corpus
 * from the raw fields. A hit marks all the target's fields (exact for single-field
 * targets; a safe superset for multi-field targets, where the client no-ops on fields
 * that do not actually contain a token).
 */
export function computeHighlights(
  specs: HighlightSpec[],
  doc: Document,
  config: MongoSearchConfig,
): RecordHighlights {
  const ns = config.namespace ?? DEFAULT_NAMESPACE
  const result: RecordHighlights = {}
  for (const spec of specs) {
    const target = config.targets[spec.target]
    if (!target) continue
    const mode = resolveMode(config, spec.target, spec.options)
    const tokens = spec.patterns.map(p => normalizeText(p, mode))
    const stored = (doc?.[ns] as Record<string, Record<string, unknown>> | undefined)
      ?.[spec.target]?.[modeKey(mode)]
    const folded = typeof stored === 'string'
      ? stored
      : normalizeText(buildCorpus(doc, target.fields), mode)
    if (tokens.some(t => folded.includes(t))) {
      result[spec.target] = { tokens, fields: target.fields }
    }
  }
  return result
}
