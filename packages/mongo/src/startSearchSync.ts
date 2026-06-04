import type { ChangeStream, Collection } from 'mongodb'
import type { MongoSearchConfig } from './config'
import { DEFAULT_NAMESPACE } from './config'
import { computeSearchFields } from './computeSearchFields'
import { createSearchIndexes } from './searchIndexes'
import { searchFieldsVersion } from './version'

export type SearchSyncEvent =
  | { type: 'indexing-started' }
  | { type: 'indexing-finished'; count: number; durationMs: number }
  | { type: 'indexed'; id: unknown }
export type SearchSyncListener = (event: SearchSyncEvent) => void
export interface SearchSync {
  on(listener: SearchSyncListener): void
  off(listener: SearchSyncListener): void
  stop(): Promise<void>
}
export interface StartSearchSyncOptions { idleMs?: number; backfill?: boolean }

// A config source is either a fixed config or a provider function. A provider is
// re-invoked on each idle flush; when the config it returns has a new
// searchFieldsVersion (e.g. a grown field set), indexes are ensured and a
// backfill re-derives stale docs. A fixed config behaves exactly as before:
// resolved once, never re-invoked, and the caller owns createSearchIndexes.
export type MongoSearchConfigProvider = () => MongoSearchConfig | Promise<MongoSearchConfig>
export type ConfigSource = MongoSearchConfig | MongoSearchConfigProvider

// Tails the collection change stream, derives search fields, and notifies
// listeners. Requires a replica set. Emits indexing-started / indexing-finished
// (debounced burst, for logging) and a per-doc `indexed` event AFTER the derive
// write resolves (so filters on the derived fields will match). With
// `backfill: true`, derives any pre-existing documents missing the namespace OR
// stamped with an outdated version on start (and again after a provider-driven
// config change).
export function startSearchSync(
  collection: Collection,
  source: ConfigSource,
  options: StartSearchSyncOptions = {},
): SearchSync {
  const { idleMs = 750, backfill = false } = options
  const isProvider = typeof source === 'function'
  const stream: ChangeStream = collection.watch([], { fullDocument: 'updateLookup' })
  const listeners = new Set<SearchSyncListener>()
  const emit = (e: SearchSyncEvent) => { for (const l of listeners) l(e) }

  // Mutable current config + its version. For a fixed config these are set
  // synchronously (preserving today's behavior). For a provider, `current` is
  // undefined until the async bootstrap resolves it, and is refreshed on idle.
  let current: MongoSearchConfig | undefined = isProvider ? undefined : (source as MongoSearchConfig)
  let currentVersion = current ? searchFieldsVersion(current) : ''
  let reindexing = false

  let active = false
  let count = 0
  let startedAt = 0
  let idleTimer: ReturnType<typeof setTimeout> | undefined

  const resolveConfig = async (): Promise<MongoSearchConfig> =>
    isProvider ? await (source as MongoSearchConfigProvider)() : (source as MongoSearchConfig)

  stream.on('change', (change: any) => {
    if (!current) return // provider path: config not resolved yet
    if (!['insert', 'update', 'replace'].includes(change.operationType)) return
    const doc = change.fullDocument
    if (!doc) return
    const ns = current.namespace ?? DEFAULT_NAMESPACE
    const derived = computeSearchFields(doc, current) as Record<string, unknown>
    // Loop guard: our own echo writes already match -> skip (and don't count).
    if (JSON.stringify(doc[ns]) === JSON.stringify(derived[ns])) return

    if (!active) { active = true; count = 0; startedAt = Date.now(); emit({ type: 'indexing-started' }) }
    count += 1
    // Emit `indexed` only AFTER the derive write lands, so live match-tests see
    // the derived fields.
    void collection.updateOne({ _id: doc._id }, { $set: { [ns]: derived[ns] } })
      .then(() => emit({ type: 'indexed', id: doc._id }))
      .catch(() => { /* ignore individual write failures */ })

    if (idleTimer) clearTimeout(idleTimer)
    idleTimer = setTimeout(() => {
      active = false
      emit({ type: 'indexing-finished', count, durationMs: Date.now() - startedAt })
      if (isProvider) void maybeReconfigure()
    }, idleMs)
  })

  // Re-derive documents whose search fields are missing OR were derived under a
  // different version (library upgrade or config change).
  async function runBackfill(cfg: MongoSearchConfig) {
    const ns = cfg.namespace ?? DEFAULT_NAMESPACE
    const version = searchFieldsVersion(cfg)
    const sweepStartedAt = Date.now()
    let n = 0
    emit({ type: 'indexing-started' })
    const cursor = collection.find({
      $or: [{ [ns]: { $exists: false } }, { [`${ns}._v`]: { $ne: version } }],
    })
    for await (const doc of cursor) {
      const derived = computeSearchFields(doc, cfg) as Record<string, unknown>
      await collection.updateOne({ _id: doc._id }, { $set: { [ns]: derived[ns] } }).catch(() => {})
      n += 1
    }
    emit({ type: 'indexing-finished', count: n, durationMs: Date.now() - sweepStartedAt })
  }

  // Provider path: re-resolve on idle; if the version changed, ensure indexes and
  // re-derive stale docs. Guarded so flushes during a long backfill don't start a
  // second one (the next idle re-checks).
  async function maybeReconfigure() {
    if (reindexing) return
    const next = await resolveConfig()
    const nextVersion = searchFieldsVersion(next)
    if (nextVersion === currentVersion) return
    reindexing = true
    try {
      current = next
      currentVersion = nextVersion
      await createSearchIndexes(collection, next)
      await runBackfill(next)
    } finally {
      reindexing = false
    }
  }

  // Initial bootstrap. Provider: resolve, ensure indexes, optional backfill (all
  // async, fire-and-forget — the change stream is already open and the loop guard
  // dedups overlap). Fixed config: behave exactly as before — the caller owns
  // createSearchIndexes; we only run the optional backfill.
  if (isProvider) {
    reindexing = true
    void (async () => {
      try {
        current = await resolveConfig()
        currentVersion = searchFieldsVersion(current)
        await createSearchIndexes(collection, current)
        if (backfill) await runBackfill(current)
      } finally {
        reindexing = false
      }
    })()
  } else if (backfill) {
    void runBackfill(current as MongoSearchConfig)
  }

  return {
    on: (l) => { listeners.add(l) },
    off: (l) => { listeners.delete(l) },
    stop: async () => { if (idleTimer) clearTimeout(idleTimer); listeners.clear(); await stream.close() },
  }
}
