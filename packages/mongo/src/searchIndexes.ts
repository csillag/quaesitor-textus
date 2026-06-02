import type { Collection } from 'mongodb'
import type { MongoSearchConfig } from './config'
import { DEFAULT_NAMESPACE } from './config'

export function searchIndexSpecs(
  config: MongoSearchConfig,
): Array<{ key: Record<string, 1>; name: string }> {
  const ns = config.namespace ?? DEFAULT_NAMESPACE
  return Object.keys(config.targets).map(name => ({
    key: { [`${ns}.${name}.ngrams`]: 1 },
    name: `${ns}_${name}_ngrams`,
  }))
}

export async function createSearchIndexes(
  collection: Collection,
  config: MongoSearchConfig,
): Promise<void> {
  for (const spec of searchIndexSpecs(config)) {
    await collection.createIndex(spec.key, { name: spec.name })
  }
}
