# Server-side Highlight Annotation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make highlighting data-driven: the server annotates each emitted record with a `_highlights` sidecar (which fields matched which named search + folded tokens), so the client highlights only flagged cells and typing does zero per-cell work. Reaches all the way into the demo app.

**Architecture:** `buildTextSearchFilter` carries a self-describing `__qtHighlights` tag on each text primitive. `collectHighlightTags` walks the (possibly compound) filter tree, gathers all tags and strips them so mongo never sees them. `createLiveSearch` (opt-in `highlight`) runs the pure `computeHighlights(tags, doc, config)` over each emitted doc, reading the already-stored folded target text (`ns.<target>.<modeKey>`) with a refold fallback. The SSE adapters forward `highlight`/`projection`. The client `HighlightedCell` renders `HighlightedText` only on flagged cells, falling back to context-driven highlighting when no sidecar is present. The demo wires it end-to-end. Spec: `docs/superpowers/specs/2026-06-08-server-side-highlight-annotation-design.md`.

**Tech Stack:** TypeScript, React 18, Vitest, mongodb driver, Fastify, tsup/vite. Packages: `@quaesitor-textus/core`, `@quaesitor-textus/mongo`, `@quaesitor-textus/demo`.

---

## Plan shape (parallel execution)

Parallel-shaped per the project's standing preference (`feedback-parallel-shaped-plans`). Tasks 1–12 are **file-disjoint** and run **concurrently**. **No per-task test runs or commits** — all verification and all commits happen in **Task 13**. The tree may not compile mid-execution; that's expected.

File ownership (no file in two tasks):

| Task | Owns (create/modify) |
|------|----------------------|
| 1 | `packages/core/src/logic/highlightTypes.ts` |
| 2 | `packages/core/src/components/HighlightedCell.tsx`, `packages/core/src/components/HighlightedCell.test.tsx` |
| 3 | `packages/core/src/index.ts` |
| 4 | `packages/mongo/src/computeHighlights.ts`, `packages/mongo/src/computeHighlights.test.ts` |
| 5 | `packages/mongo/src/buildTextSearchFilter.ts`, `packages/mongo/src/buildTextSearchFilter.highlight.test.ts` |
| 6 | `packages/mongo/src/createLiveSearch.ts`, `packages/mongo/src/createLiveSearch.highlight.test.ts` |
| 7 | `packages/mongo/src/index.ts` |
| 8 | `packages/mongo/src/adapters/shared.ts`, `packages/mongo/src/adapters/shared.highlight.test.ts` |
| 9 | `packages/mongo/README.md` |
| 10 | `packages/core/README.md` |
| 11 | `packages/demo/src/server/index.ts` |
| 12 | `packages/demo/src/client/bookColumns.tsx` |
| 13 | `packages/demo/src/client/StreamTab.tsx` |
| 14 | verification only (build + test, then commit; may touch any file to fix integration) |

## Pinned shared contracts

All concurrent tasks MUST conform exactly.

**Core highlight types** (Task 1; exported by Task 3; imported by Tasks 2 and 4):
```ts
export interface FieldHighlight { tokens: string[]; fields: string[] }
export type RecordHighlights = Record<string /* searchName === target */, FieldHighlight>
```

**Query tag** (Task 5 produces; Tasks 4/6 consume; Task 7 exports):
```ts
export interface HighlightTag { target: string; mode: SearchOptions; tokens: string[] /* already folded for mode */ }
// carried on each text primitive under the reserved key `__qtHighlights: HighlightTag[]`
```

**computeHighlights + collectHighlightTags** (Task 4; used by Task 6; exported by Task 7):
```ts
export function computeHighlights(tags: HighlightTag[], doc: Document, config: MongoSearchConfig): RecordHighlights
export function collectHighlightTags(filter: Filter<Document>): { tags: HighlightTag[]; filter: Filter<Document> }
// collectHighlightTags walks the (possibly nested $and/$or) filter, gathering every
// __qtHighlights array and returning a deep-cleaned filter with all of them removed.
```

**Adapter options** (Task 8): `StreamLiveSearchOptions` gains `highlight?: boolean` and `projection?: Document`, forwarded to `createLiveSearch`.

**Sidecar key on emitted records:** `_highlights` (value `RecordHighlights`).
**createLiveSearch new option:** `highlight?: boolean`.
**Namespace default:** `_qt`; `modeKey({})` → `'norm'`; `modeKey({caseSensitive:true})` → `'norm_cs'`.

---

## Task 1: Core highlight types

**Files:** Create `packages/core/src/logic/highlightTypes.ts`

- [ ] **Step 1: Write the types**

```ts
/** One named search's highlight info for a single record. */
export interface FieldHighlight {
  /** The folded tokens that named search looked for. */
  tokens: string[]
  /** This record's fields to highlight for that search. */
  fields: string[]
}

/**
 * Server-attached per-record sidecar: for each named search (keyed by its name,
 * which equals the mongo target), which fields to highlight and with what tokens.
 */
export type RecordHighlights = Record<string, FieldHighlight>
```

---

## Task 2: Core `HighlightedCell` component

**Files:**
- Create `packages/core/src/components/HighlightedCell.tsx`
- Create `packages/core/src/components/HighlightedCell.test.tsx`

- [ ] **Step 1: Write the component**

`packages/core/src/components/HighlightedCell.tsx`:
```tsx
import React from 'react'
import type { RecordHighlights } from '../logic/highlightTypes'
import type { SearchOptions } from '../logic/types'
import { HighlightedText } from './HighlightedText'

interface HighlightedCellProps {
  /** The record, optionally carrying a server-attached `_highlights` sidecar. */
  record: { _highlights?: RecordHighlights } & Record<string, unknown>
  /** The field of `record` this cell renders. */
  field: string
  /** The named search whose highlights apply to this cell. */
  searchName: string
  /** Optional explicit text; defaults to String(record[field] ?? ''). */
  value?: string
  options?: SearchOptions
  markStyle?: React.CSSProperties
}

/**
 * Renders one table cell. When the record carries a server `_highlights` sidecar,
 * highlighting is data-driven: a cell is highlighted only when its field is flagged
 * for `searchName`, using the tokens from the sidecar (no live-token subscription).
 * When there is no sidecar, it falls back to the original context-driven highlighting.
 */
export function HighlightedCell({
  record,
  field,
  searchName,
  value,
  options,
  markStyle,
}: HighlightedCellProps): React.ReactNode {
  const text = value ?? String(record[field] ?? '')

  // Fallback (no server annotation): context-driven highlighting, original behavior.
  if (record._highlights === undefined) {
    return (
      <HighlightedText
        text={text}
        searchNames={searchName}
        options={options}
        markStyle={markStyle}
      />
    )
  }

  const h = record._highlights[searchName]
  if (h && h.fields.includes(field)) {
    return (
      <HighlightedText text={text} patterns={h.tokens} options={options} markStyle={markStyle} />
    )
  }
  return <>{text}</>
}
```

- [ ] **Step 2: Write the test**

`packages/core/src/components/HighlightedCell.test.tsx`:
```tsx
import React from 'react'
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { HighlightedCell } from './HighlightedCell'
import { WithSearch } from '../context/WithSearch'

describe('HighlightedCell', () => {
  it('highlights a flagged field using the sidecar tokens (data-driven)', () => {
    const record = { title: 'War and Peace', _highlights: { title: { tokens: ['war'], fields: ['title'] } } }
    const { container } = render(<HighlightedCell record={record} field="title" searchName="title" />)
    expect(container.querySelector('mark')?.textContent).toBe('War')
  })

  it('renders plain text for a field not flagged in the sidecar', () => {
    const record = { author: 'Tolstoy', _highlights: { title: { tokens: ['war'], fields: ['title'] } } }
    const { container } = render(<HighlightedCell record={record} field="author" searchName="title" />)
    expect(container.querySelector('mark')).toBeNull()
    expect(container.textContent).toBe('Tolstoy')
  })

  it('renders plain text when the searchName has no sidecar entry', () => {
    const record = { title: 'War', _highlights: {} }
    const { container } = render(<HighlightedCell record={record} field="title" searchName="title" />)
    expect(container.querySelector('mark')).toBeNull()
    expect(container.textContent).toBe('War')
  })

  it('falls back to context-driven highlighting when the record has no _highlights', () => {
    const record = { title: 'War and Peace' }
    const { container } = render(
      <WithSearch name="title" query="war" onSetQuery={() => {}}>
        <HighlightedCell record={record} field="title" searchName="title" />
      </WithSearch>
    )
    expect(container.querySelector('mark')?.textContent).toBe('War')
  })
})
```

---

## Task 3: Export from the core package index

**Files:** Modify `packages/core/src/index.ts`

- [ ] **Step 1: Add exports**

After the existing line:
```ts
export { HighlightedTrimmedText } from './components/HighlightedTrimmedText'
```
add:
```ts
export { HighlightedCell } from './components/HighlightedCell'
export type { RecordHighlights, FieldHighlight } from './logic/highlightTypes'
```

---

## Task 4: Mongo `computeHighlights` + `collectHighlightTags`

**Files:**
- Create `packages/mongo/src/computeHighlights.ts`
- Create `packages/mongo/src/computeHighlights.test.ts`

- [ ] **Step 1: Write the module**

`packages/mongo/src/computeHighlights.ts`:
```ts
import { normalizeText, buildCorpus } from '@quaesitor-textus/core'
import type { RecordHighlights, SearchOptions } from '@quaesitor-textus/core'
import type { Document, Filter } from 'mongodb'
import type { MongoSearchConfig } from './config'
import { DEFAULT_NAMESPACE } from './config'
import { modeKey } from './modes'

export interface HighlightTag {
  target: string
  mode: SearchOptions
  /** Tokens already folded for `mode`. */
  tokens: string[]
}

/**
 * Walk a (possibly compound) filter, gathering every `__qtHighlights` tag array and
 * returning a deep-cleaned copy with all of them removed. Callers compose filters by
 * nesting them inside `$and`/`$or`, so the tags can sit at any depth; this collects
 * them all and produces a filter mongo can run (the reserved key never reaches mongo).
 */
export function collectHighlightTags(
  filter: Filter<Document>,
): { tags: HighlightTag[]; filter: Filter<Document> } {
  const tags: HighlightTag[] = []
  const walk = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(walk)
    if (node && typeof node === 'object') {
      const out: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
        if (k === '__qtHighlights') {
          if (Array.isArray(v)) tags.push(...(v as HighlightTag[]))
          continue // strip
        }
        out[k] = walk(v)
      }
      return out
    }
    return node
  }
  const cleaned = walk(filter) as Filter<Document>
  return { tags, filter: cleaned }
}

/**
 * Build the per-record `_highlights` sidecar from the query's highlight tags.
 * For each tag, test the (folded) tokens against the record's already-stored folded
 * target text `ns.<target>.<modeKey>`; if that field was projected out, refold the
 * target's corpus from the raw fields. A hit marks all the target's fields (exact for
 * single-field targets; a safe superset for multi-field targets, where the client
 * no-ops on fields that do not actually contain a token).
 */
export function computeHighlights(
  tags: HighlightTag[],
  doc: Document,
  config: MongoSearchConfig,
): RecordHighlights {
  const ns = config.namespace ?? DEFAULT_NAMESPACE
  const result: RecordHighlights = {}
  for (const tag of tags) {
    const target = config.targets[tag.target]
    if (!target) continue
    const stored = (doc?.[ns] as Record<string, Record<string, unknown>> | undefined)
      ?.[tag.target]?.[modeKey(tag.mode)]
    const folded = typeof stored === 'string'
      ? stored
      : normalizeText(buildCorpus(doc, target.fields), tag.mode)
    if (tag.tokens.some(t => folded.includes(t))) {
      result[tag.target] = { tokens: tag.tokens, fields: target.fields }
    }
  }
  return result
}
```

- [ ] **Step 2: Write the test**

`packages/mongo/src/computeHighlights.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { computeHighlights, collectHighlightTags } from './computeHighlights'
import type { HighlightTag } from './computeHighlights'
import type { MongoSearchConfig } from './config'

const config: MongoSearchConfig = {
  targets: {
    author: { fields: ['author'] },
    title: { fields: ['title'] },
    meta: { fields: ['author', 'title'] },
  },
}
const tag = (target: string, tokens: string[]): HighlightTag => ({ target, mode: {}, tokens })

describe('computeHighlights', () => {
  it('flags a single-field target whose stored folded text contains the token', () => {
    const doc = { author: 'Tolstoy', _qt: { author: { norm: 'tolstoy' } } }
    expect(computeHighlights([tag('author', ['tolst'])], doc, config)).toEqual({
      author: { tokens: ['tolst'], fields: ['author'] },
    })
  })

  it('omits a target whose token is absent', () => {
    const doc = { author: 'Tolstoy', _qt: { author: { norm: 'tolstoy' } } }
    expect(computeHighlights([tag('author', ['dostoy'])], doc, config)).toEqual({})
  })

  it('marks all fields of a multi-field target (fallback) when the corpus matches', () => {
    const doc = { author: 'Tolstoy', title: 'War', _qt: { meta: { norm: 'tolstoy war' } } }
    expect(computeHighlights([tag('meta', ['war'])], doc, config)).toEqual({
      meta: { tokens: ['war'], fields: ['author', 'title'] },
    })
  })

  it('refolds from raw fields when the stored folded text is absent (fallback)', () => {
    const doc = { title: 'Weiß' } // no _qt projected; ß→ss folding must still match
    expect(computeHighlights([tag('title', ['weiss'])], doc, config)).toEqual({
      title: { tokens: ['weiss'], fields: ['title'] },
    })
  })

  it('builds entries for multiple tags (AND / compound query)', () => {
    const doc = { author: 'Tolstoy', title: 'War', _qt: { author: { norm: 'tolstoy' }, title: { norm: 'war' } } }
    expect(computeHighlights([tag('author', ['tolst']), tag('title', ['war'])], doc, config)).toEqual({
      author: { tokens: ['tolst'], fields: ['author'] },
      title: { tokens: ['war'], fields: ['title'] },
    })
  })

  it('ignores tags for unknown targets', () => {
    const doc = { author: 'Tolstoy', _qt: { author: { norm: 'tolstoy' } } }
    expect(computeHighlights([tag('nope', ['x'])], doc, config)).toEqual({})
  })
})

describe('collectHighlightTags', () => {
  it('collects a top-level tag and strips it from the filter', () => {
    const filter: any = { $and: [{ '_qt.author.ngrams': { $all: ['to'] } }], __qtHighlights: [tag('author', ['tolst'])] }
    const { tags, filter: cleaned } = collectHighlightTags(filter)
    expect(tags).toEqual([tag('author', ['tolst'])])
    expect((cleaned as any).__qtHighlights).toBeUndefined()
    expect((cleaned as any).$and).toBeDefined()
  })

  it('collects tags nested inside $and / $or and strips them all', () => {
    const leaf = (t: string, tok: string): any => ({ $and: [{ x: 1 }], __qtHighlights: [tag(t, [tok])] })
    const filter: any = { $or: [leaf('author', 'tolst'), { $and: [leaf('title', 'war')] }] }
    const { tags, filter: cleaned } = collectHighlightTags(filter)
    expect(tags).toEqual([tag('author', ['tolst']), tag('title', ['war'])])
    expect(JSON.stringify(cleaned)).not.toContain('__qtHighlights')
  })

  it('returns no tags for a filter without any', () => {
    const { tags } = collectHighlightTags({ year: { $gte: 1900 } } as any)
    expect(tags).toEqual([])
  })
})
```

---

## Task 5: `buildTextSearchFilter` emits the highlight tag

**Files:**
- Modify `packages/mongo/src/buildTextSearchFilter.ts`
- Create `packages/mongo/src/buildTextSearchFilter.highlight.test.ts`

- [ ] **Step 1: Add the tag to the returned filter**

In `packages/mongo/src/buildTextSearchFilter.ts`, the function currently ends:
```ts
  return { $and: [{ [ngramField]: { $all: ngramTerms } }, ...verifyConditions] } as Filter<Document>
}
```
Replace that `return` with:
```ts
  // Self-describing highlight tag: target + mode + folded tokens, carried on the
  // filter object under a reserved key. collectHighlightTags reads and strips it
  // (at any nesting depth) before the query reaches mongo.
  const tokens = patterns.map(p => normalizeText(p, mode))
  return {
    $and: [{ [ngramField]: { $all: ngramTerms } }, ...verifyConditions],
    __qtHighlights: [{ target, mode, tokens }],
  } as unknown as Filter<Document>
}
```
(The empty-patterns early `return {}` at the top stays unchanged — no tag when there is nothing to highlight.)

- [ ] **Step 2: Write the test**

`packages/mongo/src/buildTextSearchFilter.highlight.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { buildTextSearchFilter } from './buildTextSearchFilter'
import type { MongoSearchConfig } from './config'

const config: MongoSearchConfig = {
  targets: { author: { fields: ['author'], queryModes: [{ caseSensitive: true }] } },
}

describe('buildTextSearchFilter __qtHighlights tag', () => {
  it('attaches a tag with target, mode and folded tokens', () => {
    const f = buildTextSearchFilter('author', ['Café'], config) as any
    expect(f.__qtHighlights).toEqual([{ target: 'author', mode: {}, tokens: ['cafe'] }])
  })

  it('folds tokens with the selected mode', () => {
    const f = buildTextSearchFilter('author', ['Café'], config, { caseSensitive: true }) as any
    expect(f.__qtHighlights).toEqual([
      { target: 'author', mode: { caseSensitive: true }, tokens: ['Cafe'] },
    ])
  })

  it('leaves the $and conditions intact alongside the tag', () => {
    const f = buildTextSearchFilter('author', ['café'], config) as any
    expect(f.$and[0]['_qt.author.ngrams'].$all).toContain('ca')
    expect(f.$and[1]['_qt.author.norm'].$regex).toBe('cafe')
  })

  it('attaches no tag for empty patterns', () => {
    const f = buildTextSearchFilter('author', [], config) as any
    expect(f.__qtHighlights).toBeUndefined()
  })
})
```

---

## Task 6: `createLiveSearch` collects/strips tags and annotates docs

**Files:**
- Modify `packages/mongo/src/createLiveSearch.ts`
- Create `packages/mongo/src/createLiveSearch.highlight.test.ts`

- [ ] **Step 1: Add the `highlight` option, collect+strip the tags, annotate emitted docs**

In `packages/mongo/src/createLiveSearch.ts`:

(a) Add an import at the top (after the existing imports):
```ts
import { computeHighlights, collectHighlightTags } from './computeHighlights'
```

(b) Add `highlight` to `CreateLiveSearchOptions` (alongside the other optional fields, before `sendEvent`):
```ts
  /**
   * When true, each emitted document is annotated with a `_highlights` sidecar
   * (computed from the filter's `__qtHighlights` tags and the stored folded target
   * text). The tags are always collected and stripped from the filter before
   * querying mongo, regardless of this flag.
   */
  highlight?: boolean
```

(c) Replace the destructuring line:
```ts
  const { sync, collection, config: _config, filter, sort, cap = 500, coalesceMs, projection, sendEvent } = opts
```
with:
```ts
  const { sync, collection, config, filter, sort, cap = 500, coalesceMs, projection, sendEvent, highlight } = opts

  // Tags may sit at any depth (callers nest filters under $and/$or). Collect them
  // and run mongo against the cleaned filter so the reserved key never reaches it.
  const { tags: collectedTags, filter: queryFilter } = collectHighlightTags(filter)
  const tags = highlight ? collectedTags : []
  const annotate = (doc: Document): Document =>
    tags.length > 0 ? { ...doc, _highlights: computeHighlights(tags, doc, config) } : doc
```

(d) Use `queryFilter` (not `filter`) and annotate emitted docs. Change the snapshot query:
```ts
  const cursor = collection.find(filter, findOpts)
```
to:
```ts
  const cursor = collection.find(queryFilter, findOpts)
```
Change the snapshot emit block — replace these three lines:
```ts
    for (const it of items) seen.add(idOf(it))
    count = items.length
    sendEvent({ type: 'snapshot', items })
```
with:
```ts
    const annotated = items.map(annotate)
    for (const it of items) seen.add(idOf(it))
    count = items.length
    sendEvent({ type: 'snapshot', items: annotated })
```
Change the per-match lookup filter:
```ts
    void collection.findOne({ $and: [{ _id: e.id as any }, filter] }, findOpts)
```
to:
```ts
    void collection.findOne({ $and: [{ _id: e.id as any }, queryFilter] }, findOpts)
```
And annotate the matched doc — change `emitMatch(doc)` to:
```ts
        emitMatch(annotate(doc))
```

(`config` is now used, so the earlier `_config` rename is removed.)

- [ ] **Step 2: Write the test (self-contained stubs, no mongo)**

`packages/mongo/src/createLiveSearch.highlight.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { createLiveSearch } from './createLiveSearch'
import type { LiveEvent } from './createLiveSearch'
import { buildTextSearchFilter } from './buildTextSearchFilter'
import type { MongoSearchConfig } from './config'

const config: MongoSearchConfig = { targets: { title: { fields: ['title'] } } }

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
  it('annotates snapshot items and strips __qtHighlights from the mongo query', async () => {
    const col = stubCollection([{ _id: '1', title: 'War and Peace', _qt: { title: { norm: 'war and peace' } } }])
    const filter: any = buildTextSearchFilter('title', ['war'], config)
    expect(filter.__qtHighlights).toBeDefined() // produced by Task 5

    const events: LiveEvent[] = []
    createLiveSearch({ sync: stubSync, collection: col, config, filter, highlight: true, sendEvent: e => events.push(e) })
    await new Promise(r => setTimeout(r, 10))

    const snap = events.find(e => e.type === 'snapshot') as any
    expect(snap.items[0]._highlights).toEqual({ title: { tokens: ['war'], fields: ['title'] } })
    expect(col.calls[0].__qtHighlights).toBeUndefined() // mongo never sees the tag
    expect(col.calls[0].$and).toBeDefined()
  })

  it('collects tags nested in a compound filter (AND) and annotates', async () => {
    const col = stubCollection([{ _id: '1', title: 'War', author: 'Tolstoy', _qt: { title: { norm: 'war' }, author: { norm: 'tolstoy' } } }])
    const cfg: MongoSearchConfig = { targets: { title: { fields: ['title'] }, author: { fields: ['author'] } } }
    const filter: any = { $and: [
      buildTextSearchFilter('title', ['war'], cfg),
      buildTextSearchFilter('author', ['tolst'], cfg),
    ] }
    const events: LiveEvent[] = []
    createLiveSearch({ sync: stubSync, collection: col, config: cfg, filter, highlight: true, sendEvent: e => events.push(e) })
    await new Promise(r => setTimeout(r, 10))
    const snap = events.find(e => e.type === 'snapshot') as any
    expect(snap.items[0]._highlights).toEqual({
      title: { tokens: ['war'], fields: ['title'] },
      author: { tokens: ['tolst'], fields: ['author'] },
    })
    expect(JSON.stringify(col.calls[0])).not.toContain('__qtHighlights') // stripped at depth
  })

  it('does not annotate when highlight is disabled, but still strips the tag', async () => {
    const col = stubCollection([{ _id: '1', title: 'War', _qt: { title: { norm: 'war' } } }])
    const filter: any = buildTextSearchFilter('title', ['war'], config)
    const events: LiveEvent[] = []
    createLiveSearch({ sync: stubSync, collection: col, config, filter, sendEvent: e => events.push(e) })
    await new Promise(r => setTimeout(r, 10))
    const snap = events.find(e => e.type === 'snapshot') as any
    expect(snap.items[0]._highlights).toBeUndefined()
    expect(col.calls[0].__qtHighlights).toBeUndefined()
  })
})
```

---

## Task 7: Export from the mongo package index

**Files:** Modify `packages/mongo/src/index.ts`

- [ ] **Step 1: Add exports**

After the existing line:
```ts
export { createLiveSearch } from './createLiveSearch'
```
add:
```ts
export { computeHighlights, collectHighlightTags } from './computeHighlights'
export type { HighlightTag } from './computeHighlights'
```

---

## Task 8: Adapters forward `highlight` / `projection`

**Files:**
- Modify `packages/mongo/src/adapters/shared.ts`
- Create `packages/mongo/src/adapters/shared.highlight.test.ts`

- [ ] **Step 1: Add options and forward them**

In `packages/mongo/src/adapters/shared.ts`:

(a) Add a `Document` import — change the first import line:
```ts
import type { Collection, Document, Filter } from 'mongodb'
```
(it already imports `Collection, Document, Filter` — verify `Document` is present; if not, add it).

(b) Add two fields to `StreamLiveSearchOptions` (after `cap?: number`):
```ts
  /** Forwarded to createLiveSearch: annotate emitted records with `_highlights`. */
  highlight?: boolean
  /** Forwarded to createLiveSearch: mongo projection for snapshot + match lookups. */
  projection?: Document
```

(c) In `runLiveSearch`, forward them in the `createLiveSearch({ ... })` call (add to the option object, e.g. after `cap: opts.cap,`):
```ts
    highlight: opts.highlight,
    projection: opts.projection,
```

- [ ] **Step 2: Write the test (stubs, no mongo)**

`packages/mongo/src/adapters/shared.highlight.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { runLiveSearch } from './shared'
import { buildTextSearchFilter } from '../buildTextSearchFilter'
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
  it('forwards highlight so emitted records carry _highlights in the SSE stream', async () => {
    const col = stubCollection([{ _id: '1', title: 'War', _qt: { title: { norm: 'war' } } }])
    const chunks: string[] = []
    const { stop } = runLiveSearch(
      { sync: stubSync, collection: col, config, filter: buildTextSearchFilter('title', ['war'], config), highlight: true },
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

## Task 9: Mongo README — document the performant pattern

**Files:** Modify (or create) `packages/mongo/README.md`

- [ ] **Step 1: Append a Highlighting section**

If `packages/mongo/README.md` exists, append the section below to the end. If it does not exist, create it with a top `# @quaesitor-textus/mongo` heading followed by this section.

````markdown
## Highlighting (server-side annotation)

To keep typing fast on large result tables, highlight info is computed on the server
and shipped with each record, instead of every cell re-highlighting on each keystroke.

Enable it on the live search (works through the SSE adapters too — `streamLiveSearch`,
`streamToNodeResponse`):

```ts
createLiveSearch({
  sync, collection, config,
  filter: buildTextSearchFilter('title', patterns, config), // carries the highlight tag
  highlight: true,
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

The highlight tag (`__qtHighlights`) rides on the filter object — at any nesting depth
for compound `$and`/`$or` queries — and is collected and stripped before the query
reaches mongo.

**Best-performance pattern:**
- Use **single-field targets** (one target per searchable field). Then the stored
  folded text `_qt.<target>.<mode>` *is* that field, so per-cell matching is exact and
  free (a substring on already-fetched data — no re-folding, no extra index).
- Keep `_qt.<target>.<modeKey>` in the projection (drop only `…​.ngrams`).

**Fallbacks (always correct, slower):**
- *Multi-field targets:* all the target's fields are marked; the client renders plain
  text on fields that don't actually contain a token.
- *Folded text projected out / not yet indexed:* the server refolds the raw fields.
- *`highlight` disabled or tag absent:* records carry no sidecar; the client reverts to
  context-driven highlighting (see `HighlightedCell`).
````

---

## Task 10: Core README — document the client cell pattern

**Files:** Modify (or create) `packages/core/README.md`

- [ ] **Step 1: Append a section**

If `packages/core/README.md` exists, append the section below. If it does not exist, create it with a top `# @quaesitor-textus/core` heading followed by this section.

````markdown
## Data-driven highlighting with `HighlightedCell`

Wrapping every table cell in `HighlightedText` wired to the live search tokens makes
each keystroke re-highlight every cell — a CPU spike on large tables. `HighlightedCell`
makes highlighting **data-driven**: when a record carries a server `_highlights`
sidecar (see `@quaesitor-textus/mongo`'s `highlight` option), only the flagged cells
highlight, using the tokens carried in the data — so typing does no per-cell work.

```tsx
<HighlightedCell record={row} field="title" searchName="title" />
```

- If `row._highlights` is present, the cell highlights only when its `field` is flagged
  for `searchName`, using `row._highlights[searchName].tokens`.
- If `row._highlights` is absent, it falls back to the original context-driven
  highlighting (`HighlightedText` wired to the named search), so consumers that haven't
  adopted server annotation still get correct (if slower) highlights.

The sidecar shape is exported as `RecordHighlights` / `FieldHighlight`.
````

---

## Task 11: Demo server enables highlight annotation

**Files:** Modify `packages/demo/src/server/index.ts`

- [ ] **Step 1: Pass `highlight` + projection on the live endpoint**

In the `/api/live` handler, the final call is currently:
```ts
    streamLiveSearch(request, reply, { sync, collection: col, config: demoConfig, filter, sort, cap: 500 })
```
Replace it with:
```ts
    streamLiveSearch(request, reply, {
      sync, collection: col, config: demoConfig, filter, sort, cap: 500,
      highlight: true,
      // keep the folded verify fields; drop only the bulky ngram arrays
      projection: { '_qt.author.ngrams': 0, '_qt.title.ngrams': 0 },
    })
```

---

## Task 12: Demo columns use `HighlightedCell`

**Files:** Modify `packages/demo/src/client/bookColumns.tsx`

- [ ] **Step 1: Switch to record-driven highlighting**

Replace the entire contents of `packages/demo/src/client/bookColumns.tsx` with:
```tsx
import React from 'react'
import type { TableColumnsType } from 'antd'
import { HighlightedCell } from '@quaesitor-textus/core'
import type { Book } from '../shared/generator'

// Shared antd Table columns for both the query and streaming tabs.
// Streaming records carry a server `_highlights` sidecar (data-driven highlighting);
// the paged query records do not, so HighlightedCell falls back to context-driven
// highlighting there — both are correct.
export const bookColumns: TableColumnsType<Book> = [
  {
    title: 'Author',
    dataIndex: 'author',
    render: (_a: string, record: Book) => (
      <HighlightedCell record={record} field="author" searchName="author" />
    ),
  },
  {
    title: 'Title',
    dataIndex: 'title',
    render: (_t: string, record: Book) => (
      <HighlightedCell record={record} field="title" searchName="title" />
    ),
  },
  { title: 'Year', dataIndex: 'year', width: 90 },
]
```

---

## Task 13: Demo StreamTab handles coalesced `matches` events

**Files:** Modify `packages/demo/src/client/StreamTab.tsx`

Pre-existing latent gap: the SSE handler branches on `snapshot`/`match`/`capped` but not `matches` (the coalesced batch event). Today it's inert (the demo never enables coalescing), but a `matches` event would be silently dropped. Add the missing branch for robustness.

- [ ] **Step 1: Add the `matches` branch**

In `packages/demo/src/client/StreamTab.tsx`, the `es.onmessage` handler currently reads:
```ts
    es.onmessage = (ev) => {
      const e = JSON.parse(ev.data)
      if (e.type === 'snapshot') e.items.forEach(add)
      else if (e.type === 'match') add(e.item)
      else if (e.type === 'capped') setCapped(true)
    }
```
Replace it with (add the `matches` branch):
```ts
    es.onmessage = (ev) => {
      const e = JSON.parse(ev.data)
      if (e.type === 'snapshot') e.items.forEach(add)
      else if (e.type === 'match') add(e.item)
      else if (e.type === 'matches') e.items.forEach(add)
      else if (e.type === 'capped') setCapped(true)
    }
```
Leave the rest of the file unchanged.

---

## Task 14: Verification + commit (final, sequential — after Tasks 1–13 land)

**Files:** none owned; may edit any Task 1–13 file to fix integration errors.

Do not start until Tasks 1–13 are written.

- [ ] **Step 1: Build core first (mongo + demo import new core exports)**

Run: `pnpm --filter @quaesitor-textus/core build`
Expected: clean tsup/DTS build (exports `HighlightedCell`, `RecordHighlights`, `FieldHighlight`).

- [ ] **Step 2: Build mongo**

Run: `pnpm --filter @quaesitor-textus/mongo build`
Expected: clean build (`computeHighlights`, `collectHighlightTags`, `HighlightTag`, `createLiveSearch.highlight`, adapter `highlight`/`projection`, tagged `buildTextSearchFilter`).

- [ ] **Step 3: Build demo**

Run: `pnpm --filter @quaesitor-textus/demo build`
Expected: clean vite/tsc build (server `highlight`/`projection` options accepted; `bookColumns` uses `HighlightedCell`).

- [ ] **Step 4: Test core**

Run: `pnpm --filter @quaesitor-textus/core test`
Expected: all green, including the 4 new `HighlightedCell` tests.

- [ ] **Step 5: Test mongo**

Run: `pnpm --filter @quaesitor-textus/mongo test`
Expected: all green. New pure tests: `computeHighlights` (6) + `collectHighlightTags` (3), `buildTextSearchFilter.highlight` (4), `createLiveSearch.highlight` (3, stub-based), `adapters/shared.highlight` (1). Existing `createLiveSearch.test.ts` mongo-backed tests self-skip without mongo on `:27018`; they must still pass (filters now carry `__qtHighlights`, which `collectHighlightTags` strips — behavior unchanged).

- [ ] **Step 6: Fix any integration errors**

Most likely: core not built before mongo/demo (re-run Steps 1→2→3); a `RecordHighlights`/`HighlightTag` shape vs test mismatch; or `Document` not imported in `shared.ts`. Fix within the Task 1–12 files and re-run Steps 1–5 until green.

- [ ] **Step 7: Commit in plan order**

Commit sequentially (one git process at a time), each message ending with `\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`:
- Task 1 → `feat(core): RecordHighlights/FieldHighlight types`
- Task 2 → `feat(core): HighlightedCell — data-driven cell highlighting with fallback`
- Task 3 → `feat(core): export HighlightedCell and highlight types`
- Task 4 → `feat(mongo): computeHighlights + collectHighlightTags (highlight sidecar)`
- Task 5 → `feat(mongo): buildTextSearchFilter emits __qtHighlights tag`
- Task 6 → `feat(mongo): createLiveSearch highlight annotation + tag collection`
- Task 7 → `feat(mongo): export computeHighlights/collectHighlightTags/HighlightTag`
- Task 8 → `feat(mongo): SSE adapters forward highlight/projection`
- Task 9 → `docs(mongo): document server-side highlight annotation`
- Task 10 → `docs(core): document HighlightedCell data-driven highlighting`
- Task 11 → `feat(demo): enable server highlight annotation on the live stream`
- Task 12 → `feat(demo): book columns use HighlightedCell`
- Task 13 → `fix(demo): handle coalesced matches events in StreamTab`
Fold any integration fixes into the most relevant commit above. Do not push, bump versions, or release.

---

## Self-review

**Spec coverage:**
- Self-describing tag (`__qtHighlights`) on text primitives → Task 5; collected+stripped at any depth → Task 4 (`collectHighlightTags`) + Task 6; consumed → Task 4 (`computeHighlights`).
- `_highlights` sidecar shape (keyed by target=searchName, `{tokens,fields}`) → Tasks 1, 4.
- Server computation reading stored folded text + refold fallback → Task 4.
- Multi-field target fallback (mark all fields) → Task 4 + asserted.
- Opt-in `highlight`, projection retains folded fields → Tasks 6, 8 + README.
- Adapter reachability (everyone streams via adapters) → Task 8.
- Compound-query tag nesting (predicateToMongo wraps leaves) → Task 4 `collectHighlightTags` + Task 6 test.
- Client data-driven cell + context fallback (fallback 3) → Task 2.
- Docs deliverable (2b) → Tasks 9, 10.
- Demo end-to-end (the exact scenario) → Tasks 11, 12.
- Backward compat (existing tests unaffected; field-access not equality; tag stripped) → verified Task 13.
- Release v0.5.0 → handled separately after merge.

**Placeholder scan:** none — all steps carry full content; the only "create or append" branch (READMEs) gives the exact markdown either way.

**Type/string consistency:** `RecordHighlights`/`FieldHighlight` identical in Tasks 1/2/4; `HighlightTag` identical in Tasks 4/5/6/8; `__qtHighlights`/`_highlights` keys identical across producer/collector/consumer/client; `computeHighlights(tags,doc,config)` and `collectHighlightTags(filter)` signatures identical in Tasks 4 and 6; `StreamLiveSearchOptions.highlight/projection` identical in Tasks 8 and 11.

## Release (after Task 13 is green)

New feature → minor bump. `make publish-minor-version` → v0.5.0. (The `/mnt/docker-data` disk has recovered to ~81%; the `npm_config_cache` workaround from `project_shared_docker_disk_near_full` is likely unnecessary now but remains the fallback if npm ENOSPC recurs.)
