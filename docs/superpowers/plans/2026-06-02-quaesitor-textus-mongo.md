# @quaesitor-textus/mongo + Demo Implementation Plan

> **For agentic workers:** This plan is **parallel-shaped** for swarm execution. Every file is owned by exactly one task; tasks are file-disjoint and run **concurrently in one wave**. Dependency barriers are deliberately broken — a task may write code that imports symbols another task is writing in the same wave. **Do NOT run tests, typecheck, lint, or git inside tasks.** All verification + commits happen in the **Final Phase** from the orchestrator after the wave lands. Interim breakage (uncompilable tree) is expected and fine. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Add `@quaesitor-textus/mongo` (server-side MongoDB search reproducing the client's diacritic/case-insensitive substring matching, index-backed, zero server-side JS) plus a full-stack `packages/demo` showcase, and the shared `@quaesitor-textus/core` additions they depend on.

**Architecture:** All Unicode normalization happens in Node at ingest (Mongo's JS engine lacks `String.prototype.normalize`). Per search target, store fully-folded n-grams (bigrams+trigrams, multikey-indexed) + one pre-folded verify string per query mode. Queries: `$all` the coarsest (fully-folded) n-grams as an index-backed superset filter, then `$regex` the mode's verify string to enforce exact substring + the mode. A change-stream watcher keeps derived fields in sync. The demo composes text search with a year-range predicate in a small in-tree predicate language, server-side, paginated.

**Tech Stack:** TypeScript, pnpm workspaces, tsup, vitest, MongoDB 7 (single-node replica set), Fastify, Vite, React 18, antd.

**Spec:** `docs/superpowers/specs/2026-06-02-quaesitor-textus-mongo-design.md`

---

## File Structure & Ownership

One task owns each row. No file appears in two tasks.

### `@quaesitor-textus/core` (additions)
| File | Task |
|---|---|
| `packages/core/src/logic/toNgrams.ts` + `.test.ts` | T1 |
| `packages/core/src/utils/buildCorpus.ts` + `.test.ts` | T2 |
| `packages/core/src/hooks/useFilterFunction.ts` (modify) | T3 |
| `packages/core/src/index.ts` (modify — add exports) | T4 |
| `packages/core/package.json` (modify — `development` condition) | T5 |

### `@quaesitor-textus/mongo` (new package)
| File | Task |
|---|---|
| `packages/mongo/package.json`, `tsconfig.json`, `tsup.config.ts`, `vitest.config.ts` | T6 |
| `packages/mongo/src/config.ts` | T7 |
| `packages/mongo/src/modes.ts` + `.test.ts` | T8 |
| `packages/mongo/src/computeSearchFields.ts` + `.test.ts` | T9 |
| `packages/mongo/src/searchIndexes.ts` + `.test.ts` | T10 |
| `packages/mongo/src/buildTextSearchFilter.ts` + `.test.ts` | T11 |
| `packages/mongo/src/startSearchSync.ts` | T12 |
| `packages/mongo/src/index.ts` | T13 |
| `packages/mongo/src/parity.test.ts` (client↔server parity) | T14 |
| `packages/mongo/README.md` | T15 |

### `packages/demo` (new package)
| File | Task |
|---|---|
| `packages/demo/package.json`, `tsconfig.json`, `tsconfig.server.json` | T16 |
| `packages/demo/vite.config.ts`, `index.html` | T17 |
| `packages/demo/docker-compose.yml` | T18 |
| `packages/demo/Makefile` | T19 |
| `packages/demo/src/shared/config.ts` | T20 |
| `packages/demo/src/shared/generator.ts` | T21 |
| `packages/demo/src/shared/predicate.ts` | T22 |
| `packages/demo/src/shared/predicateToMongo.ts` | T23 |
| `packages/demo/src/server/index.ts` | T24 |
| `packages/demo/src/seed.ts` | T25 |
| `packages/demo/src/client/api.ts` | T26 |
| `packages/demo/src/client/main.tsx` | T27 |
| `packages/demo/src/client/App.tsx` | T28 |
| `packages/demo/README.md` | T29 |

---

## SHARED CONTRACTS (pinned — every task must match these exactly)

These are the cross-task interfaces. Agents writing different files must use these **verbatim** (names, signatures, field shapes, route shapes).

### Core signatures
```ts
// toNgrams.ts
export function toNgrams(text: string, sizes: number[] = [2, 3]): string[]
// buildCorpus.ts
export function buildCorpus(item: unknown, fields: string[]): string
```

### Mongo config (`packages/mongo/src/config.ts`)
```ts
import type { SearchOptions } from '@quaesitor-textus/core'

export interface MongoSearchTarget {
  fields: string[]
  options?: SearchOptions          // base/default query mode; defaults to {} (fully folded)
  queryModes?: SearchOptions[]     // additional runtime-selectable modes
}
export interface MongoSearchConfig {
  namespace?: string               // default "_qt"
  ngramSizes?: number[]            // default [2, 3]
  targets: Record<string, MongoSearchTarget>
}
export const DEFAULT_NAMESPACE = '_qt'
export const DEFAULT_NGRAM_SIZES = [2, 3]
```

### Mode helpers (`packages/mongo/src/modes.ts`)
```ts
import type { SearchOptions } from '@quaesitor-textus/core'

// Stable storage key for a query mode's verify string.
export function modeKey(o: SearchOptions = {}): string {
  let k = 'norm'
  if (o.caseSensitive) k += '_cs'
  if (o.diacriticSensitive) k += '_ds'
  return k
}
// All distinct modes a target stores verify strings for (base + queryModes), deduped by key.
export function targetModes(t: { options?: SearchOptions; queryModes?: SearchOptions[] }): SearchOptions[]
// Escape a literal string for safe use inside a MongoDB $regex.
export function escapeRegex(s: string): string  // s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
```

### Derived field shape (written by `computeSearchFields`, read by queries/watcher)
For namespace `ns` and target `t`:
```
{ [ns]: { [t]: { ngrams: string[], norm: string, /* + e.g. */ norm_cs: string } } }
```
- `ngrams` = **fully-folded** (`normalizeText(corpus, {})`) bi+trigrams.
- one verify string per stored mode, keyed by `modeKey(mode)` (`"norm"` for base fully-folded).

### Mongo API (`packages/mongo/src/index.ts` re-exports all of these)
```ts
import type { Collection, Document, Filter } from 'mongodb'

export function computeSearchFields(doc: unknown, config: MongoSearchConfig): Record<string, unknown>
export function searchIndexSpecs(config: MongoSearchConfig): Array<{ key: Record<string, 1>; name: string }>
export function createSearchIndexes(collection: Collection, config: MongoSearchConfig): Promise<void>
export function buildTextSearchFilter(
  target: string, patterns: string[], config: MongoSearchConfig, options?: SearchOptions,
): Filter<Document>
export function startSearchSync(collection: Collection, config: MongoSearchConfig): { stop: () => Promise<void> }
```

### Demo predicate (`packages/demo/src/shared/predicate.ts`)
```ts
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
```

### Demo data + config
```ts
// shared/config.ts
export const DEMO_NAMESPACE = '_qt'
export const demoConfig: MongoSearchConfig = {
  namespace: DEMO_NAMESPACE,
  ngramSizes: [2, 3],
  targets: {
    author: { fields: ['author'], queryModes: [{ caseSensitive: true }] },
    title:  { fields: ['title'],  queryModes: [{ caseSensitive: true }] },
  },
}
// shared/generator.ts
export interface Book { _id: string; author: string; title: string; year: number }
export const TOTAL_BOOKS = 10000
export const SEED_COUNT = 1000
export const TRUCK_SIZE = 1000
export function generateBooks(count?: number): Book[]  // deterministic; default TOTAL_BOOKS
```
- `_id` = `` `book-${index}` ``. Deterministic mulberry32 (seed `0x9e3779b9`).
- Index 1500 is **exclusively** `author: 'Gabriel García Márquez'` (kept OUT of the general author pool) so `garcia` is empty before the first truckload (indices 1000–1999) and hits after.
- Author pool diacritic-rich; include a 2-char surname author `'Wei Ng'`.

### Demo HTTP API (server `:3001`, Vite proxies `/api`)
- `GET /api/books?filter=<URL-encoded JSON DemoPredicate>&page=<1-based>&pageSize=<n>`
  → `{ items: Book[]; total: number; page: number; pageSize: number }`
- `POST /api/truckload` → `{ inserted: number; total: number }`
- Mongo URL env `MONGO_URL`, default `mongodb://localhost:27018/?replicaSet=rs0`; DB `demo`, collection `books`.

---

## WAVE 1 — all tasks below run concurrently (file-disjoint)

### Task T1: core `toNgrams`
**Files:** Create `packages/core/src/logic/toNgrams.ts`, `packages/core/src/logic/toNgrams.test.ts`

- [ ] **Write `toNgrams.ts`:**
```ts
export function toNgrams(text: string, sizes: number[] = [2, 3]): string[] {
  const out = new Set<string>()
  for (const n of sizes) {
    if (n <= 0) continue
    for (let i = 0; i + n <= text.length; i++) {
      out.add(text.slice(i, i + n))
    }
  }
  return [...out]
}
```
- [ ] **Write `toNgrams.test.ts`:**
```ts
import { describe, it, expect } from 'vitest'
import { toNgrams } from './toNgrams'

describe('toNgrams', () => {
  it('produces bigrams and trigrams by default', () => {
    expect(toNgrams('hello')).toEqual(['he','el','ll','lo','hel','ell','llo'])
  })
  it('dedups repeated grams', () => {
    expect(toNgrams('aaa', [2])).toEqual(['aa'])
  })
  it('handles 2-char text (bigram only, no trigram)', () => {
    expect(toNgrams('ng')).toEqual(['ng'])
  })
  it('returns empty for text shorter than smallest size', () => {
    expect(toNgrams('a')).toEqual([])
  })
  it('respects custom sizes', () => {
    expect(toNgrams('abcd', [3])).toEqual(['abc','bcd'])
  })
})
```

### Task T2: core `buildCorpus`
**Files:** Create `packages/core/src/utils/buildCorpus.ts`, `packages/core/src/utils/buildCorpus.test.ts`

- [ ] **Write `buildCorpus.ts`** (extracts the inline logic currently in `useFilterFunction.ts`):
```ts
import { getByPath } from './getByPath'
import { harvestStrings } from './harvestStrings'

export function buildCorpus(item: unknown, fields: string[]): string {
  return fields
    .map(f => harvestStrings(getByPath(item, f)).join(' '))
    .filter(Boolean)
    .join(' ')
}
```
- [ ] **Write `buildCorpus.test.ts`:**
```ts
import { describe, it, expect } from 'vitest'
import { buildCorpus } from './buildCorpus'

describe('buildCorpus', () => {
  it('joins multiple fields with a space', () => {
    expect(buildCorpus({ a: 'foo', b: 'bar' }, ['a', 'b'])).toBe('foo bar')
  })
  it('deep-harvests nested objects and arrays', () => {
    expect(buildCorpus({ a: { x: ['p', 'q'] } }, ['a'])).toBe('p q')
  })
  it('drops empty/missing fields', () => {
    expect(buildCorpus({ a: 'foo' }, ['a', 'missing'])).toBe('foo')
  })
  it('supports the $ root path', () => {
    expect(buildCorpus('hi', ['$'])).toBe('hi')
  })
})
```

### Task T3: refactor `useFilterFunction` to use `buildCorpus`
**Files:** Modify `packages/core/src/hooks/useFilterFunction.ts`

- [ ] Replace the inline corpus construction (lines ~16-24) so the `check` function uses `buildCorpus`. Final file:
```ts
import { useContext, useCallback } from 'react'
import { SearchContext } from '../context/SearchContext'
import type { SearchEntry } from '../context/SearchContext'
import { matchItem } from '../logic/matchItem'
import { buildCorpus } from '../utils/buildCorpus'

export function useFilterFunction(mode: 'AND' | 'OR' = 'AND') {
  const map = useContext(SearchContext)

  return useCallback(
    (item: unknown): boolean => {
      const activeEntries = Object.values(map).filter(entry => entry.hasPatterns)
      if (activeEntries.length === 0) return true

      const check = (entry: SearchEntry) =>
        matchItem(buildCorpus(item, entry.fields), entry.patterns, entry.options)

      return mode === 'AND'
        ? activeEntries.every(check)
        : activeEntries.some(check)
    },
    [map, mode]
  )
}
```

### Task T4: export core additions
**Files:** Modify `packages/core/src/index.ts`

- [ ] Add these two export lines (alongside the existing logic/utils exports):
```ts
export { toNgrams } from './logic/toNgrams'
export { buildCorpus } from './utils/buildCorpus'
```

### Task T5: core `development` exports condition
**Files:** Modify `packages/core/package.json`

- [ ] Replace the `"exports"` block with (add `"development"` first inside the conditions; order matters — most specific dev condition before `import`/`require`):
```json
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "development": "./src/index.ts",
      "require": "./dist/index.cjs",
      "import": "./dist/index.js"
    }
  },
```
(Leave `main`/`module`/`types` and everything else unchanged. `files` already includes `src`.)

### Task T6: mongo package scaffold
**Files:** Create `packages/mongo/package.json`, `packages/mongo/tsconfig.json`, `packages/mongo/tsup.config.ts`, `packages/mongo/vitest.config.ts`

- [ ] **`package.json`:**
```json
{
  "name": "@quaesitor-textus/mongo",
  "version": "0.1.6",
  "type": "module",
  "license": "Apache-2.0",
  "files": ["dist", "src"],
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "development": "./src/index.ts",
      "require": "./dist/index.cjs",
      "import": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsup",
    "test": "vitest run"
  },
  "publishConfig": { "access": "public" },
  "dependencies": {
    "@quaesitor-textus/core": "workspace:*"
  },
  "peerDependencies": {
    "mongodb": ">=5"
  },
  "devDependencies": {
    "mongodb": "^6.0.0",
    "tsup": "^8.0.0",
    "typescript": "^5.4.0",
    "vitest": "^2.0.0"
  }
}
```
- [ ] **`tsconfig.json`:**
```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": { "outDir": "dist", "rootDir": "src" },
  "include": ["src"]
}
```
- [ ] **`tsup.config.ts`:**
```ts
import { defineConfig } from 'tsup'
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  clean: true,
  external: ['mongodb', '@quaesitor-textus/core'],
})
```
- [ ] **`vitest.config.ts`:**
```ts
import { defineConfig } from 'vitest/config'
export default defineConfig({ test: { environment: 'node' } })
```

### Task T7: mongo config types
**Files:** Create `packages/mongo/src/config.ts`

- [ ] Exactly the **Mongo config** contract block above (`MongoSearchTarget`, `MongoSearchConfig`, `DEFAULT_NAMESPACE`, `DEFAULT_NGRAM_SIZES`).

### Task T8: mongo mode helpers
**Files:** Create `packages/mongo/src/modes.ts`, `packages/mongo/src/modes.test.ts`

- [ ] **`modes.ts`:**
```ts
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
```
- [ ] **`modes.test.ts`:**
```ts
import { describe, it, expect } from 'vitest'
import { modeKey, targetModes, escapeRegex } from './modes'

describe('modeKey', () => {
  it('base mode is norm', () => { expect(modeKey()).toBe('norm'); expect(modeKey({})).toBe('norm') })
  it('case-sensitive', () => { expect(modeKey({ caseSensitive: true })).toBe('norm_cs') })
  it('diacritic-sensitive', () => { expect(modeKey({ diacriticSensitive: true })).toBe('norm_ds') })
  it('both', () => { expect(modeKey({ caseSensitive: true, diacriticSensitive: true })).toBe('norm_cs_ds') })
})
describe('targetModes', () => {
  it('includes base + queryModes, deduped', () => {
    const modes = targetModes({ fields: ['a'], queryModes: [{ caseSensitive: true }, {}] })
    expect(modes.map(modeKey)).toEqual(['norm', 'norm_cs'])
  })
})
describe('escapeRegex', () => {
  it('escapes regex metacharacters', () => {
    expect(escapeRegex('a.*b')).toBe('a\\.\\*b')
  })
})
```

### Task T9: `computeSearchFields`
**Files:** Create `packages/mongo/src/computeSearchFields.ts`, `packages/mongo/src/computeSearchFields.test.ts`

- [ ] **`computeSearchFields.ts`:**
```ts
import { buildCorpus, normalizeText, toNgrams } from '@quaesitor-textus/core'
import type { MongoSearchConfig } from './config'
import { DEFAULT_NAMESPACE, DEFAULT_NGRAM_SIZES } from './config'
import { modeKey, targetModes } from './modes'

export function computeSearchFields(
  doc: unknown,
  config: MongoSearchConfig,
): Record<string, unknown> {
  const ns = config.namespace ?? DEFAULT_NAMESPACE
  const sizes = config.ngramSizes ?? DEFAULT_NGRAM_SIZES
  const targets: Record<string, unknown> = {}

  for (const [name, target] of Object.entries(config.targets)) {
    const corpus = buildCorpus(doc, target.fields)
    const entry: Record<string, unknown> = {
      // n-grams are built on the fully-folded corpus (the coarsest fold) so the
      // index is a superset filter valid for every query mode.
      ngrams: toNgrams(normalizeText(corpus, {}), sizes),
    }
    for (const mode of targetModes(target)) {
      entry[modeKey(mode)] = normalizeText(corpus, mode)
    }
    targets[name] = entry
  }
  return { [ns]: targets }
}
```
- [ ] **`computeSearchFields.test.ts`:**
```ts
import { describe, it, expect } from 'vitest'
import { computeSearchFields } from './computeSearchFields'
import type { MongoSearchConfig } from './config'

const config: MongoSearchConfig = {
  targets: {
    author: { fields: ['author'], queryModes: [{ caseSensitive: true }] },
  },
}

describe('computeSearchFields', () => {
  it('stores fully-folded ngrams and per-mode verify strings', () => {
    const out = computeSearchFields({ author: 'Café' }, config) as any
    expect(out._qt.author.norm).toBe('cafe')        // folded: diacritics stripped + lowercased
    expect(out._qt.author.norm_cs).toBe('Cafe')     // case-sensitive: diacritics stripped, case kept
    expect(out._qt.author.ngrams).toContain('ca')
    expect(out._qt.author.ngrams).toContain('caf')
  })
  it('respects a custom namespace', () => {
    const out = computeSearchFields({ author: 'x' }, { namespace: 'qt', targets: config.targets }) as any
    expect(out.qt.author).toBeDefined()
  })
})
```

### Task T10: indexes
**Files:** Create `packages/mongo/src/searchIndexes.ts`, `packages/mongo/src/searchIndexes.test.ts`

- [ ] **`searchIndexes.ts`:**
```ts
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
```
- [ ] **`searchIndexes.test.ts`:**
```ts
import { describe, it, expect } from 'vitest'
import { searchIndexSpecs } from './searchIndexes'

describe('searchIndexSpecs', () => {
  it('one multikey index per target', () => {
    const specs = searchIndexSpecs({ targets: { author: { fields: ['author'] }, title: { fields: ['title'] } } })
    expect(specs).toEqual([
      { key: { '_qt.author.ngrams': 1 }, name: '_qt_author_ngrams' },
      { key: { '_qt.title.ngrams': 1 },  name: '_qt_title_ngrams'  },
    ])
  })
})
```

### Task T11: `buildTextSearchFilter`
**Files:** Create `packages/mongo/src/buildTextSearchFilter.ts`, `packages/mongo/src/buildTextSearchFilter.test.ts`

- [ ] **`buildTextSearchFilter.ts`:**
```ts
import { normalizeText, toNgrams } from '@quaesitor-textus/core'
import type { SearchOptions } from '@quaesitor-textus/core'
import type { Document, Filter } from 'mongodb'
import type { MongoSearchConfig } from './config'
import { DEFAULT_NAMESPACE, DEFAULT_NGRAM_SIZES } from './config'
import { modeKey, escapeRegex } from './modes'

export function buildTextSearchFilter(
  target: string,
  patterns: string[],
  config: MongoSearchConfig,
  options?: SearchOptions,
): Filter<Document> {
  if (patterns.length === 0) return {}
  const ns = config.namespace ?? DEFAULT_NAMESPACE
  const sizes = config.ngramSizes ?? DEFAULT_NGRAM_SIZES
  const t = config.targets[target]
  if (!t) throw new Error(`Unknown search target: ${target}`)
  const mode = options ?? t.options ?? {}

  const ngramField = `${ns}.${target}.ngrams`
  const verifyField = `${ns}.${target}.${modeKey(mode)}`

  // Index-backed superset pre-filter: all fully-folded n-grams of all patterns.
  const ngramTerms = [
    ...new Set(patterns.flatMap(p => toNgrams(normalizeText(p, {}), sizes))),
  ]
  // Verify: every pattern must be a substring of the mode-folded verify string (AND).
  const verifyConditions = patterns.map(p => ({
    [verifyField]: { $regex: escapeRegex(normalizeText(p, mode)) },
  }))

  return { $and: [{ [ngramField]: { $all: ngramTerms } }, ...verifyConditions] } as Filter<Document>
}
```
- [ ] **`buildTextSearchFilter.test.ts`:**
```ts
import { describe, it, expect } from 'vitest'
import { buildTextSearchFilter } from './buildTextSearchFilter'
import type { MongoSearchConfig } from './config'

const config: MongoSearchConfig = {
  targets: { author: { fields: ['author'], queryModes: [{ caseSensitive: true }] } },
}

describe('buildTextSearchFilter', () => {
  it('empty patterns match everything', () => {
    expect(buildTextSearchFilter('author', [], config)).toEqual({})
  })
  it('builds ngram $all + per-pattern verify regex (base mode)', () => {
    const f = buildTextSearchFilter('author', ['café'], config) as any
    const ngram = f.$and[0]['_qt.author.ngrams'].$all
    expect(ngram).toContain('ca')      // fully folded ngrams
    expect(f.$and[1]['_qt.author.norm'].$regex).toBe('cafe')
  })
  it('selects the case-sensitive verify field + folding', () => {
    const f = buildTextSearchFilter('author', ['Café'], config, { caseSensitive: true }) as any
    expect(f.$and[1]['_qt.author.norm_cs'].$regex).toBe('Cafe')
  })
  it('escapes regex metacharacters in the verify pattern', () => {
    const f = buildTextSearchFilter('author', ['a.b'], config) as any
    expect(f.$and[1]['_qt.author.norm'].$regex).toBe('a\\.b')
  })
  it('throws on unknown target', () => {
    expect(() => buildTextSearchFilter('nope', ['x'], config)).toThrow(/Unknown search target/)
  })
})
```

### Task T12: `startSearchSync` watcher
**Files:** Create `packages/mongo/src/startSearchSync.ts`

- [ ] **`startSearchSync.ts`:**
```ts
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
```

### Task T13: mongo barrel
**Files:** Create `packages/mongo/src/index.ts`

- [ ] **`index.ts`:**
```ts
export type { MongoSearchConfig, MongoSearchTarget } from './config'
export { DEFAULT_NAMESPACE, DEFAULT_NGRAM_SIZES } from './config'
export { modeKey, targetModes, escapeRegex } from './modes'
export { computeSearchFields } from './computeSearchFields'
export { searchIndexSpecs, createSearchIndexes } from './searchIndexes'
export { buildTextSearchFilter } from './buildTextSearchFilter'
export { startSearchSync } from './startSearchSync'
```

### Task T14: parity integration test
**Files:** Create `packages/mongo/src/parity.test.ts`

This is the key correctness guarantee: a real Mongo query built by `buildTextSearchFilter` returns exactly what client-side `matchItem` matches. Requires a running replica-set Mongo. The test connects to `MONGO_URL` (default `mongodb://localhost:27018/?replicaSet=rs0`); if unreachable it should `skip` (so the unit-test wave never hard-fails on no-DB).

- [ ] **`parity.test.ts`:**
```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { MongoClient } from 'mongodb'
import { matchItem, buildCorpus } from '@quaesitor-textus/core'
import { computeSearchFields, createSearchIndexes, buildTextSearchFilter } from './index'
import type { MongoSearchConfig } from './config'

const URL = process.env.MONGO_URL ?? 'mongodb://localhost:27018/?replicaSet=rs0'
const config: MongoSearchConfig = {
  targets: { name: { fields: ['name'], queryModes: [{ caseSensitive: true }] } },
}
const DOCS = [
  { name: 'Gabriel García Márquez' },
  { name: 'GARCIA lopez' },
  { name: 'Wei Ng' },
  { name: 'Plain Author' },
  { name: 'café society' },
]

let client: MongoClient
let available = true

beforeAll(async () => {
  try {
    client = await MongoClient.connect(URL, { serverSelectionTimeoutMS: 1500 })
    const col = client.db('qt_parity_test').collection('docs')
    await col.deleteMany({})
    await col.insertMany(DOCS.map(d => ({ ...d, ...computeSearchFields(d, config) })))
    await createSearchIndexes(col, config)
  } catch {
    available = false
  }
})
afterAll(async () => { await client?.close() })

async function serverMatches(patterns: string[], options?: any): Promise<string[]> {
  const col = client.db('qt_parity_test').collection('docs')
  const filter = buildTextSearchFilter('name', patterns, config, options)
  const rows = await col.find(filter).toArray()
  return rows.map(r => r.name).sort()
}
function clientMatches(patterns: string[], options?: any): string[] {
  return DOCS.filter(d => matchItem(buildCorpus(d, ['name']), patterns, options))
    .map(d => d.name).sort()
}

describe('client↔server parity', () => {
  const cases: Array<{ patterns: string[]; options?: any }> = [
    { patterns: ['garcia'] },                          // diacritic + case insensitive
    { patterns: ['ng'] },                              // 2-char (bigram path)
    { patterns: ['cafe'] },                            // diacritic fold
    { patterns: ['garcia', 'marquez'] },               // multi-pattern AND
    { patterns: ['GARCIA'], options: { caseSensitive: true } }, // case-sensitive mode
  ]
  for (const c of cases) {
    it(`parity: ${JSON.stringify(c)}`, async () => {
      if (!available) return
      expect(await serverMatches(c.patterns, c.options)).toEqual(clientMatches(c.patterns, c.options))
    })
  }
})
```

### Task T15: mongo README (head-to-toe docs)
**Files:** Create `packages/mongo/README.md`

- [ ] Write a README with these sections (prose + code, no placeholders):
  1. **What it is / why** — server-side companion reproducing client matching, index-backed, no server JS.
  2. **Mongo setup** — run as single-node replica set (stock `mongo:7`: `mongod --replSet rs0 --bind_ip_all` then `mongosh --eval 'rs.initiate()'`), and `await createSearchIndexes(collection, config)`.
  3. **Server wiring** — define a `MongoSearchConfig`; on every write merge `computeSearchFields(doc, config)` into docs OR run `startSearchSync(collection, config)` (recommended; explain the replica-set + async-staleness trade-off and that read-your-writes on text isn't guaranteed); translate a text-search node via `buildTextSearchFilter(target, patterns, config, options)`.
  4. **Client usage** — three escalating examples: (a) naive single-field (tokenize with core `parseInput`, POST `patterns`, call `buildTextSearchFilter`); (b) two-field author+title (`$or` of two fragments); (c) inside a predicate tree — a **reasonable generic** predicate (`{TEXT}`, `{AND}`, `{OR}`, a scalar leaf) with an explicit note: *this package does not own or assume your filter syntax; here is one reasonable shape.*
  5. **Maintenance alternatives** — note Mongoose-plugin / driver-wrapper exist but require racy read-modify-write on partial `$set` (no server-side recompute possible); watcher is the shipped mechanism.
  6. Pointer to `packages/demo` as the runnable companion.

### Task T16: demo package manifest + tsconfigs
**Files:** Create `packages/demo/package.json`, `packages/demo/tsconfig.json`, `packages/demo/tsconfig.server.json`

- [ ] **`package.json`:**
```json
{
  "name": "@quaesitor-textus/demo",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev:server": "tsx watch --conditions=development src/server/index.ts",
    "dev:client": "vite",
    "seed": "tsx --conditions=development src/seed.ts",
    "build": "vite build"
  },
  "dependencies": {
    "@quaesitor-textus/core": "workspace:*",
    "@quaesitor-textus/mongo": "workspace:*",
    "antd": "^5.0.0",
    "fastify": "^4.0.0",
    "mongodb": "^6.0.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.0.0",
    "tsx": "^4.0.0",
    "typescript": "^5.4.0",
    "vite": "^5.0.0"
  }
}
```
- [ ] **`tsconfig.json`** (client):
```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": { "noEmit": true },
  "include": ["src"]
}
```
- [ ] **`tsconfig.server.json`:**
```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": { "noEmit": true, "types": ["node"] },
  "include": ["src/server", "src/shared", "src/seed.ts"]
}
```

### Task T17: vite config + html
**Files:** Create `packages/demo/vite.config.ts`, `packages/demo/index.html`

- [ ] **`vite.config.ts`:**
```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Resolve workspace libs to TS source for instant cross-package HMR.
  resolve: { conditions: ['development'] },
  server: {
    port: 5173,
    proxy: { '/api': 'http://localhost:3001' },
  },
})
```
- [ ] **`index.html`:**
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>quaesitor-textus — MongoDB book search</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/client/main.tsx"></script>
  </body>
</html>
```

### Task T18: docker-compose (single-node RS Mongo)
**Files:** Create `packages/demo/docker-compose.yml`

- [ ] **`docker-compose.yml`** (port 27018; healthcheck performs `rs.initiate()` idempotently):
```yaml
services:
  mongo:
    image: mongo:7
    command: ["mongod", "--replSet", "rs0", "--bind_ip_all", "--port", "27017"]
    ports:
      - "27018:27017"
    healthcheck:
      test: >
        mongosh --quiet --eval
        "try { rs.status().ok } catch (e) { rs.initiate({_id:'rs0',members:[{_id:0,host:'localhost:27017'}]}) }"
      interval: 5s
      timeout: 10s
      retries: 20
      start_period: 5s
```

### Task T19: Makefile
**Files:** Create `packages/demo/Makefile`

- [ ] **`Makefile`** (self-documenting; `help` is default):
```makefile
.DEFAULT_GOAL := help
COMPOSE := docker compose

.PHONY: help install build run-backend run-frontend mongo-up mongo-down seed clean

help: ## List available targets
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
	  awk 'BEGIN{FS=":.*?## "}{printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}'

install: ## Install all workspace dependencies
	cd ../.. && pnpm install

build: ## Build the client bundle
	pnpm build

run-backend: ## Run the Fastify API (dev, cross-package HMR)
	pnpm dev:server

run-frontend: ## Run the Vite dev server (proxies /api -> backend)
	pnpm dev:client

mongo-up: ## Start single-node replica-set MongoDB on :27018
	$(COMPOSE) up -d
	@echo "Waiting for replica set to be ready..."
	@until docker compose exec -T mongo mongosh --quiet --eval "rs.status().ok" >/dev/null 2>&1; do sleep 2; done
	@echo "MongoDB replica set ready on :27018"

mongo-down: ## Stop MongoDB
	$(COMPOSE) down

seed: ## Seed the first 1000 books + create indexes
	pnpm seed

clean: ## Remove build artifacts, node_modules, caches
	rm -rf dist node_modules .vite
```

### Task T20: demo search config
**Files:** Create `packages/demo/src/shared/config.ts`

- [ ] Exactly the **Demo data + config** `config.ts` contract block:
```ts
import type { MongoSearchConfig } from '@quaesitor-textus/mongo'

export const DEMO_NAMESPACE = '_qt'
export const demoConfig: MongoSearchConfig = {
  namespace: DEMO_NAMESPACE,
  ngramSizes: [2, 3],
  targets: {
    author: { fields: ['author'], queryModes: [{ caseSensitive: true }] },
    title:  { fields: ['title'],  queryModes: [{ caseSensitive: true }] },
  },
}
```

### Task T21: deterministic book generator
**Files:** Create `packages/demo/src/shared/generator.ts`

- [ ] Implement deterministic generation. Import the real classics from core's sample data via relative source path (private demo, dev-only — avoids duplicating the dataset). Contract: `Book`, `TOTAL_BOOKS=10000`, `SEED_COUNT=1000`, `TRUCK_SIZE=1000`, `generateBooks(count?)`.
```ts
// Reuse the canonical sample classics rather than duplicating them.
import { books as classics } from '../../../core/stories/data/books'

export interface Book { _id: string; author: string; title: string; year: number }
export const TOTAL_BOOKS = 10000
export const SEED_COUNT = 1000
export const TRUCK_SIZE = 1000

function mulberry32(a: number) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Diacritic-rich pool (García Márquez is reserved/injected separately, NOT here)
// plus a 2-char surname ('Wei Ng') to exercise the bigram path.
const AUTHORS = [
  'Émile Zola', 'Søren Kierkegaard', 'Charlotte Brontë', 'Karel Čapek',
  'Jorge Luis Borges', 'Albert Camus', 'Antoine de Saint-Exupéry',
  'Fyodor Dostoyevskij', 'José Saramago', 'Stanisław Lem', 'Wei Ng',
  'Naguib Mahfouz', 'Halldór Laxness', 'Knut Hamsun', 'Yukio Mishima',
]
const ADJ = ['Silent', 'Crimson', 'Hidden', 'Eternal', 'Broken', 'Golden', 'Distant', 'Hollow']
const NOUN = ['Garden', 'River', 'Empire', 'Shadow', 'Mirror', 'Harvest', 'Lantern', 'Citadel']
const RESERVED_INDEX = 1500 // lands inside the first truckload batch (1000..1999)

export function generateBooks(count: number = TOTAL_BOOKS): Book[] {
  const rand = mulberry32(0x9e3779b9)
  const out: Book[] = []
  for (let i = 0; i < count; i++) {
    let author: string
    let title: string
    let year: number
    if (i < classics.length) {
      author = classics[i].author
      title = classics[i].title
      year = classics[i].year
    } else if (i === RESERVED_INDEX) {
      author = 'Gabriel García Márquez'
      title = 'One Hundred Years of Solitude'
      year = 1967
    } else {
      author = AUTHORS[Math.floor(rand() * AUTHORS.length)]
      title = `The ${ADJ[Math.floor(rand() * ADJ.length)]} ${NOUN[Math.floor(rand() * NOUN.length)]}`
      year = -800 + Math.floor(rand() * 2824) // -800 .. 2023
    }
    out.push({ _id: `book-${i}`, author, title, year })
  }
  return out
}
```
> Note for the orchestrator: if the relative import path `../../../core/stories/data/books` does not resolve from `packages/demo/src/shared/`, adjust the depth in the Final Phase — the canonical file is `packages/core/stories/data/books.ts` exporting `books: Book[]` (fields `author`, `title`, `year`).

### Task T22: demo predicate language
**Files:** Create `packages/demo/src/shared/predicate.ts`

- [ ] Exactly the **Demo predicate** contract block (`DemoPredicate` union + `and`/`or`/`text`/`yearRange` builders).

### Task T23: predicate → Mongo translator
**Files:** Create `packages/demo/src/shared/predicateToMongo.ts`

- [ ] **`predicateToMongo.ts`:**
```ts
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
```

### Task T24: Fastify server
**Files:** Create `packages/demo/src/server/index.ts`

- [ ] **`server/index.ts`:**
```ts
import Fastify from 'fastify'
import { MongoClient } from 'mongodb'
import { createSearchIndexes, startSearchSync } from '@quaesitor-textus/mongo'
import { demoConfig } from '../shared/config'
import { predicateToMongo } from '../shared/predicateToMongo'
import type { DemoPredicate } from '../shared/predicate'
import { generateBooks, TOTAL_BOOKS, TRUCK_SIZE } from '../shared/generator'

const URL = process.env.MONGO_URL ?? 'mongodb://localhost:27018/?replicaSet=rs0'
const PORT = Number(process.env.PORT ?? 3001)

async function main() {
  const client = await MongoClient.connect(URL)
  const col = client.db('demo').collection('books')
  await createSearchIndexes(col, demoConfig)
  startSearchSync(col, demoConfig)

  const app = Fastify({ logger: true })

  app.get('/api/books', async (req) => {
    const q = req.query as Record<string, string>
    const page = Math.max(1, Number(q.page ?? 1))
    const pageSize = Math.min(100, Math.max(1, Number(q.pageSize ?? 10)))
    const filter = q.filter
      ? predicateToMongo(JSON.parse(q.filter) as DemoPredicate, demoConfig)
      : {}
    const [items, total] = await Promise.all([
      col.find(filter).skip((page - 1) * pageSize).limit(pageSize).toArray(),
      col.countDocuments(filter),
    ])
    return { items, total, page, pageSize }
  })

  app.post('/api/truckload', async () => {
    const n = await col.countDocuments({})
    if (n >= TOTAL_BOOKS) return { inserted: 0, total: n }
    // Insert the next batch RAW (no derived fields) — the watcher fills them in.
    const batch = generateBooks(TOTAL_BOOKS).slice(n, n + TRUCK_SIZE)
    try {
      await col.insertMany(batch, { ordered: false })
    } catch { /* dup-key no-ops on re-click are expected */ }
    const total = await col.countDocuments({})
    return { inserted: total - n, total }
  })

  await app.listen({ port: PORT, host: '0.0.0.0' })
}

main().catch(err => { console.error(err); process.exit(1) })
```
(The server relies on the change-stream **watcher** to derive search fields — it does not compute them inline; only the seed path uses `computeSearchFields`.)

### Task T25: seed script
**Files:** Create `packages/demo/src/seed.ts`

- [ ] **`seed.ts`:**
```ts
import { MongoClient } from 'mongodb'
import { computeSearchFields, createSearchIndexes } from '@quaesitor-textus/mongo'
import { demoConfig } from './shared/config'
import { generateBooks, SEED_COUNT } from './shared/generator'

const URL = process.env.MONGO_URL ?? 'mongodb://localhost:27018/?replicaSet=rs0'

async function main() {
  const client = await MongoClient.connect(URL)
  const col = client.db('demo').collection('books')
  await col.deleteMany({})
  // Seed only the first SEED_COUNT books, WITH derived fields (batch).
  const seedDocs = generateBooks().slice(0, SEED_COUNT)
    .map(b => ({ ...b, ...computeSearchFields(b, demoConfig) }))
  await col.insertMany(seedDocs)
  await createSearchIndexes(col, demoConfig)
  console.log(`Seeded ${seedDocs.length} books; indexes created.`)
  await client.close()
}

main().catch(err => { console.error(err); process.exit(1) })
```

### Task T26: client API helpers
**Files:** Create `packages/demo/src/client/api.ts`

- [ ] **`api.ts`:**
```ts
import type { DemoPredicate } from '../shared/predicate'
import type { Book } from '../shared/generator'

export interface BooksResponse { items: Book[]; total: number; page: number; pageSize: number }

export async function searchBooks(
  predicate: DemoPredicate, page: number, pageSize: number,
): Promise<BooksResponse> {
  const params = new URLSearchParams({
    filter: JSON.stringify(predicate), page: String(page), pageSize: String(pageSize),
  })
  const res = await fetch(`/api/books?${params}`)
  if (!res.ok) throw new Error(`search failed: ${res.status}`)
  return res.json()
}

export async function truckload(): Promise<{ inserted: number; total: number }> {
  const res = await fetch('/api/truckload', { method: 'POST' })
  if (!res.ok) throw new Error(`truckload failed: ${res.status}`)
  return res.json()
}
```

### Task T27: client entry
**Files:** Create `packages/demo/src/client/main.tsx`

- [ ] **`main.tsx`:**
```tsx
import React from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
```

### Task T28: client App (UI)
**Files:** Create `packages/demo/src/client/App.tsx`

- [ ] **`App.tsx`** — server-side book search UI mirroring the existing antd BookSearchDemo, plus year-range, per-input case-sensitive checkbox, and truckload. Uses core `WithSearch`/`SearchInput`/`HighlightedText`/`useSearchContext` for input+highlight; builds a `DemoPredicate` from the live patterns; fetches paginated results from the server.
```tsx
import React, { useEffect, useMemo, useState } from 'react'
import { Table, Switch, Space, Slider, Checkbox, Button, Typography } from 'antd'
import type { TableColumnsType } from 'antd'
import {
  WithSearch, SearchInput, HighlightedText, useSearchContext,
} from '@quaesitor-textus/core'
import { and, or, text, yearRange } from '../shared/predicate'
import type { DemoPredicate } from '../shared/predicate'
import { searchBooks, truckload } from './api'
import type { Book } from '../shared/generator'

const YEAR_MIN = -800
const YEAR_MAX = 2024

function Results({
  mode, years, authorCS, titleCS,
}: { mode: 'AND' | 'OR'; years: [number, number]; authorCS: boolean; titleCS: boolean }) {
  const { patterns: authorP } = useSearchContext('author')
  const { patterns: titleP } = useSearchContext('title')
  const [page, setPage] = useState(1)
  const pageSize = 10
  const [data, setData] = useState<{ items: Book[]; total: number }>({ items: [], total: 0 })

  const predicate: DemoPredicate = useMemo(() => {
    const textNodes: DemoPredicate[] = []
    if (authorP.length) textNodes.push(text('author', authorP, authorCS ? { caseSensitive: true } : undefined))
    if (titleP.length) textNodes.push(text('title', titleP, titleCS ? { caseSensitive: true } : undefined))
    const textPart = textNodes.length ? (mode === 'AND' ? and(...textNodes) : or(...textNodes)) : null
    const yearPart = yearRange(years[0], years[1])
    return textPart ? and(textPart, yearPart) : yearPart
  }, [authorP, titleP, mode, years, authorCS, titleCS])

  useEffect(() => { setPage(1) }, [predicate])
  useEffect(() => {
    let live = true
    searchBooks(predicate, page, pageSize).then(r => { if (live) setData({ items: r.items, total: r.total }) })
    return () => { live = false }
  }, [predicate, page])

  const columns: TableColumnsType<Book> = [
    { title: 'Author', dataIndex: 'author',
      render: (a: string) => <HighlightedText text={a} searchNames="author" /> },
    { title: 'Title', dataIndex: 'title',
      render: (t: string) => <HighlightedText text={t} searchNames="title" /> },
    { title: 'Year', dataIndex: 'year', width: 90 },
  ]
  return (
    <>
      <Typography.Paragraph type="secondary">{data.total} matching books</Typography.Paragraph>
      <Table<Book>
        rowKey="_id"
        dataSource={data.items}
        columns={columns}
        pagination={{ current: page, pageSize, total: data.total, onChange: setPage }}
      />
    </>
  )
}

export function App() {
  const [mode, setMode] = useState<'AND' | 'OR'>('AND')
  const [years, setYears] = useState<[number, number]>([YEAR_MIN, YEAR_MAX])
  const [authorCS, setAuthorCS] = useState(false)
  const [titleCS, setTitleCS] = useState(false)
  const [truckMsg, setTruckMsg] = useState('')

  const onTruck = async () => {
    const r = await truckload()
    setTruckMsg(`Delivered ${r.inserted}; ${r.total} total (${10000 - r.total} left). Becoming searchable…`)
  }

  return (
    <WithSearch name="author" field="author">
      <WithSearch name="title" field="title">
        <div style={{ fontFamily: 'sans-serif', padding: 24, maxWidth: 900, margin: '0 auto' }}>
          <h2>quaesitor-textus — server-side book search (MongoDB)</h2>
          <Space wrap style={{ marginBottom: 12 }}>
            <Space direction="vertical" size={0}>
              <SearchInput name="author" placeholder="Search author" style={{ width: 220 }} />
              <Checkbox checked={authorCS} onChange={e => setAuthorCS(e.target.checked)}>case sensitive</Checkbox>
            </Space>
            <Space>
              <span>AND</span>
              <Switch checked={mode === 'OR'} onChange={c => setMode(c ? 'OR' : 'AND')} size="small" />
              <span>OR</span>
            </Space>
            <Space direction="vertical" size={0}>
              <SearchInput name="title" placeholder="Search title" style={{ width: 220 }} />
              <Checkbox checked={titleCS} onChange={e => setTitleCS(e.target.checked)}>case sensitive</Checkbox>
            </Space>
          </Space>
          <div style={{ maxWidth: 400, marginBottom: 12 }}>
            <span>Year: {years[0]} – {years[1]}</span>
            <Slider range min={YEAR_MIN} max={YEAR_MAX} value={years} onChange={v => setYears(v as [number, number])} />
          </div>
          <Space style={{ marginBottom: 16 }}>
            <Button type="primary" onClick={onTruck}>Receive a truckload of new books (1000)</Button>
            <span style={{ color: '#888' }}>{truckMsg}</span>
          </Space>
          <Results mode={mode} years={years} authorCS={authorCS} titleCS={titleCS} />
        </div>
      </WithSearch>
    </WithSearch>
  )
}
```

### Task T29: demo README
**Files:** Create `packages/demo/README.md`

- [ ] Write a README: what the demo shows (server-side diacritic/case-insensitive substring search + year range, paginated; live watcher via the truckload button); prerequisites (Docker, pnpm); quickstart (`make install`, `make mongo-up`, `make seed`, then `make run-backend` + `make run-frontend` in two terminals, open http://localhost:5173); how to verify the watcher (search `garcia` → no hits → click the truckload button → after a moment `García Márquez` appears); and `make help` for all targets.

---

## FINAL PHASE (orchestrator only — after the wave lands)

Run sequentially from the main loop. Agents did NOT run git/tests; do it all here.

- [ ] **F1 — install & wire workspace.** From repo root: `pnpm install` (registers `packages/mongo` + `packages/demo`, links `workspace:*`). Confirm pnpm picks up both new packages.
- [ ] **F2 — fix the classics import depth (T21).** Verify `packages/demo/src/shared/generator.ts`'s import of `../../../core/stories/data/books` resolves; correct the relative depth if needed (canonical file: `packages/core/stories/data/books.ts`).
- [ ] **F3 — typecheck & build.** `pnpm -r build` (builds core, antd, mongo). Fix any compile errors surfaced (this is where interim breakage from broken barriers gets resolved). Run `tsc --noEmit` per new package if needed.
- [ ] **F4 — unit tests.** `pnpm --filter @quaesitor-textus/core test` and `pnpm --filter @quaesitor-textus/mongo test`. Fix failures. (Parity test `parity.test.ts` self-skips if no Mongo is up.)
- [ ] **F5 — integration smoke (optional but recommended).** `cd packages/demo && make mongo-up && make seed`, start `make run-backend`, `curl 'http://localhost:3001/api/books?filter=%7B%22TEXT%22%3A%7B%22target%22%3A%22author%22%2C%22patterns%22%3A%5B%22garcia%22%5D%7D%7D&page=1&pageSize=10'` → expect `total: 0` before truckload; `curl -XPOST http://localhost:3001/api/truckload` → wait a moment → re-run the search → expect `García Márquez` in items. Re-run the mongo `parity.test.ts` now that a replica set is up. Tear down with `make mongo-down`.
- [ ] **F6 — commit.** Stage everything and commit (one commit, or split core/mongo/demo). Suggested message:
```
feat(mongo): add @quaesitor-textus/mongo server-side search + demo

- core: add toNgrams + buildCorpus (extracted from useFilterFunction);
  add development exports condition for source HMR
- mongo: n-gram-indexed, diacritic/case-insensitive substring search with
  pre-folded verify strings, zero server-side JS; change-stream watcher
- demo: full-stack Fastify + Vite/React/antd book search over MongoDB with
  server-side pagination, year-range predicate composition, and a live
  watcher showcase (truckload button)
```
Use the repo's Co-Authored-By trailer.

---

## Notes on parallel shape (why this plan looks different from default writing-plans)

- **No per-task tests/commits.** Tests are written *with* their implementation but run only in F4. Commits happen only in F6. This keeps every Wave-1 task file-disjoint and concurrently executable.
- **Barriers deliberately broken.** E.g. T3 imports `buildCorpus` (T2), T4 exports symbols from T1/T2, the whole mongo package imports core's not-yet-built additions, the demo imports mongo. None of these block scheduling — they resolve in F1–F4.
- **Each file has exactly one owner** — including shared/aggregating files (`core/src/index.ts` = T4 only; `core/package.json` = T5 only).
- **Recursive fan-out available:** the README tasks (T15, T29) and the demo client are independent files; if any single task is large, the executor may fan out further, pinning the contracts above.
