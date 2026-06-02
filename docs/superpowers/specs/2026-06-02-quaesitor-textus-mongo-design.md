# @quaesitor-textus/mongo — Server-Side Search Companion + Demo

This spec was written against the following baseline:

**Base revision:** `2ed478c5f5a3355b50b12ff0de0d97d57f63e11a` on branch `main` (as of 2026-06-02T12:49:10Z)

## Summary

Add a new package `@quaesitor-textus/mongo` to the monorepo: the server-side
companion to the existing client-side search packages. It translates a
quaesitor-textus search configuration (field paths + patterns + options) into a
**MongoDB query filter** that reproduces the library's client-side matching
behaviour *exactly* — diacritic- and case-insensitive substring matching — while
remaining **index-backed and performant**, supporting **DB-side pagination and
count**.

A second new package, `packages/demo`, is a minimal full-stack showcase
(Fastify + Vite/React/antd) that does book search entirely server-side over a
synthesized dataset, and doubles as the head-to-toe documentation.

This spec also defines small **additions to `@quaesitor-textus/core`** that both
the client and the new server package share, to avoid duplicating matching logic.

## Background: the matching semantics to reproduce

The client filters with `matchItem(corpus, patterns, options)`:

- **Tokenize** (`parseInput`): split query on spaces, dedup, keep all fragments
  iff at least one reaches `minLength` (default `2`).
- **Normalize** (`normalizeText`): NFD-decompose + strip combining marks
  (diacritic-insensitive) then lowercase (case-insensitive). Each toggleable via
  `SearchOptions { caseSensitive?, diacriticSensitive?, minLength? }`.
- **Match**: every pattern must be a **substring** (`indexOf`) of the normalized
  corpus (AND across patterns).
- **Corpus** for a search entry is built from its `fields` (dot-paths) via
  `getByPath` + `harvestStrings` (recursive deep-harvest of nested
  objects/arrays), each joined with a space, empties filtered, joined.

`SearchEntry` already carries `fields: string[]`, `patterns`, `options` — so the
"field paths are available server-side" prerequisite is **already satisfied** by
the current codebase.

## The core difficulty and why naïve approaches fail

MongoDB has **no native diacritic-insensitive substring match**:

- `$regex` is binary; collation is **not** applied to `$regex`.
- Collation `strength:1` (case/diacritic-insensitive) applies only to
  equality/range/sort — gives prefix/exact, not arbitrary substring.
- `$text` indexes match whole words/stems, not arbitrary substrings.
- Arbitrary substring is inherently **not B-tree-indexable**.
- **MongoDB's embedded server-side JS engine lacks `String.prototype.normalize`**
  (verified on `mongo:7`: `$function` runs, but `typeof s.normalize ===
  'undefined'`). So the obvious `$function`-with-`normalize('NFD')` approach
  (and any server-side recompute/verify that needs NFD) is **impossible**.

**Conclusion:** all Unicode normalization must happen in **Node** (where
`normalize` exists), at write time. The server only ever does byte-level matching
on pre-folded data. **No server-side JS is used anywhere in this design.**

## Approach: n-gram index + pre-folded verify strings

### Stored derived fields (computed at ingest, in Node)

For each configured **search target** `t`, store under a namespace (default
`_qt`):

- `_qt.<t>.ngrams` — array of **bigrams + trigrams** of the **coarsest-folded**
  corpus. **Multikey-indexed.** This is the index-backed pre-filter.
- `_qt.<t>.<mode>` — one **verify string** per supported query mode: the corpus
  folded for that mode. The base/coarsest mode (default fully-folded) is always
  present; additional modes (e.g. case-sensitive) add one string each.

Original document fields are left untouched.

### Why this is correct and fast for *all* option modes

Normalization is information-losing **folding**; the coarsest fold (fully folded)
yields the largest match set. Any stricter query mode (case-sensitive,
diacritic-sensitive) is a **subset**. Therefore:

- The n-gram pre-filter always runs on the **single coarsest-fold index**,
  queried with the pattern folded to coarsest → returns a **superset** of the
  true answer. **One index serves every mode** (no per-mode index).
- **Verify** removes both n-gram false positives (non-contiguous n-grams) *and*
  enforces the query mode, by `$regex`-matching the appropriately-folded pattern
  against the verify string for that mode. Pure operators, **no JS**, runs
  DB-side → `$skip`/`$limit`/`countDocuments` all work on the correct set.

### Why bigrams + trigrams

`minLength` default is `2`, and 2-char searches are a real requirement (e.g. a
two-character surname). Trigrams cannot index a 2-char pattern. So:

- 2-char pattern → its single **bigram**.
- ≥3-char pattern → its **trigrams** (more selective).

Both n-gram sizes live in the one `ngrams` array; the query picks per pattern.
A query of multiple patterns ANDs all their n-grams in one `$all`.

### Query construction (per target, per pattern set)

```
{ $and: [
    { "_qt.<t>.ngrams": { $all: [ ...coarsest-folded n-grams of all patterns ] } },
    { "_qt.<t>.<mode>": { $regex: <escaped, mode-folded verify regex over patterns> } }
] }
```

- Patterns are **regex-escaped** before being placed in `$regex` (injection
  safety; a pattern `".*"` must match literally).
- All patterns AND (client parity). Empty patterns → the target contributes
  nothing (matches everything).

## Core additions (`@quaesitor-textus/core`)

Both are zero-dependency logic, exported from core:

1. **`toNgrams(text: string, sizes: number[] = [2, 3]): string[]`** — n-gram
   generator (deduped).
2. **`buildCorpus(item: unknown, fields: string[]): string`** — extracted from
   the currently-inlined logic in `useFilterFunction.ts:18-20`
   (`fields.map(f => harvestStrings(getByPath(item, f)).join(' ')).filter(Boolean).join(' ')`).
   `useFilterFunction` is refactored to call it. Client behaviour is unchanged;
   ingest reuses the identical corpus construction. This is the DRY guarantee
   that client and server build the same corpus.

## `@quaesitor-textus/mongo` package

Server-side Node package. `dependencies`: `@quaesitor-textus/core` (workspace).
`peerDependencies`: `mongodb` (types only; the package returns plain filter
objects and is driver-agnostic — works with the native driver or mongoose).

### Configuration — single source of truth

```ts
import type { SearchOptions } from '@quaesitor-textus/core'

interface MongoSearchTarget {
  fields: string[]               // dot-paths; core getByPath + harvestStrings semantics
  options?: SearchOptions        // base/coarsest fold (drives the n-gram index)
  queryModes?: SearchOptions[]   // extra runtime-selectable modes → one verify string each
}

interface MongoSearchConfig {
  namespace?: string                          // derived-field prefix, default "_qt"
  ngramSizes?: number[]                        // default [2, 3]
  targets: Record<string, MongoSearchTarget>
}
```

The **same config** drives ingest, index creation, and query building — they
cannot drift.

- No `queryModes` → one verify string (the base fold).
- `queryModes: [{ caseSensitive: true }]` → +1 verify string; a runtime
  case-sensitive toggle works.
- The n-gram index is built on the **coarsest** fold among the base options and
  all `queryModes`, and is always queried with coarsest-folded patterns.

### Public API

```ts
// Ingest — compute derived fields for one document (merge into the doc on write).
function computeSearchFields(doc: unknown, config: MongoSearchConfig): Record<string, unknown>
//   → { [namespace]: { [target]: { ngrams: string[], [mode]: string, ... } } }

// Index — one multikey index per target's ngrams field.
function searchIndexSpecs(config: MongoSearchConfig): Array<{ key: Record<string, 1>; name: string }>
function createSearchIndexes(collection: Collection, config: MongoSearchConfig): Promise<void>

// Query — build a Mongo filter fragment for one target.
function buildTextSearchFilter(
  target: string,
  patterns: string[],
  config: MongoSearchConfig,
  options?: SearchOptions,   // selects which query mode / verify string; defaults to target base
): Filter<Document>

// Maintenance — change-stream watcher that keeps derived fields in sync.
function startSearchSync(
  collection: Collection,
  config: MongoSearchConfig,
): { stop: () => Promise<void> }
```

`buildTextSearchFilter` returns a **plain Mongo fragment**, so a host predicate
language composes it with `$and`/`$or`/`$nor` at any depth.

### Maintenance: change-stream watcher

Because derived fields can only be computed in Node, and write modalities
(insert/update/upsert/`$set`/bulk) are open-ended, v1 ships a **change-stream
watcher** (`startSearchSync`) as the maintenance mechanism:

- Tails the collection change stream with `fullDocument: 'updateLookup'`.
- On any change, recomputes derived fields **in Node** from the resulting
  document and writes them back.
- **Modality-agnostic** — reacts to resulting document state, so it handles every
  write form (present and future) through one path. Bypass-proof as a bonus.
- **Trade-offs (documented):** requires a **replica set** (single-node RS is fine
  and standard with the stock `mongo:7` image), and is **eventually consistent** —
  a brief async window where a just-written doc is not yet searchable. This is
  acceptable here: read-your-writes flows in consuming apps key off id/metadata
  tags, not text fragments.

The Mongoose-plugin and driver-wrapper options were considered and rejected for
v1: they require racy read-modify-write for partial `$set` updates (no server-side
recompute is possible) and must enumerate every write method. The watcher avoids
both problems. The README documents these alternatives for users who need
synchronous read-your-writes on text.

## Integration seam (host predicate languages, e.g. optio)

This package owns **no wire format**. A host application nests text search as a
node inside its own predicate tree and delegates to `buildTextSearchFilter`.
Concretely (host-side work, not built here): add a `{ TEXT: { target, patterns,
options? } }` node to the host's predicate union and a translator branch that
calls `buildTextSearchFilter`. `target` is validated against the config's target
keys (it is not a document field path). Patterns are carried **pre-tokenized**
(the client tokenizes once via core `parseInput` and sends the array verbatim) so
the client's highlight patterns and the server's filter patterns are identical
regardless of where search executes.

This composition (text search as a first-class, OR-able / NOT-able / nestable
predicate node) is the headline capability — it lets text search plug into
arbitrarily complex filters.

## `packages/demo` — full-stack showcase

A private (unpublished) package that demonstrates the whole stack end-to-end and
serves as living documentation. It mirrors the existing core/antd "BookSearch"
story (two inputs for author + title, AND/OR mode) but performs **all** search
**server-side with pagination**.

### Layout

```
packages/demo/
  Makefile
  docker-compose.yml          # single-node RS mongo:7 on :27018
  src/shared/                 # MongoSearchConfig (author + title targets),
                              #   deterministic book generator, demo predicate types
  src/server/                 # Fastify: GET /api/books, POST /api/truckload,
                              #   boots startSearchSync watcher
  src/client/                 # Vite + React + antd UI
```

### Data model & dataset

- Book = `{ author, title, year }` (same shape as the existing sample).
- **Deterministic** generation via a fixed-seed PRNG (e.g. mulberry32) — every
  run produces byte-identical data; no `Math.random`/`Date.now` nondeterminism.
- **Total 10,000 books** generated; the existing 499 real classics are included,
  padded with generated books.
- **Author pool is diacritic-rich** (García Márquez, Saint-Exupéry, Émile Zola,
  Søren Kierkegaard, Brontë, Čapek, …) so the diacritic-insensitive feature is
  obvious (`garcia` finds `García`). Includes **at least one 2-char surname** to
  exercise the bigram path.
- **Years spread** across a wide range so the year-range filter is meaningful.
- Each generated book has a **deterministic `_id`** derived from its index (so
  re-inserts are dup-key no-ops).

### Targets / config

```ts
targets: {
  author: { fields: ['author'], queryModes: [{ caseSensitive: true }] },
  title:  { fields: ['title'],  queryModes: [{ caseSensitive: true }] },
}
```

(Each target therefore stores: a coarsest-fold `ngrams` array, a base
fully-folded verify string, and a case-preserved verify string.)

### Seed / truckload split (watcher showcase)

- `seed` inserts only the **first 1,000** books **with** derived fields (batch
  `computeSearchFields`) and creates the indexes.
- The remaining **9,000** are generated but **not** inserted at seed time.
- A **"Receive a truckload of new books"** button → `POST /api/truckload` inserts
  the **next 1,000** **raw** (no derived fields) via the driver. Stateless
  batching: the server reads the current doc count `n` and inserts the generator
  slice `[n, n+1000)` with `{ ordered: false }` (dup-key no-ops on re-click).
  Multi-click until 10,000, then the button disables / shows "all delivered".
- The running `startSearchSync` **watcher** computes derived fields for the raw
  inserts → they become searchable shortly after.
- A **distinctive diacritic-heavy author** (e.g. `García Márquez`) is placed
  **exclusively in the first truck batch (indices 1000–1999)** so searching
  `garcia` returns nothing before the first truckload and hits after —
  directly verifying the watcher worked.
- Live visibility into the async window (count rising) is a nice-to-have, not
  required.

### Demo query model — predicate tree with text + scalar

The demo defines its **own minimal generic predicate language** (it does not
assume any external app's syntax; this also serves as the README's "reasonable
generic predicate" example):

- Leaves: `TEXT(target, patterns, options?)` and a scalar `year` range
  (`gte`/`lte`).
- Combinators: `AND`, `OR`.

The UI builds, e.g. `AND( OR(TEXT('author', pa), TEXT('title', pt)), year≥X, year≤Y )`.
The server translator maps `TEXT` nodes via `buildTextSearchFilter`, the year
leaf to plain Mongo range operators, and `AND`/`OR` to `$and`/`$or`. This
demonstrates text search **composed with a non-text predicate** in one tree,
server-side — the "plug into complex searches" capability.

### Server

- `GET /api/books?filter=<JSON predicate>&page=&pageSize=` → translate predicate
  → `find(filter).skip().limit()` for the page + `countDocuments(filter)` for the
  total → `{ items, total, page, pageSize }`.
- `POST /api/truckload` → next-batch insert as above.
- Boots `startSearchSync(collection, config)` on startup.

### Client (Vite + React + antd)

- Reuses core `SearchInput` (or antd wrapper) + `HighlightedText` + `WithSearch`,
  and antd `Table` with **server-side pagination** (`pagination={{ total,
  current, pageSize, onChange }}`, refetch on change).
- Two search inputs (author, title), an AND/OR control, a **year-range** slider,
  a **per-input "case sensitive" checkbox** (sets the `TEXT` node's `options`),
  and the truckload button.
- The client tokenizes via core `parseInput` → patterns into the predicate, and
  highlights results with the **same** patterns via `HighlightedText`. Only the
  *filter* moves server-side; matching is visibly identical.

### Local development — cross-package HMR

The demo consumes core/antd/mongo via `workspace:*`. To get instant cross-package
HMR (no rebuild hop), add a **`development` exports condition** to each library
pointing at TypeScript source:

```jsonc
"exports": { ".": {
  "types":       "./dist/index.d.ts",
  "development": "./src/index.ts",   // dev-only, additive, safe
  "import":      "./dist/index.js",
  "require":     "./dist/index.cjs"
}}
```

- **Client** — Vite `resolve.conditions: ['development']` resolves the libs to
  source → editing core/antd `src` HMRs instantly.
- **Server** — `tsx watch --conditions=development` (Node honours `--conditions`;
  tsx transpiles TS live) → editing mongo/core `src` reloads instantly.

The condition is additive and never affects published consumers (they don't pass
`development`; `files` already ships `src`).

### Makefile (`packages/demo/Makefile`)

Self-documenting; `help` is the default goal (generated from `##` target
comments).

| Target | Action |
|---|---|
| `help` | (default) list and explain all targets |
| `install` | workspace-aware dependency install (`pnpm install`) |
| `build` | build client (`vite build`) + server |
| `run-backend` | Fastify dev (`tsx watch --conditions=development`, boots watcher) |
| `run-frontend` | Vite dev server (proxies `/api` → backend) |
| `mongo-up` | start single-node RS `mongo:7` on `:27018` (docker compose, auto `rs.initiate()`) |
| `mongo-down` | stop mongo |
| `seed` | generate + insert first 1,000 books + create indexes |
| `clean` | remove build artifacts, `node_modules`, caches |

From-scratch run: `make install mongo-up seed`, then `make run-backend` and
`make run-frontend` in two terminals.

## Documentation (`@quaesitor-textus/mongo` README)

Head-to-toe, turnkey:

1. **Mongo setup** — convert to single-node replica set; create the n-gram
   indexes.
2. **Server wiring** — define `MongoSearchConfig`; run `startSearchSync`;
   translate text-search nodes via `buildTextSearchFilter`.
3. **Client usage** — three escalating examples: naive single-field; two-field
   (author + title); and as a node in a predicate tree, shown with a *reasonable
   generic* predicate example with the explicit caveat that the package does not
   own or assume the consumer's filter syntax.

The `packages/demo` app is the executable companion to this README.

## Testing

- **Core**: unit tests for `toNgrams` and `buildCorpus`; `useFilterFunction`
  regression (behaviour unchanged after extraction).
- **Mongo package**: `computeSearchFields`, `searchIndexSpecs`,
  `buildTextSearchFilter` (escaping, n-gram selection per pattern length,
  per-mode verify-string selection), and `startSearchSync` against the `mongo:7`
  replica set.
- **Parity tests (the key guarantee)**: for a corpus + pattern set, the set
  matched by core `matchItem` (client) must equal the set returned by a real
  Mongo query built from `buildTextSearchFilter` — across diacritics, case,
  multi-pattern AND, multi-field corpora, 2-char patterns, and each declared
  query mode.

## Scope / non-goals

- No server-side JavaScript anywhere.
- No Atlas Search dependency (stock self-hosted Mongo).
- The package ships no client code; the client uses existing core.
- The package owns no wire format; host predicate-language integration (e.g.
  optio's `TEXT` node) is the host's work — only the seam is specified here.
- Mongoose-plugin / driver-wrapper maintenance mechanisms are documented but not
  shipped in v1 (change-stream watcher is the shipped mechanism).
```
