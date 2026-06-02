import type { SearchOptions } from '@quaesitor-textus/core'
import type { MongoSearchTarget } from './config'

export function modeKey(o: SearchOptions = {}): string {
  let k = 'norm'
  if (o.caseSensitive) k += '_cs'
  if (o.diacriticSensitive) k += '_ds'
  return k
}

export function targetModes(t: MongoSearchTarget): SearchOptions[] {
  const modes = [t.options ?? {}, ...(t.queryModes ?? [])]
  const seen = new Set<string>()
  const out: SearchOptions[] = []
  for (const m of modes) {
    const k = modeKey(m)
    if (!seen.has(k)) { seen.add(k); out.push(m) }
  }
  return out
}

export function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
