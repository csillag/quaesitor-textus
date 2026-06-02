# @quaesitor-textus/demo

A full-stack showcase of **server-side** text search with
[`@quaesitor-textus/mongo`](../mongo). It runs the same diacritic- and
case-insensitive substring matching you get on the client, but against a
MongoDB collection — index-backed, paginated, and with **zero server-side
JavaScript** in the query path.

## What the demo shows

- **Server-side search over a book collection.** Type into the author and/or
  title boxes and the matching books are fetched from a Fastify API that
  queries MongoDB. Matching is diacritic-insensitive and case-insensitive by
  default (so `garcia` matches `García`), with an optional **case-sensitive**
  checkbox per input.
- **Predicate composition.** Author and title text searches are combined with
  an **AND/OR** toggle and intersected with a **year-range** slider, all
  expressed as a small in-tree predicate language and translated to a single
  MongoDB filter server-side.
- **Server-side pagination.** Only one page of results crosses the wire; the
  total count comes from the server.
- **A live change-stream watcher.** The **"Receive a truckload of new books"**
  button inserts 1000 raw books (no derived search fields). A
  `startSearchSync` change-stream watcher computes and backfills the search
  fields a moment later — demonstrating that newly inserted documents become
  searchable automatically, without the writer having to compute anything.

## Two examples

The shared search controls (author/title inputs with per-input case-sensitive
toggles, the AND/OR mode switch, the year-range slider, and the sort
field/direction selectors) sit above two tabs that consume the **same**
predicate and sort, but render it two different ways:

- **Query-based UI.** A classic request/response table: each predicate/sort/page
  change issues a `GET /api/books?…&sort&dir` and renders one server-sorted,
  server-paginated page. The total match count comes from the server, and a
  manual **Refresh** button re-runs the current query (handy after a truckload
  to pull in newly-indexed matches).
- **Streaming-based UI.** A push-based live list backed by **Server-Sent
  Events** (`GET /api/live?…&sort&dir`, consumed via `EventSource`). The server
  first sends a `snapshot` of current matches, then one `match` event per
  newly-indexed document that matches the filter, so rows **pour in live** as a
  truckload is indexed — no refresh needed. Sorting is applied client-side over
  the accumulated list (the connection re-opens only when the predicate
  changes). The list is capped at **500** results (`capped` event → "showing
  first 500"). With **no text pattern** the tab does not stream; it shows a
  prompt plus the total book count for context.

Only the active tab is mounted (`destroyInactiveTabPane`), so switching tabs
tears down the inactive tab's fetch or `EventSource` connection.

## Walkthrough: watch results pour in

This is the headline behavior to try by hand:

1. Read the hint under the **"Receive a truckload of new books"** button. It
   pre-announces the **next** truck's **common author** (a pool author that
   recurs frequently, ~67 books in the batch) and its unique **sentinel author**
   (one distinctive diacritic author that exists *only* in that batch, e.g.
   `Miguel Ángel Asturias`).
2. Arm the search: type the pre-announced common author (or the sentinel) into
   the **author** box.
3. Switch to the **Streaming-based UI** tab. With the search armed it opens a
   live SSE connection and shows the current matches (likely 0 for a sentinel
   not yet delivered).
4. Press **"Receive a truckload of new books (1000)"**. The batch is inserted
   *raw* (no derived search fields); the `startSearchSync` watcher derives them
   in the background and emits a per-document `indexed` event as each write
   lands.
5. Watch the rows **pour into the list live** — many hits for the common author,
   plus the single sentinel hit — without pressing anything. The backend logs
   `search-sync: indexing started` / `… finished` as the batch is processed.

Compare with the **Query-based UI** tab, where the same truckload only shows up
after you press **Refresh** (request/response, not push).

(Because the watcher runs asynchronously, read-your-writes on the text search is
not guaranteed immediately after the insert — the streaming rows appear as each
document is indexed.)

## Prerequisites

- **Docker** (for the single-node replica-set MongoDB) with Docker Compose.
- **pnpm** (the repo uses pnpm workspaces).
- Node 18+.

## Quickstart

All commands are run from `packages/demo`.

```bash
# 1. Install all workspace dependencies (from the repo root, via the Makefile)
make install

# 2. Start a single-node replica-set MongoDB on :27018 (waits until ready)
make mongo-up

# 3. Seed the first 1000 books and create the search indexes
make seed

# 4. In one terminal: run the Fastify API (port 3001)
make run-backend

# 5. In another terminal: run the Vite dev server (proxies /api -> backend)
make run-frontend
```

Then open <http://localhost:5173>.

> A replica set is required because the watcher tails a MongoDB **change
> stream**, which is only available on replica sets. The compose file runs a
> single-node replica set and initializes it idempotently via its healthcheck.

## All Make targets

Run `make help` to list every target:

```bash
make help
```

| Target | What it does |
|---|---|
| `make install` | Install all workspace dependencies |
| `make build` | Build the client bundle |
| `make run-backend` | Run the Fastify API (dev, cross-package HMR) |
| `make run-frontend` | Run the Vite dev server (proxies `/api` -> backend) |
| `make mongo-up` | Start single-node replica-set MongoDB on `:27018` |
| `make mongo-down` | Stop MongoDB |
| `make seed` | Seed the first 1000 books + create indexes |
| `make clean` | Remove build artifacts, `node_modules`, caches |
