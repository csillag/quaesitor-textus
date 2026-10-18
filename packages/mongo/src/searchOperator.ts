import type { Document, Filter } from 'mongodb'
import type { MongoSearchConfig } from './config'
import { buildTextSearchFilter } from './buildTextSearchFilter'

/**
 * A filtrum-mongo `ops` handler for quaesitor text search:
 *
 * ```ts
 * createMongoFilterTranslator({ ops: { search: searchOperator(config) } })
 * ```
 *
 * The handler gets the predicate's field, which must be a target name of
 * `config`, and the op's value, which must be an array of strings (the search
 * patterns). It answers `buildTextSearchFilter(field, value, config)`: `{}` for
 * no patterns, an `Error` for an unknown target, and a `TypeError` for a value
 * that is not an array of strings.
 */
export function searchOperator(
  config: MongoSearchConfig,
): (field: string, value: unknown) => Filter<Document> {
  return (field, value) => {
    if (!Array.isArray(value) || !value.every(p => typeof p === 'string')) {
      throw new TypeError(`search on ${field}: value must be an array of strings`)
    }
    return buildTextSearchFilter(field, value, config)
  }
}
