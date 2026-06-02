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
