import { buildCorpus, normalizeText, toNgrams } from '@quaesitor-textus/core'
import type { MongoSearchConfig } from './config'
import { DEFAULT_NAMESPACE, DEFAULT_NGRAM_SIZES } from './config'
import { modeKey, targetModes } from './modes'

export function computeSearchFields(
  doc: unknown,
  config: MongoSearchConfig,
): Record<string, unknown> {
  const ns = config.namespace ?? DEFAULT_NAMESPACE
  const sizes = config.ngramSizes ?? DEFAULT_NGRAM_SIZES
  const targets: Record<string, unknown> = {}

  for (const [name, target] of Object.entries(config.targets)) {
    const corpus = buildCorpus(doc, target.fields)
    const entry: Record<string, unknown> = {
      // n-grams are built on the fully-folded corpus (the coarsest fold) so the
      // index is a superset filter valid for every query mode.
      ngrams: toNgrams(normalizeText(corpus, {}), sizes),
    }
    for (const mode of targetModes(target)) {
      entry[modeKey(mode)] = normalizeText(corpus, mode)
    }
    targets[name] = entry
  }
  return { [ns]: targets }
}
