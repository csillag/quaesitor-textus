import type { SearchOptions } from '@quaesitor-textus/core'
import type { MongoSearchTarget, MongoSearchConfig } from './config'

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

// Resolve the fold mode for a target: an explicit per-query options object wins,
// else the target's configured base options, else fully-folded ({}). Shared by
// buildTextSearchFilter and computeHighlights so their folding cannot drift.
export function resolveMode(
  config: MongoSearchConfig,
  target: string,
  options?: SearchOptions,
): SearchOptions {
  return options ?? config.targets[target]?.options ?? {}
}
