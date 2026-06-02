import type { ChangeStream, Collection } from 'mongodb'
import type { MongoSearchConfig } from './config'
import { DEFAULT_NAMESPACE } from './config'
import { computeSearchFields } from './computeSearchFields'

// Tails the collection change stream and keeps derived search fields in sync.
// Requires the server to run as a replica set.
export function startSearchSync(
  collection: Collection,
  config: MongoSearchConfig,
): { stop: () => Promise<void> } {
  const ns = config.namespace ?? DEFAULT_NAMESPACE
  const stream: ChangeStream = collection.watch([], { fullDocument: 'updateLookup' })

  stream.on('change', (change: any) => {
    if (!['insert', 'update', 'replace'].includes(change.operationType)) return
    const doc = change.fullDocument
    if (!doc) return
    const derived = computeSearchFields(doc, config) as Record<string, unknown>
    // Loop guard: if the stored derived block already equals the freshly computed
    // one, skip the write — otherwise our own update would retrigger this handler.
    if (JSON.stringify(doc[ns]) === JSON.stringify(derived[ns])) return
    void collection.updateOne({ _id: doc._id }, { $set: { [ns]: derived[ns] } })
  })

  return { stop: () => stream.close() }
}
