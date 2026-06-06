import type { Collection, Document, Filter } from 'mongodb'
import type { MongoSearchConfig } from './config'
import type { SearchSync, SearchSyncEvent } from './startSearchSync'

export type LiveEvent =
  | { type: 'snapshot'; items: Document[] }
  | { type: 'match'; item: Document }
  | { type: 'matches'; items: Document[] }
  | { type: 'capped' }

export interface CreateLiveSearchOptions {
  sync: SearchSync
  collection: Collection
  config: MongoSearchConfig
  filter: Filter<Document>
  sort?: { field: string; dir: 1 | -1 }
  cap?: number
  /**
   * When set, per-doc matches are buffered and flushed as a single
   * `{type:'matches', items}` event at most once per `coalesceMs` ms,
   * bounding emissions to ~1000/coalesceMs per second. When omitted,
   * each match is emitted immediately as `{type:'match', item}`.
   */
  coalesceMs?: number
  /**
   * Optional Mongo projection applied to both the snapshot query and the
   * per-match lookup, so excluded fields are never read from the database.
   * Use it to drop large internal fields (e.g. derived n-gram indexes) at the
   * source rather than filtering them out downstream.
   */
  projection?: Document
  sendEvent: (event: LiveEvent) => void
}

// Transport-agnostic live search: emits the current matching set (capped), then
// matches for each newly-indexed document that matches `filter` (singular
// `match`, or coalesced `matches` batches when `coalesceMs` is set), then `capped`.
export function createLiveSearch(opts: CreateLiveSearchOptions): { stop: () => void } {
  const { sync, collection, config: _config, filter, sort, cap = 500, coalesceMs, projection, sendEvent } = opts
  const findOpts = projection ? { projection } : undefined
  const seen = new Set<string>()
  let count = 0
  let capped = false

  let buffer: Document[] = []
  let flushTimer: ReturnType<typeof setTimeout> | null = null

  const flush = () => {
    if (flushTimer != null) { clearTimeout(flushTimer); flushTimer = null }
    if (buffer.length === 0) return
    const items = buffer
    buffer = []
    sendEvent({ type: 'matches', items })
  }

  const emitMatch = (doc: Document) => {
    if (coalesceMs == null) {
      sendEvent({ type: 'match', item: doc })
      return
    }
    buffer.push(doc)
    if (flushTimer == null) flushTimer = setTimeout(flush, coalesceMs)
  }

  const idOf = (doc: Document) => String(doc._id)

  // Initial snapshot (sorted for a nicer first paint; client re-sorts anyway).
  const cursor = collection.find(filter, findOpts)
  if (sort) cursor.sort({ [sort.field]: sort.dir })
  void cursor.limit(cap).toArray().then((items) => {
    for (const it of items) seen.add(idOf(it))
    count = items.length
    sendEvent({ type: 'snapshot', items })
    if (count >= cap) { capped = true; sendEvent({ type: 'capped' }) }
  }).catch(() => sendEvent({ type: 'snapshot', items: [] }))

  const listener = (e: SearchSyncEvent) => {
    if (e.type !== 'indexed' || capped) return
    void collection.findOne({ $and: [{ _id: e.id as any }, filter] }, findOpts)
      .then((doc) => {
        if (!doc || capped) return
        const id = idOf(doc)
        if (seen.has(id)) return
        seen.add(id)
        count += 1
        emitMatch(doc)
        if (count >= cap) { capped = true; flush(); sendEvent({ type: 'capped' }) }
      })
      .catch(() => { /* skip a failed match-test; keep the stream alive */ })
  }
  sync.on(listener)

  return {
    stop: () => {
      sync.off(listener)
      flush()
    },
  }
}
