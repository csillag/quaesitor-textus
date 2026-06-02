import type { MongoSearchConfig } from './config'
import { DEFAULT_NAMESPACE, DEFAULT_NGRAM_SIZES } from './config'

// Bump whenever the DERIVED OUTPUT changes for the same input — i.e. any change
// to normalizeText, toNgrams, buildCorpus, or computeSearchFields's shape.
// History: 1 = initial; 2 = precomposed-letter folding (ł, ø, ß→ss, …).
export const SEARCH_FIELDS_VERSION = 2

// Order-independent JSON so two equal configs hash the same regardless of key order.
function stableStringify(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v) ?? 'null'
  if (Array.isArray(v)) return '[' + v.map(stableStringify).join(',') + ']'
  const obj = v as Record<string, unknown>
  return '{' + Object.keys(obj).sort().map((k) => JSON.stringify(k) + ':' + stableStringify(obj[k])).join(',') + '}'
}

// Compact, dependency-free non-cryptographic hash (cyrb53).
function cyrb53(str: string): string {
  let h1 = 0xdeadbeef
  let h2 = 0x41c6ce57
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36)
}

// Effective version stamped on each document's derived block: code version plus
// a fingerprint of the derivation-affecting config (namespace, n-gram sizes,
// targets). A library upgrade (code version) OR a config change re-derives.
export function searchFieldsVersion(config: MongoSearchConfig): string {
  const sig = stableStringify({
    ns: config.namespace ?? DEFAULT_NAMESPACE,
    sizes: config.ngramSizes ?? DEFAULT_NGRAM_SIZES,
    targets: config.targets,
  })
  return `${SEARCH_FIELDS_VERSION}:${cyrb53(sig)}`
}
