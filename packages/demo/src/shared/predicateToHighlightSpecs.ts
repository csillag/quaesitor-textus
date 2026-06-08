import type { HighlightSpec } from '@quaesitor-textus/mongo'
import type { DemoPredicate } from './predicate'

// Collect one HighlightSpec per TEXT leaf of the predicate (mirrors predicateToMongo's
// traversal). Non-text nodes (YEAR, empty combinators) contribute nothing.
export function predicateToHighlightSpecs(p: DemoPredicate): HighlightSpec[] {
  if ('AND' in p) return p.AND.flatMap(predicateToHighlightSpecs)
  if ('OR' in p) return p.OR.flatMap(predicateToHighlightSpecs)
  if ('TEXT' in p) return [{ target: p.TEXT.target, patterns: p.TEXT.patterns, options: p.TEXT.options }]
  return []
}
