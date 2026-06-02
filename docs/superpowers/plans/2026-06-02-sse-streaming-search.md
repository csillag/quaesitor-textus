# SSE Streaming Live Search — Implementation Plan

> **For agentic workers:** This plan is **parallel-shaped** for swarm execution. Every file is owned by exactly one task; tasks are file-disjoint and run **concurrently in one wave**. Dependency barriers are deliberately broken — a task may write code importing symbols another task writes in the same wave. **Do NOT run tests, typecheck, lint, or git inside tasks.** All verification + commits happen in the **Final Phase** from the orchestrator. Interim breakage is expected. Steps use checkbox (`- [ ]`).

**Goal:** Add a live, push-based streaming search to the demo as a second example, backed by a reusable transport-agnostic live-search engine + Fastify SSE adapter in `@quaesitor-textus/mongo`, and add sorting (year/author/title) to both examples.

**Architecture:** Four library layers mirroring `optio-api`: (0) `startSearchSync` becomes a multi-listener emitter that also fires a per-doc `indexed` event after the derive write; (1) `createLiveSearch` (transport-agnostic engine: initial snapshot + per-`indexed` match-test via `findOne`); (2) `sse.ts` (framework-agnostic SSE formatting + heartbeat); (3) `adapters/fastify.ts` (subpath export, optional peer dep). The demo lifts search/sort into a common section and shows two tabs (Query / Streaming); active-tab gating is achieved via `destroyInactiveTabPane` (inactive tab unmounts → its fetch/EventSource tears down).

**Tech Stack:** TypeScript, MongoDB change streams, Fastify, SSE/EventSource, Vite/React/antd.

**Spec:** `docs/superpowers/specs/2026-06-02-sse-streaming-search-design.md`

---

## File Structure & Ownership

| File | Task |
|---|---|
| `packages/mongo/src/startSearchSync.ts` (modify) | L1 |
| `packages/mongo/src/createLiveSearch.ts` + `.test.ts` | L2 |
| `packages/mongo/src/sse.ts` + `.test.ts` | L3 |
| `packages/mongo/src/adapters/fastify.ts` | L4 |
| `packages/mongo/src/index.ts` (modify) | L5 |
| `packages/mongo/package.json` (modify) | L6 |
| `packages/mongo/tsup.config.ts` (modify) | L7 |
| `packages/mongo/README.md` (modify) | L8 |
| `packages/demo/src/shared/generator.ts` (modify) | D1 |
| `packages/demo/src/shared/predicate.ts` (modify) | D2 |
| `packages/demo/src/server/index.ts` (modify) | D3 |
| `packages/demo/src/client/api.ts` (modify) | D4 |
| `packages/demo/src/client/App.tsx` (modify) | D5 |
| `packages/demo/src/client/QueryTab.tsx` (create) | D6 |
| `packages/demo/src/client/StreamTab.tsx` (create) | D7 |
| `packages/demo/README.md` (modify) | D8 |

---

## SHARED CONTRACTS (pinned — match exactly across tasks)

### Watcher emitter (`startSearchSync.ts`)
```ts
export type SearchSyncEvent =
  | { type: 'indexing-started' }
  | { type: 'indexing-finished'; count: number; durationMs: number }
  | { type: 'indexed'; id: unknown }
export type SearchSyncListener = (event: SearchSyncEvent) => void
export interface SearchSync {
  on(listener: SearchSyncListener): void
  off(listener: SearchSyncListener): void
  stop(): Promise<void>
}
export interface StartSearchSyncOptions { idleMs?: number; backfill?: boolean }
export function startSearchSync(collection: Collection, config: MongoSearchConfig, options?: StartSearchSyncOptions): SearchSync
```
A single listener receives ALL event types (consumers switch on `type`). `indexed` fires after the derive `updateOne` resolves. With `backfill: true`, on start the stream is opened first, then docs missing the namespace (`{ [ns]: { $exists: false } }`) are swept and derived (emitting one `indexing-started`/`indexing-finished` pair, no per-doc `indexed`).

### Live engine (`createLiveSearch.ts`)
```ts
export type LiveEvent =
  | { type: 'snapshot'; items: Document[] }
  | { type: 'match'; item: Document }
  | { type: 'capped' }
export interface CreateLiveSearchOptions {
  sync: SearchSync
  collection: Collection
  config: MongoSearchConfig
  filter: Filter<Document>
  sort?: { field: string; dir: 1 | -1 }
  cap?: number                       // default 500
  sendEvent: (event: LiveEvent) => void
}
export function createLiveSearch(opts: CreateLiveSearchOptions): { stop: () => void }
```

### SSE (`sse.ts`)
```ts
export function formatSse(event: unknown): string   // `data: ${JSON.stringify(event)}\n\n`
export function sseComment(text?: string): string   // `: ${text ?? 'ping'}\n\n`
```

### Fastify adapter (`adapters/fastify.ts`, subpath `@quaesitor-textus/mongo/fastify`)
```ts
import type { FastifyReply, FastifyRequest } from 'fastify'
export interface StreamLiveSearchOptions {
  sync: SearchSync; collection: Collection; config: MongoSearchConfig
  filter: Filter<Document>; sort?: { field: string; dir: 1 | -1 }
  cap?: number; heartbeatMs?: number     // default 25000
}
export function streamLiveSearch(request: FastifyRequest, reply: FastifyReply, opts: StreamLiveSearchOptions): void
```

### Demo predicate helper (`predicate.ts`)
```ts
export function hasTextPattern(p: DemoPredicate): boolean   // true if any TEXT leaf has patterns.length > 0
```

### Demo generator (`generator.ts`)
```ts
export const SENTINELS: string[]                  // >=9 distinct diacritic authors; SENTINELS[0] = 'Miguel Ángel Asturias'
export function batchSentinel(batch: number): string       // batch k>=1 -> SENTINELS[k-1] (clamped)
export function batchCommonAuthor(batch: number): string   // a fixed pool author, ~67/batch
// sentinel for batch k is injected at index 1000*k + 500
```

### Demo HTTP
- `GET /api/books?filter&page&pageSize&sort&dir` → `{ items, total, page, pageSize }` (sort = `year|author|title`, dir = `asc|desc`).
- `GET /api/live?filter&sort&dir` → SSE: `idle` if no text pattern, else `snapshot` → `match`… → `capped`.
- `GET /api/next-truck` → `{ batch: number; commonAuthor: string; sentinelAuthor: string }`.

### Client api (`api.ts`)
```ts
export function searchBooks(predicate, page, pageSize, sort?: string, dir?: 'asc'|'desc'): Promise<BooksResponse>
export function truckload(): Promise<{ inserted: number; total: number; sampleAuthors: string[] }>
export function nextTruck(): Promise<{ batch: number; commonAuthor: string; sentinelAuthor: string }>
export function liveSearchUrl(predicate: DemoPredicate, sort: string, dir: 'asc'|'desc'): string  // `/api/live?...`
```

### Sort (client state, both tabs)
`{ field: 'year' | 'author' | 'title'; dir: 'asc' | 'desc' }`. Tab components receive `predicate: DemoPredicate` and `sort: { field; dir }` as props.

---

## WAVE 1 — concurrent, file-disjoint

### Task L1: watcher → emitter + per-doc `indexed` + opt-in backfill
**Files:** Modify `packages/mongo/src/startSearchSync.ts`; Create `packages/mongo/src/startSearchSync.test.ts`

- [ ] Replace the whole `startSearchSync.ts` with:
```ts
import type { ChangeStream, Collection } from 'mongodb'
import type { MongoSearchConfig } from './config'
import { DEFAULT_NAMESPACE } from './config'
import { computeSearchFields } from './computeSearchFields'

export type SearchSyncEvent =
  | { type: 'indexing-started' }
  | { type: 'indexing-finished'; count: number; durationMs: number }
  | { type: 'indexed'; id: unknown }
export type SearchSyncListener = (event: SearchSyncEvent) => void
export interface SearchSync {
  on(listener: SearchSyncListener): void
  off(listener: SearchSyncListener): void
  stop(): Promise<void>
}
export interface StartSearchSyncOptions { idleMs?: number; backfill?: boolean }

// Tails the collection change stream, derives search fields, and notifies
// listeners. Requires a replica set. Emits indexing-started / indexing-finished
// (debounced burst, for logging) and a per-doc `indexed` event AFTER the derive
// write resolves (so filters on the derived fields will match). With
// `backfill: true`, derives any pre-existing documents missing the namespace on
// start (change streams are forward-only, so this catches docs written before
// the watcher ran or during downtime — e.g. an external Python writer).
export function startSearchSync(
  collection: Collection,
  config: MongoSearchConfig,
  options: StartSearchSyncOptions = {},
): SearchSync {
  const ns = config.namespace ?? DEFAULT_NAMESPACE
  const { idleMs = 750, backfill = false } = options
  const stream: ChangeStream = collection.watch([], { fullDocument: 'updateLookup' })
  const listeners = new Set<SearchSyncListener>()
  const emit = (e: SearchSyncEvent) => { for (const l of listeners) l(e) }

  let active = false
  let count = 0
  let startedAt = 0
  let idleTimer: ReturnType<typeof setTimeout> | undefined

  stream.on('change', (change: any) => {
    if (!['insert', 'update', 'replace'].includes(change.operationType)) return
    const doc = change.fullDocument
    if (!doc) return
    const derived = computeSearchFields(doc, config) as Record<string, unknown>
    // Loop guard: our own echo writes already match -> skip (and don't count).
    if (JSON.stringify(doc[ns]) === JSON.stringify(derived[ns])) return

    if (!active) { active = true; count = 0; startedAt = Date.now(); emit({ type: 'indexing-started' }) }
    count += 1
    // Emit `indexed` only AFTER the derive write lands, so live match-tests see
    // the derived fields.
    void collection.updateOne({ _id: doc._id }, { $set: { [ns]: derived[ns] } })
      .then(() => emit({ type: 'indexed', id: doc._id }))
      .catch(() => { /* ignore individual write failures */ })

    if (idleTimer) clearTimeout(idleTimer)
    idleTimer = setTimeout(() => {
      active = false
      emit({ type: 'indexing-finished', count, durationMs: Date.now() - startedAt })
    }, idleMs)
  })

  // Optional one-time backfill. The stream is already open, so writes arriving
  // during the sweep are handled normally; the loop-guard dedups the overlap.
  if (backfill) void runBackfill()
  async function runBackfill() {
    const startedAt = Date.now()
    let n = 0
    emit({ type: 'indexing-started' })
    const cursor = collection.find({ [ns]: { $exists: false } })
    for await (const doc of cursor) {
      const derived = computeSearchFields(doc, config) as Record<string, unknown>
      await collection.updateOne({ _id: doc._id }, { $set: { [ns]: derived[ns] } }).catch(() => {})
      n += 1
    }
    emit({ type: 'indexing-finished', count: n, durationMs: Date.now() - startedAt })
  }

  return {
    on: (l) => { listeners.add(l) },
    off: (l) => { listeners.delete(l) },
    stop: async () => { if (idleTimer) clearTimeout(idleTimer); listeners.clear(); await stream.close() },
  }
}
```
- [ ] **Create `packages/mongo/src/startSearchSync.test.ts`** (integration; self-skips without Mongo):
```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { MongoClient } from 'mongodb'
import { startSearchSync } from './startSearchSync'
import type { MongoSearchConfig } from './config'

const URL = process.env.MONGO_URL ?? 'mongodb://localhost:27018/?directConnection=true'
const config: MongoSearchConfig = { targets: { name: { fields: ['name'] } } }
let client: MongoClient
let available = true

beforeAll(async () => {
  try { client = await MongoClient.connect(URL, { serverSelectionTimeoutMS: 1500 }) }
  catch { available = false }
})
afterAll(async () => { await client?.close() })

describe('startSearchSync backfill', () => {
  it('derives a pre-existing doc written before the watcher starts', async () => {
    if (!available) return
    const col = client.db('qt_backfill_test').collection('docs')
    await col.deleteMany({})
    await col.insertOne({ _id: 'pre', name: 'Émile Zola' } as never) // raw, before watcher
    const sync = startSearchSync(col, config, { backfill: true })
    await new Promise(r => setTimeout(r, 1200))
    const doc = await col.findOne({ _id: 'pre' as never }) as any
    expect(doc?._qt?.name?.norm).toBe('emile zola')
    await sync.stop()
  })
})
```

### Task L2: live-search engine
**Files:** Create `packages/mongo/src/createLiveSearch.ts`, `packages/mongo/src/createLiveSearch.test.ts`

- [ ] **`createLiveSearch.ts`:**
```ts
import type { Collection, Document, Filter } from 'mongodb'
import type { MongoSearchConfig } from './config'
import type { SearchSync, SearchSyncEvent } from './startSearchSync'

export type LiveEvent =
  | { type: 'snapshot'; items: Document[] }
  | { type: 'match'; item: Document }
  | { type: 'capped' }

export interface CreateLiveSearchOptions {
  sync: SearchSync
  collection: Collection
  config: MongoSearchConfig
  filter: Filter<Document>
  sort?: { field: string; dir: 1 | -1 }
  cap?: number
  sendEvent: (event: LiveEvent) => void
}

// Transport-agnostic live search: emits the current matching set (capped), then
// one `match` per newly-indexed document that matches `filter`, then `capped`.
export function createLiveSearch(opts: CreateLiveSearchOptions): { stop: () => void } {
  const { sync, collection, config: _config, filter, sort, cap = 500, sendEvent } = opts
  const seen = new Set<string>()
  let count = 0
  let capped = false

  const idOf = (doc: Document) => String(doc._id)

  // Initial snapshot (sorted for a nicer first paint; client re-sorts anyway).
  const cursor = collection.find(filter)
  if (sort) cursor.sort({ [sort.field]: sort.dir })
  void cursor.limit(cap).toArray().then((items) => {
    for (const it of items) seen.add(idOf(it))
    count = items.length
    sendEvent({ type: 'snapshot', items })
    if (count >= cap) { capped = true; sendEvent({ type: 'capped' }) }
  }).catch(() => sendEvent({ type: 'snapshot', items: [] }))

  const listener = (e: SearchSyncEvent) => {
    if (e.type !== 'indexed' || capped) return
    void collection.findOne({ $and: [{ _id: e.id as any }, filter] })
      .then((doc) => {
        if (!doc || capped) return
        const id = idOf(doc)
        if (seen.has(id)) return
        seen.add(id)
        count += 1
        sendEvent({ type: 'match', item: doc })
        if (count >= cap) { capped = true; sendEvent({ type: 'capped' }) }
      })
      .catch(() => { /* skip a failed match-test; keep the stream alive */ })
  }
  sync.on(listener)

  return { stop: () => sync.off(listener) }
}
```
- [ ] **`createLiveSearch.test.ts`** (integration; self-skips without Mongo, like `parity.test.ts`):
```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { MongoClient } from 'mongodb'
import { computeSearchFields, createSearchIndexes, buildTextSearchFilter, startSearchSync, createLiveSearch } from './index'
import type { MongoSearchConfig } from './config'
import type { LiveEvent } from './createLiveSearch'

const URL = process.env.MONGO_URL ?? 'mongodb://localhost:27018/?directConnection=true'
const config: MongoSearchConfig = { targets: { name: { fields: ['name'] } } }
let client: MongoClient
let available = true

beforeAll(async () => {
  try {
    client = await MongoClient.connect(URL, { serverSelectionTimeoutMS: 1500 })
    const col = client.db('qt_live_test').collection('docs')
    await col.deleteMany({})
    await col.insertMany([{ _id: 'a', name: 'Émile Zola', ...computeSearchFields({ name: 'Émile Zola' }, config) }] as never[])
    await createSearchIndexes(col, config)
  } catch { available = false }
})
afterAll(async () => { await client?.close() })

describe('createLiveSearch', () => {
  it('emits a snapshot of current matches', async () => {
    if (!available) return
    const col = client.db('qt_live_test').collection('docs')
    const sync = startSearchSync(col, config)
    const events: LiveEvent[] = []
    const live = createLiveSearch({ sync, collection: col, config, filter: buildTextSearchFilter('name', ['zola'], config), sendEvent: e => events.push(e) })
    await new Promise(r => setTimeout(r, 300))
    expect(events[0]?.type).toBe('snapshot')
    expect((events[0] as any).items.map((d: any) => d._id)).toContain('a')
    live.stop(); await sync.stop()
  })

  it('pushes a match for a newly-inserted matching doc', async () => {
    if (!available) return
    const col = client.db('qt_live_test').collection('docs')
    const sync = startSearchSync(col, config)
    const events: LiveEvent[] = []
    const live = createLiveSearch({ sync, collection: col, config, filter: buildTextSearchFilter('name', ['borges'], config), sendEvent: e => events.push(e) })
    await new Promise(r => setTimeout(r, 200))
    await col.insertOne({ _id: 'b', name: 'Jorge Luis Borges' } as never) // raw; watcher derives
    await new Promise(r => setTimeout(r, 1500))
    expect(events.some(e => e.type === 'match' && (e as any).item._id === 'b')).toBe(true)
    live.stop(); await sync.stop()
  })
})
```

### Task L3: SSE formatting
**Files:** Create `packages/mongo/src/sse.ts`, `packages/mongo/src/sse.test.ts`

- [ ] **`sse.ts`:**
```ts
// Framework-agnostic SSE wire helpers.
export function formatSse(event: unknown): string {
  return `data: ${JSON.stringify(event)}\n\n`
}
export function sseComment(text = 'ping'): string {
  return `: ${text}\n\n`
}
```
- [ ] **`sse.test.ts`:**
```ts
import { describe, it, expect } from 'vitest'
import { formatSse, sseComment } from './sse'

describe('sse', () => {
  it('formats a data event with trailing blank line', () => {
    expect(formatSse({ type: 'match', item: { _id: 'x' } })).toBe('data: {"type":"match","item":{"_id":"x"}}\n\n')
  })
  it('formats a heartbeat comment', () => {
    expect(sseComment()).toBe(': ping\n\n')
  })
})
```

### Task L4: Fastify SSE adapter
**Files:** Create `packages/mongo/src/adapters/fastify.ts`

- [ ] **`adapters/fastify.ts`:**
```ts
import type { Collection, Document, Filter } from 'mongodb'
import type { FastifyReply, FastifyRequest } from 'fastify'
import type { MongoSearchConfig } from '../config'
import type { SearchSync } from '../startSearchSync'
import { createLiveSearch } from '../createLiveSearch'
import { formatSse, sseComment } from '../sse'

export interface StreamLiveSearchOptions {
  sync: SearchSync
  collection: Collection
  config: MongoSearchConfig
  filter: Filter<Document>
  sort?: { field: string; dir: 1 | -1 }
  cap?: number
  heartbeatMs?: number
}

// Stream a live search to a Fastify reply as Server-Sent Events. Transport glue
// only: it owns SSE headers, the heartbeat, and disconnect cleanup; all search
// behavior is in createLiveSearch.
export function streamLiveSearch(
  request: FastifyRequest,
  reply: FastifyReply,
  opts: StreamLiveSearchOptions,
): void {
  reply.raw.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  })
  reply.hijack() // we own the socket; Fastify must not try to send a reply
  const sendEvent = (e: unknown) => reply.raw.write(formatSse(e))
  const live = createLiveSearch({ ...opts, sendEvent })
  const hb = setInterval(() => reply.raw.write(sseComment()), opts.heartbeatMs ?? 25000)
  request.raw.on('close', () => { clearInterval(hb); live.stop() })
}
```

### Task L5: library exports
**Files:** Modify `packages/mongo/src/index.ts`

- [ ] Append:
```ts
export { createLiveSearch } from './createLiveSearch'
export type { LiveEvent, CreateLiveSearchOptions } from './createLiveSearch'
export { formatSse, sseComment } from './sse'
export type { SearchSync, SearchSyncEvent, SearchSyncListener, StartSearchSyncOptions } from './startSearchSync'
```
(Keep the existing `startSearchSync` export. Remove the old `SearchSyncEvent`/`StartSearchSyncOptions` re-export line if present and replace with the line above. Do NOT export the Fastify adapter here — it is a subpath export.)

### Task L6: package manifest (subpath + peer dep)
**Files:** Modify `packages/mongo/package.json`

- [ ] Set `exports` to include the fastify subpath, and add fastify as an optional peer dep:
```jsonc
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "development": "./src/index.ts",
      "require": "./dist/index.cjs",
      "import": "./dist/index.js"
    },
    "./fastify": {
      "types": "./dist/adapters/fastify.d.ts",
      "development": "./src/adapters/fastify.ts",
      "require": "./dist/adapters/fastify.cjs",
      "import": "./dist/adapters/fastify.js"
    }
  },
```
- [ ] Add to `peerDependencies`: `"fastify": "^4 || ^5"`. Add a top-level `"peerDependenciesMeta": { "fastify": { "optional": true } }`. Add `"fastify": "^4.0.0"` to `devDependencies` (so the adapter typechecks/builds).

### Task L7: tsup second entry
**Files:** Modify `packages/mongo/tsup.config.ts`

- [ ] Replace with:
```ts
import { defineConfig } from 'tsup'
export default defineConfig({
  entry: ['src/index.ts', 'src/adapters/fastify.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  clean: true,
  external: ['mongodb', 'fastify', '@quaesitor-textus/core'],
})
```

### Task L8: library README
**Files:** Modify `packages/mongo/README.md`

- [ ] Add a "Live search (SSE)" section documenting: `startSearchSync` returns a `SearchSync` emitter (`.on(listener)` receives `indexing-started|indexing-finished|indexed`); `createLiveSearch({ sync, collection, config, filter, sort?, cap?, sendEvent })` is the transport-agnostic engine (`snapshot`/`match`/`capped`); `formatSse`/`sseComment` are wire helpers; and `@quaesitor-textus/mongo/fastify`'s `streamLiveSearch(request, reply, opts)` wires it to a Fastify route (fastify is an optional peer dep). Include a short Fastify route example and note Express/other frameworks can reuse `createLiveSearch` + `formatSse` directly.
- [ ] Also document **`startSearchSync(col, config, { backfill: true })`** for the external-writer / restart-resilience case: change streams are forward-only, so `backfill` derives pre-existing documents (missing the namespace) on start. Note the heterogeneous-writer pattern (e.g. a Python tool writes documents; a separate Node app runs the watcher with `backfill: true` + serves search), and that it requires a replica set.

### Task D1: generator — per-batch sentinels + helpers
**Files:** Modify `packages/demo/src/shared/generator.ts`

- [ ] Replace the single-sentinel logic with a per-batch scheme. Add near the top (after the `AUTHORS` pool):
```ts
// One distinctive diacritic author per truck batch (batch k -> SENTINELS[k-1]),
// injected at index 1000*k + 500, exclusive to that batch.
export const SENTINELS = [
  'Miguel Ángel Asturias', 'Halldór Laxness', 'Émile Zola', 'Søren Kierkegaard',
  'José Saramago', 'Karel Čapek', 'Naguib Mahfouz', 'Knut Hamsun', 'Yukio Mishima',
]
export function batchSentinel(batch: number): string {
  return SENTINELS[Math.min(Math.max(batch, 1), SENTINELS.length) - 1]
}
// A pool author guaranteed to recur frequently within any batch (~67/1000).
export function batchCommonAuthor(_batch: number): string {
  return 'Jorge Luis Borges'
}
```
- [ ] In `generateBooks`, replace the `i === RESERVED_INDEX` branch (and remove the old `RESERVED_INDEX`/`SENTINEL_AUTHOR` single-sentinel constants) with per-batch injection:
```ts
    } else if (i >= 1000 && i % 1000 === 500) {
      // index 1000*k + 500 -> batch k's unique sentinel
      author = batchSentinel(Math.floor(i / 1000))
      title = 'El Señor Presidente'
      year = 1946
    } else {
```
- [ ] Keep `Jorge Luis Borges` in the `AUTHORS` pool (it already is) so `batchCommonAuthor` is a real frequent author. Keep `SENTINEL_AUTHOR` export ONLY if still referenced elsewhere; otherwise remove it (the server now uses `batchSentinel`). (The server task D3 will stop importing `SENTINEL_AUTHOR`.)

### Task D2: predicate — `hasTextPattern`
**Files:** Modify `packages/demo/src/shared/predicate.ts`

- [ ] Append:
```ts
// True if the predicate contains at least one TEXT leaf with patterns.
export function hasTextPattern(p: DemoPredicate): boolean {
  if ('AND' in p) return p.AND.some(hasTextPattern)
  if ('OR' in p) return p.OR.some(hasTextPattern)
  if ('TEXT' in p) return p.TEXT.patterns.length > 0
  return false
}
```

### Task D3: server — sort, /api/live, /api/next-truck, emitter migration
**Files:** Modify `packages/demo/src/server/index.ts`

- [ ] Update imports:
```ts
import { createSearchIndexes, startSearchSync, formatSse } from '@quaesitor-textus/mongo'
import { streamLiveSearch } from '@quaesitor-textus/mongo/fastify'
import { demoConfig } from '../shared/config'
import { predicateToMongo } from '../shared/predicateToMongo'
import { hasTextPattern } from '../shared/predicate'
import type { DemoPredicate } from '../shared/predicate'
import { generateBooks, TOTAL_BOOKS, TRUCK_SIZE, batchCommonAuthor, batchSentinel } from '../shared/generator'
```
- [ ] Replace the watcher start + logging (the old `startSearchSync(col, demoConfig, { onEvent })`) with the emitter form, keeping the `sync` handle for `/api/live`:
```ts
  const sync = startSearchSync(col, demoConfig)
  sync.on((e) => {
    if (e.type === 'indexing-started') app.log.info('search-sync: indexing started')
    else if (e.type === 'indexing-finished') app.log.info(`search-sync: indexing finished — ${e.count} document(s) in ${e.durationMs}ms`)
  })
```
(Place this AFTER `app` is created, as now.)
- [ ] Add `sort`/`dir` to `GET /api/books` (after building `filter`):
```ts
    const sortField = ['year', 'author', 'title'].includes(q.sort) ? q.sort : undefined
    const sortDir = q.dir === 'desc' ? -1 : 1
    const cursor = col.find(filter)
    if (sortField) cursor.sort({ [sortField]: sortDir })
    const [items, total] = await Promise.all([
      cursor.skip((page - 1) * pageSize).limit(pageSize).toArray(),
      col.countDocuments(filter),
    ])
```
- [ ] Add the SSE + next-truck routes:
```ts
  app.get('/api/live', (request, reply) => {
    const q = request.query as Record<string, string>
    const predicate: DemoPredicate | null = q.filter ? (JSON.parse(q.filter) as DemoPredicate) : null
    if (!predicate || !hasTextPattern(predicate)) {
      reply.raw.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' })
      reply.hijack()
      reply.raw.write(formatSse({ type: 'idle' }))
      reply.raw.end()
      return
    }
    const filter = predicateToMongo(predicate, demoConfig)
    const sortField = ['year', 'author', 'title'].includes(q.sort) ? q.sort : undefined
    const sort = sortField ? { field: sortField, dir: (q.dir === 'desc' ? -1 : 1) as 1 | -1 } : undefined
    streamLiveSearch(request, reply, { sync, collection: col, config: demoConfig, filter, sort, cap: 500 })
  })

  app.get('/api/next-truck', async () => {
    const n = await col.countDocuments({})
    const batch = Math.floor(n / TRUCK_SIZE) // n=1000 -> batch 1 (indices 1000..1999)
    return { batch, commonAuthor: batchCommonAuthor(batch), sentinelAuthor: batchSentinel(batch) }
  })
```
- [ ] Leave `/api/truckload` as-is (its `sampleAuthors` still works). If `SENTINEL_AUTHOR` import is now unused, remove it from the import list.

### Task D4: client api helpers
**Files:** Modify `packages/demo/src/client/api.ts`

- [ ] Replace the file with:
```ts
import type { DemoPredicate } from '../shared/predicate'
import type { Book } from '../shared/generator'

export interface BooksResponse { items: Book[]; total: number; page: number; pageSize: number }

export async function searchBooks(
  predicate: DemoPredicate, page: number, pageSize: number, sort?: string, dir?: 'asc' | 'desc',
): Promise<BooksResponse> {
  const params = new URLSearchParams({ filter: JSON.stringify(predicate), page: String(page), pageSize: String(pageSize) })
  if (sort) { params.set('sort', sort); params.set('dir', dir ?? 'asc') }
  const res = await fetch(`/api/books?${params}`)
  if (!res.ok) throw new Error(`search failed: ${res.status}`)
  return res.json()
}

export async function truckload(): Promise<{ inserted: number; total: number; sampleAuthors: string[] }> {
  const res = await fetch('/api/truckload', { method: 'POST' })
  if (!res.ok) throw new Error(`truckload failed: ${res.status}`)
  return res.json()
}

export async function nextTruck(): Promise<{ batch: number; commonAuthor: string; sentinelAuthor: string }> {
  const res = await fetch('/api/next-truck')
  if (!res.ok) throw new Error(`next-truck failed: ${res.status}`)
  return res.json()
}

export function liveSearchUrl(predicate: DemoPredicate, sort: string, dir: 'asc' | 'desc'): string {
  const params = new URLSearchParams({ filter: JSON.stringify(predicate), sort, dir })
  return `/api/live?${params}`
}
```

### Task D5: App restructure (common section + tabs)
**Files:** Modify `packages/demo/src/client/App.tsx`

- [ ] Replace the file with the structure below. `DemoBody` (inside the providers) builds the predicate from search context + holds mode/year/case-sensitive/sort/truck state, renders the common controls, and renders `Tabs` with `destroyInactiveTabPane` (this is the active-tab gating — the inactive tab unmounts, tearing down its fetch/EventSource).
```tsx
import React, { useEffect, useMemo, useState } from 'react'
import { Tabs, Switch, Space, Slider, Checkbox, Button, Select, Typography } from 'antd'
import { WithSearch, SearchInput, useSearchContext } from '@quaesitor-textus/core'
import { and, or, text, yearRange } from '../shared/predicate'
import type { DemoPredicate } from '../shared/predicate'
import { truckload, nextTruck } from './api'
import { QueryTab } from './QueryTab'
import { StreamTab } from './StreamTab'

const YEAR_MIN = -800
const YEAR_MAX = 2024
export type Sort = { field: 'year' | 'author' | 'title'; dir: 'asc' | 'desc' }

function DemoBody() {
  const { patterns: authorP } = useSearchContext('author')
  const { patterns: titleP } = useSearchContext('title')
  const [mode, setMode] = useState<'AND' | 'OR'>('AND')
  const [years, setYears] = useState<[number, number]>([YEAR_MIN, YEAR_MAX])
  const [authorCS, setAuthorCS] = useState(false)
  const [titleCS, setTitleCS] = useState(false)
  const [sort, setSort] = useState<Sort>({ field: 'year', dir: 'asc' })
  const [truckMsg, setTruckMsg] = useState('')
  const [hint, setHint] = useState('')

  const refreshHint = () => nextTruck().then(t =>
    setHint(`next truck — common: ${t.commonAuthor} · sentinel: ${t.sentinelAuthor}`)).catch(() => {})
  useEffect(() => { refreshHint() }, [])

  const onTruck = async () => {
    setTruckMsg('Delivering…')
    const r = await truckload()
    setTruckMsg(`Delivered ${r.inserted}; ${r.total} total (${10000 - r.total} left).`)
    refreshHint()
  }

  const predicate: DemoPredicate = useMemo(() => {
    const nodes: DemoPredicate[] = []
    if (authorP.length) nodes.push(text('author', authorP, authorCS ? { caseSensitive: true } : undefined))
    if (titleP.length) nodes.push(text('title', titleP, titleCS ? { caseSensitive: true } : undefined))
    const yp = yearRange(years[0], years[1])
    if (!nodes.length) return yp
    return mode === 'AND' ? and(...nodes, yp) : and(or(...nodes), yp)
  }, [authorP, titleP, mode, years, authorCS, titleCS])

  return (
    <div style={{ fontFamily: 'sans-serif', padding: 24, maxWidth: 900, margin: '0 auto' }}>
      <h2>quaesitor-textus — server-side book search (MongoDB)</h2>
      <Space style={{ marginBottom: 12 }}>
        <Button type="primary" onClick={onTruck}>Receive a truckload of new books (1000)</Button>
        <span style={{ color: '#888' }}>{truckMsg}</span>
      </Space>
      <div style={{ color: '#aaa', fontSize: 12, marginBottom: 12 }}>{hint}</div>
      <Space wrap style={{ marginBottom: 12 }}>
        <Space direction="vertical" size={0}>
          <SearchInput name="author" placeholder="Search author" style={{ width: 220 }} />
          <Checkbox checked={authorCS} onChange={e => setAuthorCS(e.target.checked)}>case sensitive</Checkbox>
        </Space>
        <Space><span>AND</span><Switch checked={mode === 'OR'} onChange={c => setMode(c ? 'OR' : 'AND')} size="small" /><span>OR</span></Space>
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
        <span>Sort:</span>
        <Select value={sort.field} style={{ width: 120 }} onChange={(field: Sort['field']) => setSort(s => ({ ...s, field }))}
          options={[{ value: 'year', label: 'Year' }, { value: 'author', label: 'Author' }, { value: 'title', label: 'Title' }]} />
        <Select value={sort.dir} style={{ width: 100 }} onChange={(dir: Sort['dir']) => setSort(s => ({ ...s, dir }))}
          options={[{ value: 'asc', label: 'Asc' }, { value: 'desc', label: 'Desc' }]} />
      </Space>
      <Tabs
        destroyInactiveTabPane
        items={[
          { key: 'query', label: 'Query-based UI', children: <QueryTab predicate={predicate} sort={sort} /> },
          { key: 'stream', label: 'Streaming-based UI', children: <StreamTab predicate={predicate} sort={sort} /> },
        ]}
      />
    </div>
  )
}

export function App() {
  return (
    <WithSearch name="author" field="author">
      <WithSearch name="title" field="title">
        <DemoBody />
      </WithSearch>
    </WithSearch>
  )
}
```

### Task D6: QueryTab (paginated table + server sort + refresh)
**Files:** Create `packages/demo/src/client/QueryTab.tsx`

- [ ] **`QueryTab.tsx`:**
```tsx
import React, { useEffect, useState } from 'react'
import { Table, Button, Typography, Space } from 'antd'
import type { TableColumnsType } from 'antd'
import { HighlightedText } from '@quaesitor-textus/core'
import { searchBooks } from './api'
import type { DemoPredicate } from '../shared/predicate'
import type { Book } from '../shared/generator'
import type { Sort } from './App'

export function QueryTab({ predicate, sort }: { predicate: DemoPredicate; sort: Sort }) {
  const [page, setPage] = useState(1)
  const pageSize = 10
  const [data, setData] = useState<{ items: Book[]; total: number }>({ items: [], total: 0 })
  const [tick, setTick] = useState(0)

  useEffect(() => { setPage(1) }, [predicate, sort])
  useEffect(() => {
    let live = true
    searchBooks(predicate, page, pageSize, sort.field, sort.dir)
      .then(r => { if (live) setData({ items: r.items, total: r.total }) })
    return () => { live = false }
  }, [predicate, sort, page, tick])

  const columns: TableColumnsType<Book> = [
    { title: 'Author', dataIndex: 'author', render: (a: string) => <HighlightedText text={a} searchNames="author" /> },
    { title: 'Title', dataIndex: 'title', render: (t: string) => <HighlightedText text={t} searchNames="title" /> },
    { title: 'Year', dataIndex: 'year', width: 90 },
  ]
  return (
    <>
      <Space style={{ marginBottom: 8 }}>
        <Typography.Text type="secondary">{data.total} matching books</Typography.Text>
        <Button size="small" onClick={() => setTick(t => t + 1)}>Refresh</Button>
      </Space>
      <Table<Book> rowKey="_id" dataSource={data.items} columns={columns}
        pagination={{ current: page, pageSize, total: data.total, onChange: setPage }} />
    </>
  )
}
```

### Task D7: StreamTab (SSE live list + client sort)
**Files:** Create `packages/demo/src/client/StreamTab.tsx`

- [ ] **`StreamTab.tsx`:**
```tsx
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { List, Typography } from 'antd'
import { HighlightedText } from '@quaesitor-textus/core'
import { liveSearchUrl, searchBooks } from './api'
import { hasTextPattern } from '../shared/predicate'
import type { DemoPredicate } from '../shared/predicate'
import type { Book } from '../shared/generator'
import type { Sort } from './App'

function cmp(a: Book, b: Book, sort: Sort): number {
  const av = a[sort.field] as string | number
  const bv = b[sort.field] as string | number
  let r = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv))
  return sort.dir === 'desc' ? -r : r
}

export function StreamTab({ predicate, sort }: { predicate: DemoPredicate; sort: Sort }) {
  const active = hasTextPattern(predicate)
  const [items, setItems] = useState<Book[]>([])
  const [capped, setCapped] = useState(false)
  const [emptyTotal, setEmptyTotal] = useState<number | null>(null)
  const seen = useRef<Set<string>>(new Set())

  // Re-sort the displayed list whenever the sort changes.
  const sorted = useMemo(() => [...items].sort((a, b) => cmp(a, b, sort)), [items, sort])

  useEffect(() => {
    seen.current = new Set(); setItems([]); setCapped(false); setEmptyTotal(null)
    if (!active) {
      // No text filter -> don't stream; just show the total count for context.
      searchBooks(predicate, 1, 1).then(r => setEmptyTotal(r.total)).catch(() => {})
      return
    }
    const es = new EventSource(liveSearchUrl(predicate, sort.field, sort.dir))
    const add = (book: Book) => {
      if (seen.current.has(book._id)) return
      seen.current.add(book._id)
      setItems(prev => [...prev, book])
    }
    es.onmessage = (ev) => {
      const e = JSON.parse(ev.data)
      if (e.type === 'snapshot') e.items.forEach(add)
      else if (e.type === 'match') add(e.item)
      else if (e.type === 'capped') setCapped(true)
    }
    return () => es.close()
    // Re-subscribe when the predicate changes; sort changes only re-sort (above),
    // so sort.field/dir are intentionally NOT in the deps for the connection.
  }, [predicate, active])

  if (!active) {
    return <Typography.Paragraph type="secondary">
      Enter an author or title to start the live stream{emptyTotal !== null ? ` (${emptyTotal} books total)` : ''}.
    </Typography.Paragraph>
  }
  return (
    <>
      <Typography.Paragraph type="secondary">
        {sorted.length} matching books (live){capped ? ' — showing first 500' : ''}
      </Typography.Paragraph>
      <List size="small" dataSource={sorted} rowKey={(b) => b._id}
        renderItem={(b) => (
          <List.Item>
            <HighlightedText text={b.author} searchNames="author" />{' — '}
            <HighlightedText text={b.title} searchNames="title" />{' '}
            <span style={{ color: '#999', fontSize: 12 }}>({b.year})</span>
          </List.Item>
        )} />
    </>
  )
}
```
> Note: the live connection deliberately re-opens only on `predicate` change; `sort` changes re-order the already-accumulated list client-side (the `sorted` memo). The initial snapshot is server-sorted for first paint.

### Task D8: demo README — two examples
**Files:** Modify `packages/demo/README.md`

- [ ] Add a "Two examples" section: the **Query-based** tab (request/response, server sort, manual Refresh) and the **Streaming-based** tab (SSE live list, client sort, results pour in on truckload). Document the walkthrough: read the button's pre-announced next-truck common author + sentinel, arm the search, switch to the Streaming tab, press the truckload, watch rows pour in (common author) plus the single sentinel hit. Note the empty-search prompt and the 500 cap.

---

## FINAL PHASE (orchestrator only — after the wave)

- [ ] **F1 — install.** From repo root: `CI=true pnpm install --no-frozen-lockfile` (registers the new fastify devDep/peer + adapter entry). If pnpm prompts to approve esbuild builds again, `allowBuilds: esbuild: true` is already set.
- [ ] **F2 — build libs.** `pnpm --filter @quaesitor-textus/core --filter @quaesitor-textus/mongo build`. Fix compile errors (e.g. the `index.ts` re-export overlap, the adapter's fastify types). Confirm `dist/adapters/fastify.*` emitted.
- [ ] **F3 — typecheck demo.** `cd packages/demo && pnpm exec tsc -p tsconfig.server.json --noEmit && pnpm exec tsc -p tsconfig.json --noEmit`. Fix issues (e.g. `Book[sort.field]` typing in StreamTab, any unused `SENTINEL_AUTHOR`).
- [ ] **F4 — unit tests.** `MONGO_URL='mongodb://localhost:27018/?directConnection=true' pnpm --filter @quaesitor-textus/mongo test` (needs the demo RS Mongo up: `cd packages/demo && make mongo-up && make seed`). Confirm `sse.test.ts` passes and `createLiveSearch.test.ts` pushes a `match`. Also run core: `pnpm --filter @quaesitor-textus/core test`.
- [ ] **F5 — live smoke.** `make run-backend`; open the app; on the Streaming tab arm the pre-announced common author, press truckload, confirm rows pour in + sentinel hit + backend `indexing started/finished` logs; confirm empty-search prompt and the Query tab's Refresh button. Tear down with `make mongo-down` if needed (watch `df -h /mnt/docker-data`).
- [ ] **F6 — commit.** One commit (or split lib/demo). Use the repo Co-Authored-By trailer.

## Notes on parallel shape
- No per-task tests/commits; tests are authored with their code and run only in F4. Barriers broken: D5 imports D6/D7; D3 imports the L4 adapter + D1 helpers + L1 emitter; L2 imports L1 types. None block scheduling.
- Each file has exactly one owner (e.g. `mongo/src/index.ts` = L5 only; `mongo/package.json` = L6 only; `demo/src/client/App.tsx` = D5 only).
