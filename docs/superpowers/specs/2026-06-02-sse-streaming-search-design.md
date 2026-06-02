# SSE Streaming Live Search — Second Demo Example + Reusable Library Layer

This spec was written against the following baseline:

**Base revision:** `09deefae9e5a1233677b18ab9a08eafeccd6d7d4` on branch `main` (as of 2026-06-02T13:57:31Z)

## Summary

Add a **live streaming** search mode to the demo as a second example alongside the existing request/response one, and extract the generally-useful machinery into `@quaesitor-textus/mongo` as a **transport-agnostic live-search engine** plus a **thin Fastify SSE adapter**. Also add **sorting** (year/author/title, asc/desc) to both examples.

A user arms a search, presses the truckload button, and watches matching results *pour in* as the change-stream watcher indexes the newly inserted documents — no manual refresh. The library gains a reusable "server-side live search" capability mirroring the layering of `optio-api`'s SSE connectors (transport-agnostic core + per-framework adapters via subpath exports with optional peer deps), so the feature is turn-key for real apps while staying generic.

## Background

The demo currently does request/response search: build a predicate, fetch a paginated page. After a truckload the client must refetch to see new books (currently via a timed auto-refetch hack). The change-stream watcher (`startSearchSync`) already derives `_qt.*` search fields for raw-inserted documents asynchronously. This spec turns that watcher into the engine for a live, push-based search and presents it as a contrasting example.

The current spec/codebase has **no sorting**; this adds it to both examples.

## Goals & non-goals

**Goals:** reusable transport-agnostic live-search engine in the library; a Fastify SSE adapter (subpath export, optional peer dep); a second "streaming" demo example contrasting with the query example; sorting on both examples; pre-announced batch contents so the user can arm a search before a truckload.

**Non-goals (v1):** Express/Next adapters (deferred — the lower layers are reusable directly so they are trivial to add later); relevance sorting; server-side pagination of the live view; WebSocket transport.

## Architecture

Four layers in `@quaesitor-textus/mongo`, mirroring `optio-api` (transport-agnostic core → framework adapters):

1. **Watcher events (Layer 0).** Extend `startSearchSync` to return a small **emitter** (`.on`/`.off`/`.stop`) instead of a single `onEvent` callback, so multiple consumers can subscribe. Events: `indexing-started`, `indexing-finished` (count, durationMs — existing, for logging) plus a new per-doc **`indexed` ({ id })** fired *after* the derive write resolves (so a text filter on `_qt.*` matches when tested).

2. **Live-search engine (Layer 1) — transport-agnostic.** `createLiveSearch({ sync, collection, config, filter, sort?, cap, sendEvent }) → { stop }`:
   - emits a `snapshot` of current matches: `find(filter).sort(sort).limit(cap)`;
   - on each `indexed` event, tests `findOne({ $and: [{ _id }, filter] })` and emits a `match` for hits;
   - emits `capped` once the cap is reached.
   Event shapes: `{type:'snapshot', items}` | `{type:'match', item}` | `{type:'capped'}`. Knows nothing about HTTP. Match-testing reuses `buildTextSearchFilter` semantics via the same Mongo filter — no reimplemented matching.

3. **SSE encoder (Layer 2) — framework-agnostic.** `formatSse(event) → "data: <json>\n\n"` plus a heartbeat helper (`: ping\n\n` on an interval, default ~25 s, to survive proxies). Works with any `Writable`.

4. **Fastify adapter (Layer 3).** Subpath export `@quaesitor-textus/mongo/fastify`. Given a Fastify reply and the live-search inputs: set SSE headers, wire `sendEvent` to `reply.raw.write(formatSse(...))`, start `createLiveSearch`, register `request.raw.on('close', stop)` and clear the heartbeat. **Fastify is an optional peer dep.**

**Packaging:** subpath `exports` + `peerDependenciesMeta` optional, like `optio-api`:
```jsonc
"exports": {
  ".":       { "development": "./src/index.ts",          "import": "./dist/index.js",          "types": "./dist/index.d.ts" },
  "./fastify": { "development": "./src/adapters/fastify.ts", "import": "./dist/adapters/fastify.js", "types": "./dist/adapters/fastify.d.ts" }
},
"peerDependencies":     { "mongodb": ">=5", "fastify": "^4 || ^5" },
"peerDependenciesMeta": { "fastify": { "optional": true } }
```
tsup gains a second entry for the adapter.

## Demo layout & data flow

```
[ title ]
[ truck reception: button (pre-announces next batch's common author + sentinel) + message ]
[ search filters: author · title · AND/OR · year range · case-sensitive ]   <- common
[ sort selector: field (year|author|title) + asc/desc ]                     <- common, single source
[ Tabs ]
  "Query-based UI"     -> paginated table (server sort) + Refresh button
  "Streaming-based UI" -> live sorted list (client sort) + running total
```

- `WithSearch` providers and the predicate + sort state live in the **common** section; the sort selector is the single source of truth, channeled to server `.sort()` (Tab 1) and client-side sorted insertion (Tab 2).
- **Active-tab gating:** only the visible tab consumes the shared predicate. Tab 1 active → query fetch on predicate/sort/page change (no SSE). Tab 2 active → open one `EventSource` for predicate+sort, **closed on tab-switch-away or predicate change** (reopened fresh). Inactive tab does nothing.
- Tab 1 is manual (a **Refresh** button) — the pedagogical contrast with Tab 2's live updates. The earlier timed auto-refetch hack is **removed** in favor of the Refresh button.

**Live view rules:**
- **Empty-search guard:** streams only when ≥1 text pattern is present (author or title). Empty → prompt + static total count, no `EventSource` opened. Year-only does not enable streaming.
- **No pagination:** one live sorted list; rows slot into sort position as they arrive; running total shown.
- **Cap:** initial snapshot and live set capped at **500**; then a `capped` event → "showing first 500".

## Server endpoints (demo)

- `GET /api/books?filter&page&pageSize&sort&dir` — add `sort`/`dir` → `.sort({ [sort]: dir })`.
- `GET /api/live?filter&sort&dir` — SSE via the Fastify adapter. When the filter has no text pattern, send an `idle` event (or 400). Streams `snapshot` → `match`… → `capped`.
- `GET /api/next-truck` — returns the next batch's `{ batch, commonAuthor, sentinelAuthor }`, computed from the current document count, so the button can pre-announce before the user presses it.

## Generator change

In `packages/demo/src/shared/generator.ts`:
- Inject a **unique sentinel per truck batch** `k` (indices `[1000k, 1000k+1000)`): place `SENTINELS[k-1]` at index `1000k+500`. `SENTINELS` is ≥9 distinctive diacritic authors; `Miguel Ángel Asturias` = `SENTINELS[0]`.
- Expose `batchSentinel(batch)` and `batchCommonAuthor(batch)` (a fixed pool author, ~67 occurrences/batch) for deterministic pre-announcement by `/api/next-truck` and the button.

## Error handling

- Live filter with no text pattern → `idle` event (no stream), client shows the prompt; client never opens `EventSource` in that state anyway.
- Client disconnect → adapter calls `stop()` (removes the `indexed` listener, clears heartbeat).
- `createLiveSearch` `findOne` errors are caught per-event and skipped (one bad match-test must not tear down the stream); the heartbeat keeps the connection alive when idle.
- Cap reached → `capped` event; further matches are not pushed.

## Testing

- **Library unit/integration:** `createLiveSearch` against a live Mongo using the existing parity harness (snapshot returns current matches; a post-insert+derive emits a `match`; cap emits `capped`). `formatSse` is pure → straightforward unit tests. Watcher emitter emits `indexed` after the derive write.
- **Demo end-to-end (manual, against the running stack):**
  1. `make mongo-up && make seed`, `make run-backend`, `make run-frontend`.
  2. Query tab: search `zola`, sort by year — server-sorted, paginated. Truckload → unchanged until **Refresh** → new books appear.
  3. Stream tab: read the button's pre-announced common author + sentinel; arm `author = <common author>`; switch to Stream tab (SSE opens); press truckload → ~67 rows pour in live in sort order; the unique sentinel appears as a single hit. Backend logs `indexing started/finished`.
  4. Empty search on Stream tab → prompt + count, no SSE connection.
  5. Broad search → streams at most 500 then "showing first 500".

## Files

**Library (`packages/mongo`):** modify `src/startSearchSync.ts` (emitter + `indexed` event), `src/index.ts` (exports), `package.json` (subpath export + fastify optional peer dep), `tsup.config.ts` (2nd entry); create `src/createLiveSearch.ts`, `src/sse.ts`, `src/adapters/fastify.ts`, plus tests for `createLiveSearch` and `sse`. Update `README.md` (live-search section).

**Demo (`packages/demo`):** modify `src/server/index.ts` (`sort` on `/api/books`, `/api/live`, `/api/next-truck`), `src/shared/generator.ts` (per-batch sentinels + helpers), `src/client/api.ts` (sort params, `nextTruck()`, EventSource helper), `src/client/App.tsx` (restructure: common section + `Tabs`, lift filters/sort, active-tab gating, remove timed refetch); create `src/client/QueryTab.tsx` (table + server sort + refresh + pagination) and `src/client/StreamTab.tsx` (EventSource subscription + client-sorted live list). Update `README.md` (two-example walkthrough).
