import type { SearchOptions } from '@quaesitor-textus/core'

export interface MongoSearchTarget {
  fields: string[]
  options?: SearchOptions          // base/default query mode; defaults to {} (fully folded)
  queryModes?: SearchOptions[]     // additional runtime-selectable modes
}
export interface MongoSearchConfig {
  namespace?: string               // default "_qt"
  ngramSizes?: number[]            // default [2, 3]
  targets: Record<string, MongoSearchTarget>
}
export const DEFAULT_NAMESPACE = '_qt'
export const DEFAULT_NGRAM_SIZES = [2, 3]
