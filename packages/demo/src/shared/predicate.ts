import type { SearchOptions } from '@quaesitor-textus/core'
export type DemoPredicate =
  | { AND: DemoPredicate[] }
  | { OR: DemoPredicate[] }
  | { TEXT: { target: string; patterns: string[]; options?: SearchOptions } }
  | { YEAR: { gte?: number; lte?: number } }
export const and = (...p: DemoPredicate[]): DemoPredicate => ({ AND: p })
export const or  = (...p: DemoPredicate[]): DemoPredicate => ({ OR: p })
export const text = (target: string, patterns: string[], options?: SearchOptions): DemoPredicate =>
  ({ TEXT: { target, patterns, options } })
export const yearRange = (gte?: number, lte?: number): DemoPredicate => ({ YEAR: { gte, lte } })
// True if the predicate contains at least one TEXT leaf with patterns.
export function hasTextPattern(p: DemoPredicate): boolean {
  if ('AND' in p) return p.AND.some(hasTextPattern)
  if ('OR' in p) return p.OR.some(hasTextPattern)
  if ('TEXT' in p) return p.TEXT.patterns.length > 0
  return false
}
