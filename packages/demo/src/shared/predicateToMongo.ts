import { buildTextSearchFilter } from '@quaesitor-textus/mongo'
import type { MongoSearchConfig } from '@quaesitor-textus/mongo'
import type { Document, Filter } from 'mongodb'
import type { DemoPredicate } from './predicate'

export function predicateToMongo(p: DemoPredicate, config: MongoSearchConfig): Filter<Document> {
  // MongoDB rejects empty $and/$or, so collapse empty combinators to match-all.
  if ('AND' in p) return p.AND.length ? { $and: p.AND.map(c => predicateToMongo(c, config)) } as Filter<Document> : {}
  if ('OR' in p)  return p.OR.length  ? { $or:  p.OR.map(c => predicateToMongo(c, config)) } as Filter<Document> : {}
  if ('TEXT' in p) return buildTextSearchFilter(p.TEXT.target, p.TEXT.patterns, config, p.TEXT.options)
  if ('YEAR' in p) {
    const r: Record<string, number> = {}
    if (p.YEAR.gte !== undefined) r.$gte = p.YEAR.gte
    if (p.YEAR.lte !== undefined) r.$lte = p.YEAR.lte
    return Object.keys(r).length ? { year: r } : {}
  }
  return {}
}
