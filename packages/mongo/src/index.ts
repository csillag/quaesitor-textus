export type { MongoSearchConfig, MongoSearchTarget } from './config'
export { DEFAULT_NAMESPACE, DEFAULT_NGRAM_SIZES } from './config'
export { modeKey, targetModes, escapeRegex } from './modes'
export { computeSearchFields } from './computeSearchFields'
export { SEARCH_FIELDS_VERSION, searchFieldsVersion } from './version'
export { searchIndexSpecs, createSearchIndexes } from './searchIndexes'
export { buildTextSearchFilter } from './buildTextSearchFilter'
export { startSearchSync } from './startSearchSync'
export { createLiveSearch } from './createLiveSearch'
export { computeHighlights } from './computeHighlights'
export type { HighlightSpec } from './computeHighlights'
export type { LiveEvent, CreateLiveSearchOptions } from './createLiveSearch'
export { formatSse, sseComment } from './sse'
export type {
  SearchSync, SearchSyncEvent, SearchSyncListener, StartSearchSyncOptions,
  ConfigSource, MongoSearchConfigProvider,
} from './startSearchSync'
