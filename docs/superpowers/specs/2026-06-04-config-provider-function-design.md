# Config Provider Function for `startSearchSync`

This spec was written against the following baseline:

**Base revision:** `c310c4cbf8dc2bc2f026a9273cc9d643de7b1066` on branch `main` (as of 2026-06-04T11:45:45Z)

## Context

This is **P0** of the excavator "entity-data live search" effort (umbrella spec:
`~/deai/excavator/docs/superpowers/specs/2026-06-02-entity-data-live-search-architecture.md`).
That feature indexes **unstructured** Mongo collections whose searchable-field
set is not known up front and evolves over time. The indexer needs to (re)compute
its `MongoSearchConfig` from the live data and have the watcher pick up a grown
field set without a restart.

Today `startSearchSync(collection, config, options)` takes a **static**
`MongoSearchConfig` and runs `runBackfill` once on start. That can't express a
config that changes after startup.

## Goal

Let `startSearchSync` accept a **config provider function** in addition to a
static config. When given a function, the watcher re-invokes it on its own idle
cadence and re-backfills when the resolved config's version changes — so an
evolving field set is picked up automatically.

**Hard constraint (the library ships a demo and is used by simple apps): the
static-config path must stay byte-identical in behavior, and no awkward new
ceremony may be added.** The only new surface is "config may also be a function."
No new method on the `SearchSync` handle.

## Non-goals / out of scope

- The **adaptive reindex throttle** and the **field-determination sampling** live
  in the *caller's* provider (excavator P4), not in the library. The library
  never samples and never throttles.
- The **cross-process live-search adapter** (driving `createLiveSearch` off a
  change stream when the watcher runs in another process) is excavator/P5 — no
  library change, `createLiveSearch` already takes a `SearchSync`-shaped `{on,off}`.
- **Per-field `_qt` versioning** (re-derive only the added field) — deferred.

## API change

`startSearchSync`'s second parameter widens from `MongoSearchConfig` to a
`ConfigSource`:

```ts
export type MongoSearchConfigProvider =
  () => MongoSearchConfig | Promise<MongoSearchConfig>
export type ConfigSource = MongoSearchConfig | MongoSearchConfigProvider
```

(Export both new types from `index.ts`.) A value is treated exactly as today; a
function is the provider. No other public signature changes; no new method on the
returned `SearchSync`.

## Behavior

The watcher holds a mutable **current config** plus its **current version**
(`searchFieldsVersion(currentConfig)`).

**Resolution helper:** `resolve(source)` returns the config — the value itself, or
`await source()` if it's a function.

**On start:**
1. `current = await resolve(source)`.
2. If `source` is a **function**, ensure indexes for `current`
   (`createSearchIndexes(collection, current)` — idempotent). For a **static
   value**, do **not** call `createSearchIndexes` (preserve today's behavior;
   the consumer already calls it, as the demo does).
3. Open the change stream (as today). The `change` handler derives with
   `current` (read each event).
4. If `backfill`, run the initial `runBackfill(current)` (as today).

**On each idle flush** (the existing `idleTimer` fire that today only emits
`indexing-finished`):
1. If `source` is **not** a function → do nothing new (static path: behavior
   identical to today).
2. Else `next = await resolve(source)`; `nextVersion = searchFieldsVersion(next)`.
3. If `nextVersion === currentVersion` → no-op (provider returned an equivalent
   config; the common case while data shape is stable).
4. Else: swap `current = next`; ensure indexes for `next`; run `runBackfill(next)`
   (which re-derives docs whose `_qt._v !== nextVersion`, i.e. everything, so the
   grown/changed field set lands on existing rows).

**Serialization guard:** at most one backfill at a time, and no provider
re-evaluation while a backfill is in flight. A simple `reindexing` flag: if set
when an idle flush fires, skip this round (the next flush re-checks). The
re-backfill itself produces `_qt` writes → change events → another burst → another
idle flush; by then the provider returns the same version → no further backfill
(converges). The existing loop-guard (`JSON.stringify(doc[ns]) === derived[ns]`)
already prevents re-processing our own echo writes.

**Config swap atomicity:** `current` is swapped synchronously between awaits so an
in-flight `change` handler uses a consistent config object (it captures `current`
at event time).

## Why this stays clean for simple apps

- A static value triggers **none** of the re-invoke / re-backfill / index-ensuring
  logic. The demo passes `demoConfig` (a value) and behaves exactly as before:
  one backfill at start, version changes only on a library upgrade, indexes
  created by its own `createSearchIndexes` call.
- The provider path adds **no** method or required lifecycle step; the repetition
  is internal, on the watcher's existing idle cadence.
- Provider cost is the provider's concern: the library calls it once per idle
  burst; an expensive provider caches/self-throttles and returns the same version
  cheaply (→ no re-backfill). The library gains no throttle knob.

## Testing (vitest)

Follow the existing `startSearchSync.test.ts` harness exactly: connect to a real
RS-enabled Mongo via `MONGO_URL` (default `mongodb://localhost:27018/?directConnection=true`)
in `beforeAll`, and **skip gracefully when unavailable** (`let available`; each
test early-returns if `!available`) — change streams require a replica set. That
file already seeds a `_v:'old:0'` stale doc and asserts re-derivation; mirror its
style. Add:

1. **Provider called at start.** Pass a provider returning config C1; assert docs
   are derived with C1 (a known field has `_qt`).
2. **Grown config → re-backfill on idle.** Provider returns C1, then (after first
   burst) C2 with an added target. Write a doc (triggers a burst → idle). Assert
   the pre-existing docs gain `_qt` for the new target (version mismatch
   re-derive) and indexes for the new target exist.
3. **Stable config → no re-backfill.** Provider always returns C1. After a burst,
   assert no extra re-derivation (e.g. spy that `runBackfill` runs only once / a
   derive-count stays put).
4. **Static value unchanged.** Passing a `MongoSearchConfig` value behaves as the
   current tests expect; the existing suite must pass untouched, and assert the
   library does **not** call `createSearchIndexes` on the static path.
5. **Index creation on reconfig.** After a grown-config reindex, the new target's
   ngram index (`searchIndexSpecs`) is present.
6. **No overlapping backfill.** Rapid idle flushes during a long backfill do not
   start a second concurrent backfill (assert via the `reindexing` guard — e.g.
   provider invocation is skipped while reindexing).

## Docs

Update `packages/mongo/README.md` to document the provider-function option with a
short dynamic-config example. **Do not change the demo** — it stays on static
config as the canonical "simple app" usage.

## Release

Patch/minor bump of `@quaesitor-textus/mongo` (additive, backward compatible).
Excavator's P4 worker consumes the bumped version.
