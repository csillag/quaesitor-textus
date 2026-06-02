# @quaesitor-textus/mongo

Server-side MongoDB search that reproduces the exact matching behaviour of
[`@quaesitor-textus/core`](../core) — diacritic- and case-insensitive substring
matching — **index-backed** and with **zero server-side JavaScript**.

## What it is / why

`@quaesitor-textus/core` does its matching in the browser: it folds text (Unicode
normalization, diacritic stripping, case folding) and runs substring matches over
an in-memory corpus. That is perfect for a few hundred items already on the client,
but it does not scale to a collection that lives in a database.

This package is the server-side companion. It moves the same matching semantics
into MongoDB while keeping two hard constraints:

- **Index-backed.** Queries use a multikey index over stored n-grams as a coarse
  superset pre-filter, so Mongo never has to scan the whole collection for a
  substring.
- **No server-side JavaScript.** MongoDB's query engine (and its `$where` / server
  JS) does **not** implement `String.prototype.normalize`, so it cannot fold
  Unicode the way the client does. Instead, **all normalization happens in Node at
  ingest time**: each document gets derived fields holding fully-folded n-grams and
  one pre-folded "verify" string per query mode. Queries then combine a `$all`
  n-gram filter with a `$regex` substring check against the appropriate verify
  string. The folding never runs inside Mongo — it was already baked into the
  stored fields.

The result: a server query built by `buildTextSearchFilter` returns exactly what
the client's `matchItem` would have matched over the same corpus. (That guarantee
is exercised by the parity integration test in this package.)

### How the derived fields are shaped

For namespace `ns` (default `_qt`) and a configured target `t`, each document gains:

```
{ [ns]: { [t]: { ngrams: string[], norm: string, /* + e.g. */ norm_cs: string } } }
```

- `ngrams` — bigrams + trigrams of the **fully-folded** corpus
  (`normalizeText(corpus, {})`). This is the coarsest fold, so the same n-gram index
  is a valid superset filter for every query mode.
- one **verify string** per stored query mode, keyed by `modeKey(mode)`:
  - `norm` — the base, fully-folded string (case- and diacritic-insensitive).
  - `norm_cs` — case-sensitive (diacritics stripped, case preserved).
  - `norm_ds` — diacritic-sensitive (lowercased, diacritics preserved).
  - `norm_cs_ds` — both case- and diacritic-sensitive.

A query for a given mode `$all`s the fully-folded n-grams of its patterns against
`ngrams`, then `$regex`es each pattern (folded with that same mode) against the
mode's verify string.

## Mongo setup

Change streams (used by the recommended watcher, below) require MongoDB to run as a
**replica set**. A single-node replica set is enough for development.

With a stock `mongo:7` server:

```bash
mongod --replSet rs0 --bind_ip_all
# in another shell, once:
mongosh --eval 'rs.initiate()'
```

(`packages/demo` ships a `docker-compose.yml` + `Makefile` that does exactly this on
port 27018 with an idempotent `rs.initiate()` healthcheck — see the runnable
companion below.)

Then create the search indexes once, against your collection:

```ts
import { createSearchIndexes } from '@quaesitor-textus/mongo'

await createSearchIndexes(collection, config)
```

This creates one multikey index per target over its `ngrams` array (named
`${namespace}_${target}_ngrams`). If you only want to inspect the specs without
creating them, call `searchIndexSpecs(config)`.

## Server wiring

### 1. Define a `MongoSearchConfig`

A target names the document fields whose text you want to search, plus the query
modes you intend to support at runtime.

```ts
import type { MongoSearchConfig } from '@quaesitor-textus/mongo'

const config: MongoSearchConfig = {
  namespace: '_qt',          // optional; default '_qt'
  ngramSizes: [2, 3],        // optional; default [2, 3]
  targets: {
    author: { fields: ['author'], queryModes: [{ caseSensitive: true }] },
    title:  { fields: ['title'],  queryModes: [{ caseSensitive: true }] },
  },
}
```

- `fields` — paths harvested into the corpus (same path semantics as the core
  filter, e.g. nested objects/arrays and the `$` root).
- `options` — the base/default query mode for the target; defaults to `{}` (fully
  folded).
- `queryModes` — additional runtime-selectable modes. The set of verify strings a
  target stores is `[options ?? {}, ...queryModes]` deduped by `modeKey`.

### 2. Keep derived fields in sync

You need each document's derived `[namespace]` block to stay current as documents
are written. There are two ways:

**(a) Compute inline on every write.** Merge the derived fields into the document
before you persist it:

```ts
import { computeSearchFields } from '@quaesitor-textus/mongo'

const doc = { author: 'Gabriel García Márquez', title: 'One Hundred Years of Solitude' }
await collection.insertOne({ ...doc, ...computeSearchFields(doc, config) })
```

This gives you read-your-writes: the document is searchable the instant the insert
acknowledges. The cost is that every write path in your app must remember to do it.

**(b) Run the change-stream watcher (recommended).** Start it once at boot and write
your documents **raw** — the watcher recomputes and `$set`s the derived block for
you:

```ts
import { startSearchSync } from '@quaesitor-textus/mongo'

const sync = startSearchSync(collection, config)
// ... later, on shutdown:
await sync.stop()
```

The watcher tails the collection's change stream (`insert` / `update` / `replace`),
recomputes `computeSearchFields`, and writes the derived block back. It includes a
loop guard: if the stored derived block already equals the freshly computed one, it
skips the write so its own update does not retrigger the handler.

`startSearchSync` returns a `SearchSync` **emitter**: register a listener with
`sync.on(listener)` (remove it with `sync.off(listener)`) to receive a stream of
events — `indexing-started`, `indexing-finished` (a debounced burst summary, handy
for logging), and a per-document `indexed` event fired **after** each derive write
resolves (so a filter on the derived fields will match). Switch on `event.type`:

```ts
const sync = startSearchSync(collection, config)
sync.on((e) => {
  if (e.type === 'indexing-started') console.log('indexing started')
  else if (e.type === 'indexing-finished') console.log(`indexed ${e.count} doc(s) in ${e.durationMs}ms`)
})
```

**Backfill for external writers / restart resilience.** Change streams are
forward-only: they only see writes that happen *after* the watcher opens the stream,
so documents written before the watcher ran (or during downtime) never get a derived
block. Pass `{ backfill: true }` to sweep, on start, any pre-existing documents that
are missing the namespace (`{ [namespace]: { $exists: false } }`) and derive them:

```ts
const sync = startSearchSync(collection, config, { backfill: true })
```

This is the heterogeneous-writer pattern: one process (e.g. a Python tool) writes raw
documents, while a separate Node app runs the watcher with `backfill: true` and serves
search. On boot the Node app catches up on everything written while it was down, then
keeps current via the change stream. Backfill also requires a replica set.

**Versioned re-indexing.** `computeSearchFields` stamps `_qt._v = \`${SEARCH_FIELDS_VERSION}:${fingerprint(config)}\`` on each derived block. `SEARCH_FIELDS_VERSION` (a code constant) is bumped on any change to the derived output (normalization, n-grams, corpus, shape); the fingerprint hashes the derivation-affecting config (namespace, n-gram sizes, targets). The `backfill` sweep re-derives documents whose stored `_v` differs from the current one, so **upgrading the library or changing your config automatically re-indexes the collection on the next start with `backfill: true`** — no manual migration. This is how a normalization change (e.g. the precomposed-letter folding in v2) invalidates and rebuilds existing data.

**Trade-offs of the watcher:**

- It **requires a replica set** (change streams are a replica-set feature).
- Sync is **asynchronous**: there is a small window between your raw write and the
  watcher's `$set`. During that window the document exists but its text is not yet
  searchable, so **read-your-writes on text search is not guaranteed**. If you need
  the document searchable immediately, use approach (a) for that write (or do both —
  inline compute on the critical path, watcher as a backstop).

### 3. Translate a text-search node into a Mongo filter

```ts
import { buildTextSearchFilter } from '@quaesitor-textus/mongo'

const filter = buildTextSearchFilter('author', ['garcia', 'marquez'], config)
const rows = await collection.find(filter).toArray()
```

`buildTextSearchFilter(target, patterns, config, options?)` returns a
`Filter<Document>`:

- empty `patterns` → `{}` (match everything);
- otherwise `{ $and: [ { ngramField: { $all: <folded ngrams> } }, ...perPatternVerifyRegex ] }`.

Each pattern must be a substring of the mode-folded verify string (patterns are
AND-ed). Pass `options` to pick a non-default mode (e.g.
`{ caseSensitive: true }`); omit it to use the target's base mode.

## Client usage

The browser builds a query *description* and POSTs it to your server, which calls
`buildTextSearchFilter`. Below are three escalating shapes. The client tokenizes raw
input into patterns with core's `parseInput`.

### (a) Naive single field

```ts
import { parseInput } from '@quaesitor-textus/core'

// client
const patterns = parseInput(userInput)              // e.g. 'garcia marquez' → ['garcia','marquez']
await fetch('/api/search', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ patterns }),
})

// server
app.post('/api/search', async (req) => {
  const { patterns } = req.body as { patterns: string[] }
  const filter = buildTextSearchFilter('author', patterns, config)
  return collection.find(filter).toArray()
})
```

### (b) Two fields (author OR title)

Combine two per-target filters yourself with `$or`:

```ts
// server
const { patterns } = req.body as { patterns: string[] }
const filter = {
  $or: [
    buildTextSearchFilter('author', patterns, config),
    buildTextSearchFilter('title', patterns, config),
  ],
}
return collection.find(filter).toArray()
```

### (c) Inside a predicate tree

For richer UIs you will want to compose text search with other conditions (boolean
logic, scalar leaves). Here is **one reasonable, generic** predicate shape:

```ts
type Predicate =
  | { AND: Predicate[] }
  | { OR: Predicate[] }
  | { TEXT: { target: string; patterns: string[]; options?: SearchOptions } }
  | { YEAR: { gte?: number; lte?: number } }   // example scalar leaf

function toMongo(p: Predicate, config: MongoSearchConfig): Filter<Document> {
  if ('AND' in p) return p.AND.length ? { $and: p.AND.map(c => toMongo(c, config)) } : {}
  if ('OR' in p)  return p.OR.length  ? { $or:  p.OR.map(c => toMongo(c, config)) } : {}
  if ('TEXT' in p) return buildTextSearchFilter(p.TEXT.target, p.TEXT.patterns, config, p.TEXT.options)
  // ...scalar leaves like YEAR translate to ordinary Mongo range filters
  return {}
}
```

> **Note:** this package does **not** own or assume your filter syntax. The shape
> above is just one reasonable example — `buildTextSearchFilter` is the only piece
> you need from here; you decide how text-search nodes fit into your own query
> language. (`packages/demo` implements a concrete version of exactly this pattern.)

## Maintenance alternatives

The shipped mechanism for keeping derived fields in sync is the change-stream
**watcher** (`startSearchSync`). Other approaches are possible but worse:

- **Mongoose plugin** (pre-save hook) or a **driver wrapper** that intercepts writes:
  both can call `computeSearchFields` and merge the result before persisting. They
  work for full-document writes, but partial updates (`$set` of a single field) force
  a **racy read-modify-write**: you must re-read the current document, recompute the
  whole corpus, and write back — and there is no way to recompute server-side (no
  Unicode normalization in Mongo's engine), so two concurrent partial updates can
  clobber each other's derived fields.

The watcher sidesteps this: it always recomputes from the post-write `fullDocument`,
so it is correct regardless of how the write was shaped. Its only requirements are a
replica set and tolerance for the brief async-staleness window (see the watcher
trade-offs above).

## Live search (SSE)

The watcher's per-document `indexed` event is the foundation for a **live, push-based
search**: clients see the current matching set, then watch new matches arrive as
documents are indexed. This package ships a small, layered, transport-agnostic engine
plus thin adapters for Fastify, Express, and Next.js (App + Pages Router).

### The engine: `createLiveSearch`

`createLiveSearch` is framework-agnostic — it knows nothing about HTTP. Give it a
`SearchSync` (from `startSearchSync`), the collection/config, a Mongo `filter`, and a
`sendEvent` callback; it emits:

- `snapshot` — the current matching set (capped), sent once on start;
- `match` — one per newly-`indexed` document that matches `filter`;
- `capped` — sent once the emitted count reaches `cap` (default `500`), after which
  no further matches are pushed.

```ts
import { createLiveSearch } from '@quaesitor-textus/mongo'

const live = createLiveSearch({
  sync,                       // a SearchSync from startSearchSync
  collection,
  config,
  filter,                     // a Filter<Document>, e.g. from buildTextSearchFilter
  sort: { field: 'year', dir: 1 },   // optional; sorts the initial snapshot
  cap: 500,                   // optional; default 500
  sendEvent: (event) => { /* serialize + push to the client */ },
})
// ... when the client disconnects:
live.stop()
```

Internally it sends the snapshot (a sorted, capped `find`), then for each `indexed`
event runs a `findOne` match-test (`_id` AND `filter`) and emits a `match` only for
newly-matching, not-yet-seen documents.

### The wire helpers: `formatSse` / `sseComment`

These format the SSE wire bytes, independent of any framework:

```ts
import { formatSse, sseComment } from '@quaesitor-textus/mongo'

formatSse({ type: 'match', item }) // => `data: {"type":"match","item":{...}}\n\n`
sseComment()                       // => `: ping\n\n`  (a heartbeat comment)
```

### Fastify — `@quaesitor-textus/mongo/fastify`

`streamLiveSearch` is the transport glue for Fastify: it sets the SSE headers, hijacks
the reply socket, runs a heartbeat (`heartbeatMs`, default `25000`), wires
`createLiveSearch` to `reply.raw.write(formatSse(...))`, and tears everything down when
the request closes. It lives behind a subpath export; **fastify is an optional peer
dependency**, so you only pull it in if you use this adapter.

```ts
import { streamLiveSearch } from '@quaesitor-textus/mongo/fastify'

app.get('/api/live', (request, reply) => {
  const filter = buildTextSearchFilter('author', patterns, config)
  streamLiveSearch(request, reply, {
    sync,                  // a SearchSync shared across requests
    collection,
    config,
    filter,
    sort: { field: 'year', dir: 1 },  // optional
    cap: 500,                          // optional
    heartbeatMs: 25000,                // optional
  })
})
```

### Express — `@quaesitor-textus/mongo/express`

```ts
import { streamLiveSearch } from '@quaesitor-textus/mongo/express'

app.get('/api/live', (req, res) => {
  const filter = buildTextSearchFilter('author', patterns, config)
  streamLiveSearch(req, res, { sync, collection, config, filter })
})
```

### Next.js Pages Router — `@quaesitor-textus/mongo/next/pages`

```ts
import { streamLiveSearch } from '@quaesitor-textus/mongo/next/pages'

export default function handler(req, res) {
  streamLiveSearch(req, res, { sync, collection, config, filter })
}
export const config = { api: { responseLimit: false } } // allow long-lived SSE
```

### Next.js App Router — `@quaesitor-textus/mongo/next/app`

```ts
import { liveSearchResponse } from '@quaesitor-textus/mongo/next/app'

export async function GET(request: Request) {
  // parse the filter from request.url, build the Mongo filter, then:
  return liveSearchResponse({ sync, collection, config, filter })
}
```

**Dependency-free by design.** The Express and Next Pages adapters are typed against
Node's `http` `IncomingMessage`/`ServerResponse` (those frameworks' request/response
objects are subtypes), and the Next App adapter uses only the Web `Response`/`ReadableStream`
APIs. So **none of them import — or require you to install — `express` or `next`**; you
only need the framework you already use. Only the Fastify adapter imports its framework
(for `reply.hijack()`), as an optional peer dependency.

### Any other framework

`createLiveSearch` + `formatSse`/`sseComment` are the reusable core. Wiring them to any
runtime that exposes a writable response is a handful of lines (write the SSE headers,
push each `sendEvent` payload through `formatSse`, run a heartbeat with `sseComment`, call
`live.stop()` on disconnect) — exactly what the shared `runLiveSearch` helper does.

## Runnable companion

See [`packages/demo`](../demo) for a full-stack, runnable example: a Fastify + Vite /
React / antd book-search UI over MongoDB with server-side pagination, a year-range
predicate composed with text search, and a live watcher showcase (the "truckload"
button inserts raw documents and you watch them become searchable a moment later).
