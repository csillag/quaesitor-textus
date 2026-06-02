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

## Verifying the live watcher

This is the headline behavior to try by hand:

1. In the **author** box, type `garcia`. You should see **0 matching books**
   — the seed set (the first 1000 books) does not contain
   `Gabriel García Márquez`.
2. Click **"Receive a truckload of new books (1000)"**. This inserts the next
   batch of books *raw*, with no derived search fields.
3. Wait a moment. The change-stream watcher computes the search fields for the
   freshly inserted documents in the background.
4. Re-trigger the `garcia` search (e.g. retype it). Now **García Márquez**
   appears in the results — proving the watcher made the new documents
   searchable without the insert path computing anything itself.

(Because the watcher runs asynchronously, read-your-writes on the text search
is not guaranteed immediately after the insert — hence the brief wait.)

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
