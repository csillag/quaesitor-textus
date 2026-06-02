import type { ChangeStream, Collection } from 'mongodb'
import type { MongoSearchConfig } from './config'
import { DEFAULT_NAMESPACE } from './config'
import { computeSearchFields } from './computeSearchFields'

// Emitted around a burst of indexing activity so callers can log progress.
export type SearchSyncEvent =
  | { type: 'indexing-started' }
  | { type: 'indexing-finished'; count: number; durationMs: number }

export interface StartSearchSyncOptions {
  // Called when a burst of indexing starts and when it goes idle again.
  onEvent?: (event: SearchSyncEvent) => void
  // Quiet period (ms) with no further changes before a burst is considered
  // finished. Default 750.
  idleMs?: number
}

// Tails the collection change stream and keeps derived search fields in sync.
// Requires the server to run as a replica set.
export function startSearchSync(
  collection: Collection,
  config: MongoSearchConfig,
  options: StartSearchSyncOptions = {},
): { stop: () => Promise<void> } {
  const ns = config.namespace ?? DEFAULT_NAMESPACE
  const { onEvent, idleMs = 750 } = options
  const stream: ChangeStream = collection.watch([], { fullDocument: 'updateLookup' })

  let active = false
  let count = 0
  let startedAt = 0
  let idleTimer: ReturnType<typeof setTimeout> | undefined

  stream.on('change', (change: any) => {
    if (!['insert', 'update', 'replace'].includes(change.operationType)) return
    const doc = change.fullDocument
    if (!doc) return
    const derived = computeSearchFields(doc, config) as Record<string, unknown>
    // Loop guard: if the stored derived block already equals the freshly computed
    // one, skip the write — otherwise our own update would retrigger this handler.
    // (This also keeps our own echo writes from counting as indexing activity.)
    if (JSON.stringify(doc[ns]) === JSON.stringify(derived[ns])) return

    if (!active) {
      active = true
      count = 0
      startedAt = Date.now()
      onEvent?.({ type: 'indexing-started' })
    }
    count += 1
    void collection.updateOne({ _id: doc._id }, { $set: { [ns]: derived[ns] } })

    // Debounce: declare the burst finished once changes stop arriving.
    if (idleTimer) clearTimeout(idleTimer)
    idleTimer = setTimeout(() => {
      active = false
      onEvent?.({ type: 'indexing-finished', count, durationMs: Date.now() - startedAt })
    }, idleMs)
  })

  return {
    stop: async () => {
      if (idleTimer) clearTimeout(idleTimer)
      await stream.close()
    },
  }
}
