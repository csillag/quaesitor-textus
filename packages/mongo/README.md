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

## Runnable companion

See [`packages/demo`](../demo) for a full-stack, runnable example: a Fastify + Vite /
React / antd book-search UI over MongoDB with server-side pagination, a year-range
predicate composed with text search, and a live watcher showcase (the "truckload"
button inserts raw documents and you watch them become searchable a moment later).
