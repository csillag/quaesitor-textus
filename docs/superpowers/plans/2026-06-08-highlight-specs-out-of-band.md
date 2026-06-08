# Highlight Specs Out-of-Band Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop polluting the mongo filter with the `__qtHighlights` tag; `buildTextSearchFilter` returns a clean `Filter` again, and highlight info travels out-of-band as `HighlightSpec[]` passed to the live-search layer. Fixes `/api/books` (and any direct filter consumer) returning zero.

**Architecture:** Revert the tag embedding. A new `HighlightSpec { target, patterns, options }` (the same triple already passed to `buildTextSearchFilter`) is collected by the consumer during its own predicate walk and passed to `createLiveSearch`/`streamLiveSearch`. `computeHighlights(specs, doc, config)` folds internally (sharing a `resolveMode` helper with `buildTextSearchFilter` so folding can't drift) and builds the `_highlights` sidecar. The client side (`HighlightedCell`, sidecar shape) is unchanged. Spec: `docs/superpowers/specs/2026-06-08-highlight-specs-out-of-band-design.md`.

**Tech Stack:** TypeScript, Vitest, mongodb driver, Fastify, tsup/vite. Packages: `@quaesitor-textus/mongo`, `@quaesitor-textus/demo`. (No `@quaesitor-textus/core` changes.)

---

## Plan shape (parallel execution)

Parallel-shaped per `feedback-parallel-shaped-plans`. Tasks 1–9 are **file-disjoint** and run **concurrently**. **No per-task test runs or commits** — all verification and commits happen in **Task 10**.

File ownership:

| Task | Owns (create/modify/delete) |
|------|------------------------------|
| 1 | `packages/mongo/src/modes.ts` (add `resolveMode`), `packages/mongo/src/resolveMode.test.ts` (new) |
| 2 | `packages/mongo/src/buildTextSearchFilter.ts` (revert), `packages/mongo/src/buildTextSearchFilter.test.ts` (add regression `it`), `packages/mongo/src/buildTextSearchFilter.highlight.test.ts` (DELETE) |
| 3 | `packages/mongo/src/computeHighlights.ts` (rewrite), `packages/mongo/src/computeHighlights.test.ts` (rewrite) |
| 4 | `packages/mongo/src/createLiveSearch.ts` (rewrite), `packages/mongo/src/createLiveSearch.highlight.test.ts` (rewrite) |
| 5 | `packages/mongo/src/adapters/shared.ts` (modify), `packages/mongo/src/adapters/shared.highlight.test.ts` (rewrite) |
| 6 | `packages/mongo/src/index.ts` (modify exports) |
| 7 | `packages/mongo/README.md` (replace Highlighting section) |
| 8 | `packages/demo/src/shared/predicateToHighlightSpecs.ts` (new) |
| 9 | `packages/demo/src/server/index.ts` (modify `/api/live`) |
| 10 | verification only (build + test, then commit; may touch any file to fix integration) |

## Pinned shared contracts

**`resolveMode`** (Task 1; used by Tasks 2, 3):
```ts
export function resolveMode(config: MongoSearchConfig, target: string, options?: SearchOptions): SearchOptions
// returns options ?? config.targets[target]?.options ?? {}
```

**`HighlightSpec`** (defined in `computeHighlights.ts`, Task 3; exported from index, Task 6; imported by Tasks 4, 5, 8):
```ts
export interface HighlightSpec { target: string; patterns: string[]; options?: SearchOptions }
```

**`computeHighlights`** (Task 3; used by Task 4):
```ts
export function computeHighlights(specs: HighlightSpec[], doc: Document, config: MongoSearchConfig): RecordHighlights
```

**Option name** (Tasks 4, 5, 9): `highlightSpecs?: HighlightSpec[]` (replaces the removed `highlight?: boolean`).
**Removed entirely:** `__qtHighlights` filter key, `collectHighlightTags`, `HighlightTag`.
**Sidecar shape (unchanged):** `_highlights[target] = { tokens: string[]; fields: string[] }`.

---

## Task 1: Shared `resolveMode` helper

**Files:**
- Modify `packages/mongo/src/modes.ts`
- Create `packages/mongo/src/resolveMode.test.ts`

- [ ] **Step 1: Add `resolveMode` to `modes.ts`**

`packages/mongo/src/modes.ts` currently starts:
```ts
import type { SearchOptions } from '@quaesitor-textus/core'
import type { MongoSearchTarget } from './config'
```
Change those two import lines to:
```ts
import type { SearchOptions } from '@quaesitor-textus/core'
import type { MongoSearchTarget, MongoSearchConfig } from './config'
```
Then append to the end of the file:
```ts
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
```

- [ ] **Step 2: Write the test**

`packages/mongo/src/resolveMode.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { resolveMode } from './modes'
import type { MongoSearchConfig } from './config'

const config: MongoSearchConfig = {
  targets: {
    plain: { fields: ['a'] },
    cs: { fields: ['b'], options: { caseSensitive: true } },
  },
}

describe('resolveMode', () => {
  it('prefers explicit options', () => {
    expect(resolveMode(config, 'cs', { diacriticSensitive: true })).toEqual({ diacriticSensitive: true })
  })
  it('falls back to the target options', () => {
    expect(resolveMode(config, 'cs')).toEqual({ caseSensitive: true })
  })
  it('defaults to fully-folded {}', () => {
    expect(resolveMode(config, 'plain')).toEqual({})
  })
  it('defaults to {} for an unknown target', () => {
    expect(resolveMode(config, 'nope')).toEqual({})
  })
})
```

---

## Task 2: `buildTextSearchFilter` returns a clean filter again

**Files:**
- Modify `packages/mongo/src/buildTextSearchFilter.ts`
- Modify `packages/mongo/src/buildTextSearchFilter.test.ts` (add a regression test)
- Delete `packages/mongo/src/buildTextSearchFilter.highlight.test.ts`

- [ ] **Step 1: Replace `buildTextSearchFilter.ts` with the clean version**

Replace the entire file `packages/mongo/src/buildTextSearchFilter.ts` with:
```ts
import { normalizeText, toNgrams } from '@quaesitor-textus/core'
import type { SearchOptions } from '@quaesitor-textus/core'
import type { Document, Filter } from 'mongodb'
import type { MongoSearchConfig } from './config'
import { DEFAULT_NAMESPACE, DEFAULT_NGRAM_SIZES } from './config'
import { modeKey, escapeRegex, resolveMode } from './modes'

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
  const mode = resolveMode(config, target, options)

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

- [ ] **Step 2: Add a regression test to `buildTextSearchFilter.test.ts`**

In `packages/mongo/src/buildTextSearchFilter.test.ts`, add this `it` block immediately before the final closing `})` of the `describe('buildTextSearchFilter', ...)` block:
```ts
  it('returns a clean mongo filter with no reserved highlight keys (regression)', () => {
    // A polluted filter (a stray __qtHighlights key) makes mongo match zero docs.
    const f = buildTextSearchFilter('author', ['café'], config) as any
    expect(f.__qtHighlights).toBeUndefined()
    expect(Object.keys(f)).toEqual(['$and'])
  })
```

- [ ] **Step 3: Delete the obsolete highlight test**

```bash
git rm packages/mongo/src/buildTextSearchFilter.highlight.test.ts
```
(If `git rm` is unavailable, `rm packages/mongo/src/buildTextSearchFilter.highlight.test.ts`.)

---

## Task 3: `computeHighlights` takes specs; remove tag machinery

**Files:**
- Modify (full rewrite) `packages/mongo/src/computeHighlights.ts`
- Modify (full rewrite) `packages/mongo/src/computeHighlights.test.ts`

- [ ] **Step 1: Replace `computeHighlights.ts`**

Replace the entire file `packages/mongo/src/computeHighlights.ts` with:
```ts
import { normalizeText, buildCorpus } from '@quaesitor-textus/core'
import type { RecordHighlights, SearchOptions } from '@quaesitor-textus/core'
import type { Document } from 'mongodb'
import type { MongoSearchConfig } from './config'
import { DEFAULT_NAMESPACE } from './config'
import { modeKey, resolveMode } from './modes'

/**
 * A highlight request for one text-search target: the same `{ target, patterns,
 * options }` triple a consumer passes to `buildTextSearchFilter`. The consumer
 * collects these during its own predicate walk and passes them to the live search.
 */
export interface HighlightSpec {
  target: string
  patterns: string[]
  options?: SearchOptions
}

/**
 * Build the per-record `_highlights` sidecar from the query's highlight specs.
 * For each spec, fold its patterns (mode resolved the same way buildTextSearchFilter
 * does) and test them against the record's already-stored folded target text
 * `ns.<target>.<modeKey>`; if that field was projected out, refold the target's corpus
 * from the raw fields. A hit marks all the target's fields (exact for single-field
 * targets; a safe superset for multi-field targets, where the client no-ops on fields
 * that do not actually contain a token).
 */
export function computeHighlights(
  specs: HighlightSpec[],
  doc: Document,
  config: MongoSearchConfig,
): RecordHighlights {
  const ns = config.namespace ?? DEFAULT_NAMESPACE
  const result: RecordHighlights = {}
  for (const spec of specs) {
    const target = config.targets[spec.target]
    if (!target) continue
    const mode = resolveMode(config, spec.target, spec.options)
    const tokens = spec.patterns.map(p => normalizeText(p, mode))
    const stored = (doc?.[ns] as Record<string, Record<string, unknown>> | undefined)
      ?.[spec.target]?.[modeKey(mode)]
    const folded = typeof stored === 'string'
      ? stored
      : normalizeText(buildCorpus(doc, target.fields), mode)
    if (tokens.some(t => folded.includes(t))) {
      result[spec.target] = { tokens, fields: target.fields }
    }
  }
  return result
}
```

- [ ] **Step 2: Replace `computeHighlights.test.ts`**

Replace the entire file `packages/mongo/src/computeHighlights.test.ts` with:
```ts
import { describe, it, expect } from 'vitest'
import { computeHighlights } from './computeHighlights'
import type { HighlightSpec } from './computeHighlights'
import type { MongoSearchConfig } from './config'

const config: MongoSearchConfig = {
  targets: {
    author: { fields: ['author'] },
    title: { fields: ['title'], queryModes: [{ caseSensitive: true }] },
    meta: { fields: ['author', 'title'] },
  },
}
const spec = (target: string, patterns: string[], options?: any): HighlightSpec => ({ target, patterns, options })

describe('computeHighlights', () => {
  it('flags a single-field target whose stored folded text contains the folded token', () => {
    const doc = { author: 'Tolstoy', _qt: { author: { norm: 'tolstoy' } } }
    expect(computeHighlights([spec('author', ['Tolst'])], doc, config)).toEqual({
      author: { tokens: ['tolst'], fields: ['author'] },
    })
  })

  it('omits a target whose token is absent', () => {
    const doc = { author: 'Tolstoy', _qt: { author: { norm: 'tolstoy' } } }
    expect(computeHighlights([spec('author', ['dostoy'])], doc, config)).toEqual({})
  })

  it('marks all fields of a multi-field target (fallback) when the corpus matches', () => {
    const doc = { author: 'Tolstoy', title: 'War', _qt: { meta: { norm: 'tolstoy war' } } }
    expect(computeHighlights([spec('meta', ['war'])], doc, config)).toEqual({
      meta: { tokens: ['war'], fields: ['author', 'title'] },
    })
  })

  it('refolds from raw fields when the stored folded text is absent (fallback)', () => {
    const doc = { title: 'Weiß' } // no _qt projected; ß→ss folding must still match
    expect(computeHighlights([spec('title', ['weiss'])], doc, config)).toEqual({
      title: { tokens: ['weiss'], fields: ['title'] },
    })
  })

  it('builds entries for multiple specs (compound query)', () => {
    const doc = { author: 'Tolstoy', title: 'War', _qt: { author: { norm: 'tolstoy' }, title: { norm: 'war' } } }
    expect(computeHighlights([spec('author', ['tolst']), spec('title', ['war'])], doc, config)).toEqual({
      author: { tokens: ['tolst'], fields: ['author'] },
      title: { tokens: ['war'], fields: ['title'] },
    })
  })

  it('uses the per-spec options to select the verify mode (case-sensitive)', () => {
    // caseSensitive mode reads _qt.title.norm_cs and does not lowercase the token.
    const doc = { title: 'War', _qt: { title: { norm: 'war', norm_cs: 'War' } } }
    expect(computeHighlights([spec('title', ['War'], { caseSensitive: true })], doc, config)).toEqual({
      title: { tokens: ['War'], fields: ['title'] },
    })
    // The same token folded to the default mode would NOT match norm_cs.
    expect(computeHighlights([spec('title', ['war'], { caseSensitive: true })], doc, config)).toEqual({})
  })

  it('ignores specs for unknown targets', () => {
    const doc = { author: 'Tolstoy', _qt: { author: { norm: 'tolstoy' } } }
    expect(computeHighlights([spec('nope', ['x'])], doc, config)).toEqual({})
  })
})
```

---

## Task 4: `createLiveSearch` takes `highlightSpecs` (no tags, no strip)

**Files:**
- Modify (full rewrite) `packages/mongo/src/createLiveSearch.ts`
- Modify (full rewrite) `packages/mongo/src/createLiveSearch.highlight.test.ts`

- [ ] **Step 1: Replace `createLiveSearch.ts`**

Replace the entire file `packages/mongo/src/createLiveSearch.ts` with:
```ts
import type { Collection, Document, Filter } from 'mongodb'
import type { MongoSearchConfig } from './config'
import type { SearchSync, SearchSyncEvent } from './startSearchSync'
import { computeHighlights } from './computeHighlights'
import type { HighlightSpec } from './computeHighlights'

export type LiveEvent =
  | { type: 'snapshot'; items: Document[] }
  | { type: 'match'; item: Document }
  | { type: 'matches'; items: Document[] }
  | { type: 'capped' }

export interface CreateLiveSearchOptions {
  sync: SearchSync
  collection: Collection
  config: MongoSearchConfig
  filter: Filter<Document>
  sort?: { field: string; dir: 1 | -1 }
  cap?: number
  /**
   * When set, per-doc matches are buffered and flushed as a single
   * `{type:'matches', items}` event at most once per `coalesceMs` ms,
   * bounding emissions to ~1000/coalesceMs per second. When omitted,
   * each match is emitted immediately as `{type:'match', item}`.
   */
  coalesceMs?: number
  /**
   * Optional Mongo projection applied to both the snapshot query and the
   * per-match lookup, so excluded fields are never read from the database.
   * Use it to drop large internal fields (e.g. derived n-gram indexes) at the
   * source rather than filtering them out downstream.
   */
  projection?: Document
  /**
   * When present and non-empty, each emitted document is annotated with a
   * `_highlights` sidecar computed from these specs and the stored folded target
   * text. Specs travel out-of-band (the filter stays a plain mongo filter).
   */
  highlightSpecs?: HighlightSpec[]
  sendEvent: (event: LiveEvent) => void
}

// Transport-agnostic live search: emits the current matching set (capped), then
// matches for each newly-indexed document that matches `filter` (singular
// `match`, or coalesced `matches` batches when `coalesceMs` is set), then `capped`.
export function createLiveSearch(opts: CreateLiveSearchOptions): { stop: () => void } {
  const { sync, collection, config, filter, sort, cap = 500, coalesceMs, projection, sendEvent, highlightSpecs } = opts

  const annotate = (doc: Document): Document =>
    highlightSpecs && highlightSpecs.length > 0
      ? { ...doc, _highlights: computeHighlights(highlightSpecs, doc, config) }
      : doc
  const findOpts = projection ? { projection } : undefined
  const seen = new Set<string>()
  let count = 0
  let capped = false

  let buffer: Document[] = []
  let flushTimer: ReturnType<typeof setTimeout> | null = null

  const flush = () => {
    if (flushTimer != null) { clearTimeout(flushTimer); flushTimer = null }
    if (buffer.length === 0) return
    const items = buffer
    buffer = []
    sendEvent({ type: 'matches', items })
  }

  const emitMatch = (doc: Document) => {
    if (coalesceMs == null) {
      sendEvent({ type: 'match', item: doc })
      return
    }
    buffer.push(doc)
    if (flushTimer == null) flushTimer = setTimeout(flush, coalesceMs)
  }

  const idOf = (doc: Document) => String(doc._id)

  // Initial snapshot (sorted for a nicer first paint; client re-sorts anyway).
  const cursor = collection.find(filter, findOpts)
  if (sort) cursor.sort({ [sort.field]: sort.dir })
  void cursor.limit(cap).toArray().then((items) => {
    const annotated = items.map(annotate)
    for (const it of items) seen.add(idOf(it))
    count = items.length
    sendEvent({ type: 'snapshot', items: annotated })
    if (count >= cap) { capped = true; sendEvent({ type: 'capped' }) }
  }).catch(() => sendEvent({ type: 'snapshot', items: [] }))

  const listener = (e: SearchSyncEvent) => {
    if (e.type !== 'indexed' || capped) return
    void collection.findOne({ $and: [{ _id: e.id as any }, filter] }, findOpts)
      .then((doc) => {
        if (!doc || capped) return
        const id = idOf(doc)
        if (seen.has(id)) return
        seen.add(id)
        count += 1
        emitMatch(annotate(doc))
        if (count >= cap) { capped = true; flush(); sendEvent({ type: 'capped' }) }
      })
      .catch(() => { /* skip a failed match-test; keep the stream alive */ })
  }
  sync.on(listener)

  return {
    stop: () => {
      sync.off(listener)
      flush()
    },
  }
}
```

- [ ] **Step 2: Replace `createLiveSearch.highlight.test.ts`**

Replace the entire file `packages/mongo/src/createLiveSearch.highlight.test.ts` with:
```ts
import { describe, it, expect } from 'vitest'
import { createLiveSearch } from './createLiveSearch'
import type { LiveEvent } from './createLiveSearch'
import { buildTextSearchFilter } from './buildTextSearchFilter'
import type { MongoSearchConfig } from './config'

const config: MongoSearchConfig = { targets: { title: { fields: ['title'] }, author: { fields: ['author'] } } }

function stubCollection(snapshot: any[]) {
  const calls: any[] = []
  const collection: any = {
    calls,
    find(filter: any) {
      calls.push(filter)
      return { sort() { return this }, limit() { return this }, toArray: async () => snapshot }
    },
    findOne: async () => null,
  }
  return collection
}
const stubSync: any = { on() {}, off() {}, stop: async () => {} }

describe('createLiveSearch highlight annotation', () => {
  it('annotates snapshot items from highlightSpecs and passes the filter to mongo unchanged', async () => {
    const col = stubCollection([{ _id: '1', title: 'War and Peace', _qt: { title: { norm: 'war and peace' } } }])
    const filter: any = buildTextSearchFilter('title', ['war'], config)
    expect(filter.__qtHighlights).toBeUndefined() // filter is clean now

    const events: LiveEvent[] = []
    createLiveSearch({
      sync: stubSync, collection: col, config, filter,
      highlightSpecs: [{ target: 'title', patterns: ['war'] }],
      sendEvent: e => events.push(e),
    })
    await new Promise(r => setTimeout(r, 10))

    const snap = events.find(e => e.type === 'snapshot') as any
    expect(snap.items[0]._highlights).toEqual({ title: { tokens: ['war'], fields: ['title'] } })
    expect(col.calls[0]).toBe(filter) // filter handed to mongo untouched
  })

  it('annotates from multiple specs (compound query)', async () => {
    const col = stubCollection([{ _id: '1', title: 'War', author: 'Tolstoy', _qt: { title: { norm: 'war' }, author: { norm: 'tolstoy' } } }])
    const events: LiveEvent[] = []
    createLiveSearch({
      sync: stubSync, collection: col, config, filter: { $and: [] },
      highlightSpecs: [{ target: 'title', patterns: ['war'] }, { target: 'author', patterns: ['tolst'] }],
      sendEvent: e => events.push(e),
    })
    await new Promise(r => setTimeout(r, 10))
    const snap = events.find(e => e.type === 'snapshot') as any
    expect(snap.items[0]._highlights).toEqual({
      title: { tokens: ['war'], fields: ['title'] },
      author: { tokens: ['tolst'], fields: ['author'] },
    })
  })

  it('does not annotate when highlightSpecs is omitted', async () => {
    const col = stubCollection([{ _id: '1', title: 'War', _qt: { title: { norm: 'war' } } }])
    const events: LiveEvent[] = []
    createLiveSearch({ sync: stubSync, collection: col, config, filter: buildTextSearchFilter('title', ['war'], config), sendEvent: e => events.push(e) })
    await new Promise(r => setTimeout(r, 10))
    const snap = events.find(e => e.type === 'snapshot') as any
    expect(snap.items[0]._highlights).toBeUndefined()
  })
})
```

---

## Task 5: Adapters forward `highlightSpecs`

**Files:**
- Modify `packages/mongo/src/adapters/shared.ts`
- Modify (full rewrite) `packages/mongo/src/adapters/shared.highlight.test.ts`

- [ ] **Step 1: Replace `highlight` with `highlightSpecs` in `shared.ts`**

In `packages/mongo/src/adapters/shared.ts`:

(a) Add a `HighlightSpec` type import — after the line `import { createLiveSearch } from '../createLiveSearch'` add:
```ts
import type { HighlightSpec } from '../computeHighlights'
```

(b) In `StreamLiveSearchOptions`, replace this line:
```ts
  /** Forwarded to createLiveSearch: annotate emitted records with `_highlights`. */
  highlight?: boolean
```
with:
```ts
  /** Forwarded to createLiveSearch: out-of-band highlight specs to annotate records. */
  highlightSpecs?: HighlightSpec[]
```

(c) In `runLiveSearch`, in the `createLiveSearch({ ... })` call, replace `highlight: opts.highlight,` with:
```ts
    highlightSpecs: opts.highlightSpecs,
```

- [ ] **Step 2: Replace `adapters/shared.highlight.test.ts`**

Replace the entire file `packages/mongo/src/adapters/shared.highlight.test.ts` with:
```ts
import { describe, it, expect } from 'vitest'
import { runLiveSearch } from './shared'
import type { MongoSearchConfig } from '../config'

const config: MongoSearchConfig = { targets: { title: { fields: ['title'] } } }

function stubCollection(snapshot: any[]) {
  return {
    find() { return { sort() { return this }, limit() { return this }, toArray: async () => snapshot } },
    findOne: async () => null,
  } as any
}
const stubSync: any = { on() {}, off() {}, stop: async () => {} }

describe('runLiveSearch highlight forwarding', () => {
  it('forwards highlightSpecs so emitted records carry _highlights in the SSE stream', async () => {
    const col = stubCollection([{ _id: '1', title: 'War', _qt: { title: { norm: 'war' } } }])
    const chunks: string[] = []
    const { stop } = runLiveSearch(
      { sync: stubSync, collection: col, config, filter: {}, highlightSpecs: [{ target: 'title', patterns: ['war'] }] },
      c => chunks.push(c),
    )
    await new Promise(r => setTimeout(r, 10))
    stop()
    const joined = chunks.join('')
    expect(joined).toContain('"_highlights"')
    expect(joined).toContain('"title"')
  })
})
```

---

## Task 6: Update mongo package exports

**Files:** Modify `packages/mongo/src/index.ts`

- [ ] **Step 1: Swap the highlight exports**

In `packages/mongo/src/index.ts`, replace these two lines:
```ts
export { computeHighlights, collectHighlightTags } from './computeHighlights'
export type { HighlightTag } from './computeHighlights'
```
with:
```ts
export { computeHighlights } from './computeHighlights'
export type { HighlightSpec } from './computeHighlights'
```

---

## Task 7: Update the mongo README

**Files:** Modify `packages/mongo/README.md`

- [ ] **Step 1: Replace the Highlighting section body**

In `packages/mongo/README.md`, replace the example code block and the `__qtHighlights` paragraph and the fallback bullets of the `## Highlighting (server-side annotation)` section. Specifically, replace everything from the line:
```
Enable it on the live search (works through the SSE adapters too — `streamLiveSearch`,
```
down to the end of the file, with:
````markdown
Enable it by passing **out-of-band** highlight specs (works through the SSE adapters too
— `streamLiveSearch`, `streamToNodeResponse`):

```ts
createLiveSearch({
  sync, collection, config,
  filter: buildTextSearchFilter('title', patterns, config), // a plain mongo filter
  // same { target, patterns, options } triples passed to buildTextSearchFilter,
  // collected during your own predicate walk:
  highlightSpecs: [{ target: 'title', patterns }],
  // keep the folded verify fields so per-field tests need no re-folding;
  // dropping the big ngram arrays is fine:
  projection: { '_qt.title.ngrams': 0 },
  sendEvent,
})
```

Each emitted record gains a `_highlights` sidecar:

```ts
record._highlights = {
  title: { tokens: ['war'], fields: ['title'] }, // keyed by target === searchName
}
```

`buildTextSearchFilter` returns a **plain mongo filter** — highlight info never rides on
it, so the same filter is safe to run directly (`find` / `countDocuments`). Highlight
specs travel separately via `highlightSpecs`.

**Best-performance pattern:**
- Use **single-field targets** (one target per searchable field). Then the stored
  folded text `_qt.<target>.<mode>` *is* that field, so per-cell matching is exact and
  free (a substring on already-fetched data — no re-folding, no extra index).
- Keep `_qt.<target>.<modeKey>` in the projection (drop only `…​.ngrams`).

**Fallbacks (always correct, slower):**
- *Multi-field targets:* all the target's fields are marked; the client renders plain
  text on fields that don't actually contain a token.
- *Folded text projected out / not yet indexed:* the server refolds the raw fields.
- *`highlightSpecs` absent:* records carry no sidecar; the client reverts to
  context-driven highlighting (see `HighlightedCell`).
````

---

## Task 8: Demo predicate → highlight specs walker

**Files:** Create `packages/demo/src/shared/predicateToHighlightSpecs.ts`

- [ ] **Step 1: Write the walker**

`packages/demo/src/shared/predicateToHighlightSpecs.ts`:
```ts
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
```

---

## Task 9: Demo `/api/live` passes `highlightSpecs`

**Files:** Modify `packages/demo/src/server/index.ts`

- [ ] **Step 1: Import the walker**

In `packages/demo/src/server/index.ts`, after the line:
```ts
import { predicateToMongo } from '../shared/predicateToMongo'
```
add:
```ts
import { predicateToHighlightSpecs } from '../shared/predicateToHighlightSpecs'
```

- [ ] **Step 2: Replace the `streamLiveSearch` call in `/api/live`**

Replace this block:
```ts
    streamLiveSearch(request, reply, {
      sync, collection: col, config: demoConfig, filter, sort, cap: 500,
      highlight: true,
      // keep the folded verify fields; drop only the bulky ngram arrays
      projection: { '_qt.author.ngrams': 0, '_qt.title.ngrams': 0 },
    })
```
with:
```ts
    streamLiveSearch(request, reply, {
      sync, collection: col, config: demoConfig, filter, sort, cap: 500,
      highlightSpecs: predicateToHighlightSpecs(predicate),
      // keep the folded verify fields; drop only the bulky ngram arrays
      projection: { '_qt.author.ngrams': 0, '_qt.title.ngrams': 0 },
    })
```

---

## Task 10: Verification + commit (final, sequential — after Tasks 1–9 land)

**Files:** none owned; may edit any Task 1–9 file to fix integration errors.

Do not start until Tasks 1–9 are written. (No `@quaesitor-textus/core` changes in this plan, so core need not rebuild; its dist already exports `RecordHighlights`.)

- [ ] **Step 1: Build mongo**

Run: `pnpm --filter @quaesitor-textus/mongo build`
Expected: clean build. `buildTextSearchFilter` clean; `computeHighlights(specs,…)`, `HighlightSpec`, `resolveMode`, `createLiveSearch.highlightSpecs`, adapter `highlightSpecs` all compile; no references to `collectHighlightTags`/`HighlightTag`/`highlight`.

- [ ] **Step 2: Build demo**

Run: `pnpm --filter @quaesitor-textus/demo build`
Expected: clean vite/tsc build (`predicateToHighlightSpecs` + the `/api/live` change compile; `HighlightSpec` imported from the rebuilt mongo).

- [ ] **Step 3: Test mongo**

Run: `pnpm --filter @quaesitor-textus/mongo test`
Expected: all green. New/updated: `resolveMode` (4), `buildTextSearchFilter` (existing + regression), `computeHighlights` (7, spec-based), `createLiveSearch.highlight` (3, spec-based), `adapters/shared.highlight` (1). The deleted `buildTextSearchFilter.highlight.test.ts` is gone. Existing mongo-backed suites (createLiveSearch.test.ts, startSearchSync.test.ts, parity.test.ts) self-skip without mongo on `:27018` and must still pass — `buildTextSearchFilter` now returns a clean filter, so any direct `find` matches as before.

- [ ] **Step 4: Reproduce-the-bug check (optional, if mongo on :27018 with demo seed)**

If the demo DB is reachable, confirm a composed filter now returns matches (was 0):
Run (from `packages/mongo`):
```bash
node --input-type=module -e "import {buildTextSearchFilter} from './dist/index.js'; import {MongoClient} from 'mongodb'; const cfg={namespace:'_qt',ngramSizes:[2,3],targets:{author:{fields:['author'],queryModes:[{caseSensitive:true}]},title:{fields:['title'],queryModes:[{caseSensitive:true}]}}}; const f={\$and:[buildTextSearchFilter('author',['sara'],cfg),{year:{\$gte:-800,\$lte:2024}}]}; const c=await MongoClient.connect('mongodb://localhost:27018/?directConnection=true',{serverSelectionTimeoutMS:2000}).catch(()=>null); if(c){console.log('count:',await c.db('demo').collection('books').countDocuments(f)); await c.close()} else console.log('no mongo')"
```
Expected: `count: 46` (non-zero) — or `no mongo` if unreachable (not a failure).

- [ ] **Step 5: Fix any integration errors**

Likely: a `HighlightSpec` import path mismatch, or `resolveMode` not exported from `modes.ts`. Fix within the Task 1–9 files and re-run Steps 1–3 until green.

- [ ] **Step 6: Commit in plan order**

Commit sequentially, each message ending with `\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`:
- Task 1 → `feat(mongo): resolveMode helper (shared fold-mode resolution)`
- Task 2 → `fix(mongo): buildTextSearchFilter returns a clean filter (drop __qtHighlights)`
- Task 3 → `refactor(mongo): computeHighlights takes HighlightSpec[]`
- Task 4 → `refactor(mongo): createLiveSearch takes highlightSpecs out-of-band`
- Task 5 → `refactor(mongo): adapters forward highlightSpecs`
- Task 6 → `feat(mongo): export HighlightSpec; drop collectHighlightTags/HighlightTag`
- Task 7 → `docs(mongo): document out-of-band highlightSpecs`
- Task 8 → `feat(demo): predicateToHighlightSpecs walker`
- Task 9 → `fix(demo): /api/live passes highlightSpecs; /api/books filter is clean`
Fold any integration fixes into the most relevant commit. Do not push, bump versions, or release.

---

## Self-review

**Spec coverage:**
- `buildTextSearchFilter` clean filter (revert) → Task 2 + regression test.
- `HighlightSpec` type → Task 3; exported → Task 6.
- `computeHighlights(specs, doc, config)` folding via shared `resolveMode` → Tasks 1, 3.
- `highlightSpecs` on createLiveSearch + adapters → Tasks 4, 5.
- Remove `__qtHighlights`/`collectHighlightTags`/`HighlightTag`/`highlight` → Tasks 2, 3, 4, 5, 6.
- Demo: `predicateToHighlightSpecs` + `/api/live`, `predicateToMongo`/`/api/books` untouched → Tasks 8, 9.
- Client unchanged → no task (correct; `HighlightedCell`, sidecar shape untouched).
- README → Task 7.
- Regression (clean filter `find` matches) → Task 2 unit + Task 10 Step 4 integration.

**Placeholder scan:** none — full content in every step.

**Type/string consistency:** `resolveMode(config, target, options)` identical in Tasks 1/2/3; `HighlightSpec` identical in Tasks 3/4/5/8; `computeHighlights(specs, doc, config)` identical in Tasks 3/4; `highlightSpecs` identical in Tasks 4/5/9; sidecar `{ tokens, fields }` unchanged from the prior (merged) work consumed by `HighlightedCell`.

## Release (after Task 10 is green)

New feature (net of this correction) → minor bump. `make publish-minor-version` → v0.5.0. (`/mnt/docker-data` recovered to ~81%; the `npm_config_cache` workaround remains a fallback.)
