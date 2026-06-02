import type { ChangeStream, Collection } from 'mongodb'
import type { MongoSearchConfig } from './config'
import { DEFAULT_NAMESPACE } from './config'
import { computeSearchFields } from './computeSearchFields'
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

// Tails the collection change stream, derives search fields, and notifies
// listeners. Requires a replica set. Emits indexing-started / indexing-finished
// (debounced burst, for logging) and a per-doc `indexed` event AFTER the derive
// write resolves (so filters on the derived fields will match). With
// `backfill: true`, derives any pre-existing documents missing the namespace on
// start (change streams are forward-only, so this catches docs written before
// the watcher ran or during downtime — e.g. an external Python writer).
export function startSearchSync(
  collection: Collection,
  config: MongoSearchConfig,
  options: StartSearchSyncOptions = {},
): SearchSync {
  const ns = config.namespace ?? DEFAULT_NAMESPACE
  const { idleMs = 750, backfill = false } = options
  const stream: ChangeStream = collection.watch([], { fullDocument: 'updateLookup' })
  const listeners = new Set<SearchSyncListener>()
  const emit = (e: SearchSyncEvent) => { for (const l of listeners) l(e) }

  let active = false
  let count = 0
  let startedAt = 0
  let idleTimer: ReturnType<typeof setTimeout> | undefined

  stream.on('change', (change: any) => {
    if (!['insert', 'update', 'replace'].includes(change.operationType)) return
    const doc = change.fullDocument
    if (!doc) return
    const derived = computeSearchFields(doc, config) as Record<string, unknown>
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
    }, idleMs)
  })

  // Optional one-time backfill. The stream is already open, so writes arriving
  // during the sweep are handled normally; the loop-guard dedups the overlap.
  if (backfill) void runBackfill()
  async function runBackfill() {
    const startedAt = Date.now()
    let n = 0
    emit({ type: 'indexing-started' })
    // Re-derive documents whose search fields are missing OR were derived under a
    // different version (library upgrade or config change).
    const version = searchFieldsVersion(config)
    const cursor = collection.find({
      $or: [{ [ns]: { $exists: false } }, { [`${ns}._v`]: { $ne: version } }],
    })
    for await (const doc of cursor) {
      const derived = computeSearchFields(doc, config) as Record<string, unknown>
      await collection.updateOne({ _id: doc._id }, { $set: { [ns]: derived[ns] } }).catch(() => {})
      n += 1
    }
    emit({ type: 'indexing-finished', count: n, durationMs: Date.now() - startedAt })
  }

  return {
    on: (l) => { listeners.add(l) },
    off: (l) => { listeners.delete(l) },
    stop: async () => { if (idleTimer) clearTimeout(idleTimer); listeners.clear(); await stream.close() },
  }
}
