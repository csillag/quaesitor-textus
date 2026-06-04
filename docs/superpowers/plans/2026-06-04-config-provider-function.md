# Config Provider Function for `startSearchSync` — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let `startSearchSync` accept a config **provider function** (re-invoked on each idle flush, re-backfilling when the resolved config's `searchFieldsVersion` changes), while keeping the static-config path byte-identical for existing/simple consumers (the demo).

**Architecture:** Widen the 2nd parameter from `MongoSearchConfig` to `ConfigSource = MongoSearchConfig | (() => MongoSearchConfig | Promise<MongoSearchConfig>)`. A fixed value resolves once and behaves exactly as today. A provider is resolved in an async bootstrap, re-invoked on the watcher's existing idle timer, and a version change triggers index-ensuring + `runBackfill`. No new method on the `SearchSync` handle; all throttling/sampling stays in the caller's provider.

**Tech Stack:** TypeScript ESM, MongoDB Node driver, vitest, tsup, pnpm workspace.

**Spec:** `docs/superpowers/specs/2026-06-04-config-provider-function-design.md`

---

## File structure

- `packages/mongo/src/startSearchSync.ts` — the change (provider support, bootstrap, idle reconfigure, parameterized `runBackfill`).
- `packages/mongo/src/index.ts` — export the two new types.
- `packages/mongo/src/startSearchSync.test.ts` — new provider tests (appended).
- `packages/mongo/README.md` — document the provider option.

## Execution shape

P0 is a single cohesive change centered on one file; it is **not** split into parallel agents. **Task 1** makes all the edits (no test-run, no commit). **Task 2** is the serial verify+commit phase: it stands up an RS Mongo, runs the suite + build, fixes any breakage, and commits.

---

## Task 1: Implement the provider-function support

**Files:**
- Replace: `packages/mongo/src/startSearchSync.ts`
- Modify: `packages/mongo/src/index.ts`
- Modify: `packages/mongo/src/startSearchSync.test.ts`
- Modify: `packages/mongo/README.md`

- [ ] **Step 1: Append the failing provider tests** to `packages/mongo/src/startSearchSync.test.ts`

Add this block at the end of the file (it reuses the file's existing `client` / `available` from `beforeAll`):

```ts
import { searchFieldsVersion } from './version'

describe('startSearchSync config provider', () => {
  const titleOnly: MongoSearchConfig = { targets: { title: { fields: ['title'] } } }
  const titleAndBody: MongoSearchConfig = {
    targets: { title: { fields: ['title'] }, body: { fields: ['body'] } },
  }

  it('resolves a provider at start and backfills with it', async () => {
    if (!available) return
    const col = client.db('qt_provider_test').collection('start')
    await col.deleteMany({})
    await col.insertOne({ _id: 'a', title: 'Hello', body: 'World' } as never)
    const sync = startSearchSync(col, () => titleOnly, { backfill: true, idleMs: 100 })
    await new Promise(r => setTimeout(r, 700))
    const doc = await col.findOne({ _id: 'a' as never }) as any
    expect(doc?._qt?.title).toBeTruthy()
    expect(doc?._qt?.body).toBeFalsy()
    await sync.stop()
  })

  it('re-derives existing docs when the provider returns a grown config', async () => {
    if (!available) return
    const col = client.db('qt_provider_test').collection('grow')
    await col.deleteMany({})
    await col.insertOne({ _id: 'a', title: 'Hello', body: 'World' } as never)
    let cfg: MongoSearchConfig = titleOnly
    const sync = startSearchSync(col, () => cfg, { backfill: true, idleMs: 100 })
    await new Promise(r => setTimeout(r, 700))
    let doc = await col.findOne({ _id: 'a' as never }) as any
    expect(doc?._qt?.body).toBeFalsy()
    // Grow the field set, then cause a burst → idle → reconfigure → re-backfill.
    cfg = titleAndBody
    await col.insertOne({ _id: 'b', title: 'Foo', body: 'Bar' } as never)
    await new Promise(r => setTimeout(r, 900))
    doc = await col.findOne({ _id: 'a' as never }) as any
    expect(doc?._qt?.body).toBeTruthy() // pre-existing doc re-derived for the new field
    await sync.stop()
  })

  it('does not re-backfill when the provider returns an unchanged version', async () => {
    if (!available) return
    const col = client.db('qt_provider_test').collection('stable')
    await col.deleteMany({})
    await col.insertOne({ _id: 'a', title: 'Hello' } as never)
    let started = 0
    const sync = startSearchSync(col, () => titleOnly, { backfill: true, idleMs: 100 })
    sync.on((e) => { if (e.type === 'indexing-started') started += 1 })
    await new Promise(r => setTimeout(r, 500)) // initial backfill settles (started === 1)
    await col.insertOne({ _id: 'b', title: 'World' } as never) // one live burst (started === 2)
    await new Promise(r => setTimeout(r, 700)) // idle → reconfigure(same version) → no backfill
    expect(started).toBe(2) // not 3 — the unchanged-version reconfigure did not backfill
    await sync.stop()
  })

  it('static config is unchanged and the library does not create indexes', async () => {
    if (!available) return
    const col = client.db('qt_provider_test').collection('static')
    await col.deleteMany({})
    await col.insertOne({ _id: 'a', title: 'Hello' } as never)
    const sync = startSearchSync(col, titleOnly, { backfill: true, idleMs: 100 })
    await new Promise(r => setTimeout(r, 700))
    const doc = await col.findOne({ _id: 'a' as never }) as any
    expect(doc?._qt?.title).toBeTruthy() // behaves as before
    const names = (await col.indexes()).map((i: any) => i.name)
    expect(names).not.toContain('_qt_title_ngrams') // static path must NOT auto-create indexes
    await sync.stop()
  })

  it('creates indexes for newly added targets on reconfigure', async () => {
    if (!available) return
    const col = client.db('qt_provider_test').collection('reidx')
    await col.deleteMany({})
    await col.insertOne({ _id: 'a', title: 'Hello', body: 'World' } as never)
    let cfg: MongoSearchConfig = titleOnly
    const sync = startSearchSync(col, () => cfg, { backfill: true, idleMs: 100 })
    await new Promise(r => setTimeout(r, 700))
    cfg = titleAndBody
    await col.insertOne({ _id: 'b', title: 'Foo', body: 'Bar' } as never)
    await new Promise(r => setTimeout(r, 900))
    const names = (await col.indexes()).map((i: any) => i.name)
    expect(names).toContain('_qt_body_ngrams') // new target's ngram index ensured
    await sync.stop()
  })

  it('keeps a consistent final state under rapid config changes', async () => {
    if (!available) return
    const col = client.db('qt_provider_test').collection('rapid')
    await col.deleteMany({})
    await col.insertOne({ _id: 'a', title: 'Hello', body: 'World' } as never)
    let cfg: MongoSearchConfig = titleOnly
    const sync = startSearchSync(col, () => cfg, { backfill: true, idleMs: 80 })
    cfg = titleAndBody
    for (let i = 0; i < 3; i++) {
      await col.insertOne({ _id: `x${i}`, title: 't', body: 'b' } as never)
      await new Promise(r => setTimeout(r, 120))
    }
    await new Promise(r => setTimeout(r, 600))
    const doc = await col.findOne({ _id: 'a' as never }) as any
    expect(doc?._qt?._v).toBe(searchFieldsVersion(titleAndBody)) // settled on the final config
    expect(doc?._qt?.body).toBeTruthy()
    await sync.stop()
  })
})
```

- [ ] **Step 2: Replace `packages/mongo/src/startSearchSync.ts`** with the full content below

```ts
import type { ChangeStream, Collection } from 'mongodb'
import type { MongoSearchConfig } from './config'
import { DEFAULT_NAMESPACE } from './config'
import { computeSearchFields } from './computeSearchFields'
import { createSearchIndexes } from './searchIndexes'
import { searchFieldsVersion } from './version'

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

// A config source is either a fixed config or a provider function. A provider is
// re-invoked on each idle flush; when the config it returns has a new
// searchFieldsVersion (e.g. a grown field set), indexes are ensured and a
// backfill re-derives stale docs. A fixed config behaves exactly as before:
// resolved once, never re-invoked, and the caller owns createSearchIndexes.
export type MongoSearchConfigProvider = () => MongoSearchConfig | Promise<MongoSearchConfig>
export type ConfigSource = MongoSearchConfig | MongoSearchConfigProvider

// Tails the collection change stream, derives search fields, and notifies
// listeners. Requires a replica set. Emits indexing-started / indexing-finished
// (debounced burst, for logging) and a per-doc `indexed` event AFTER the derive
// write resolves (so filters on the derived fields will match). With
// `backfill: true`, derives any pre-existing documents missing the namespace OR
// stamped with an outdated version on start (and again after a provider-driven
// config change).
export function startSearchSync(
  collection: Collection,
  source: ConfigSource,
  options: StartSearchSyncOptions = {},
): SearchSync {
  const { idleMs = 750, backfill = false } = options
  const isProvider = typeof source === 'function'
  const stream: ChangeStream = collection.watch([], { fullDocument: 'updateLookup' })
  const listeners = new Set<SearchSyncListener>()
  const emit = (e: SearchSyncEvent) => { for (const l of listeners) l(e) }

  // Mutable current config + its version. For a fixed config these are set
  // synchronously (preserving today's behavior). For a provider, `current` is
  // undefined until the async bootstrap resolves it, and is refreshed on idle.
  let current: MongoSearchConfig | undefined = isProvider ? undefined : (source as MongoSearchConfig)
  let currentVersion = current ? searchFieldsVersion(current) : ''
  let reindexing = false

  let active = false
  let count = 0
  let startedAt = 0
  let idleTimer: ReturnType<typeof setTimeout> | undefined

  const resolveConfig = async (): Promise<MongoSearchConfig> =>
    isProvider ? await (source as MongoSearchConfigProvider)() : (source as MongoSearchConfig)

  stream.on('change', (change: any) => {
    if (!current) return // provider path: config not resolved yet
    if (!['insert', 'update', 'replace'].includes(change.operationType)) return
    const doc = change.fullDocument
    if (!doc) return
    const ns = current.namespace ?? DEFAULT_NAMESPACE
    const derived = computeSearchFields(doc, current) as Record<string, unknown>
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
      if (isProvider) void maybeReconfigure()
    }, idleMs)
  })

  // Re-derive documents whose search fields are missing OR were derived under a
  // different version (library upgrade or config change).
  async function runBackfill(cfg: MongoSearchConfig) {
    const ns = cfg.namespace ?? DEFAULT_NAMESPACE
    const version = searchFieldsVersion(cfg)
    const sweepStartedAt = Date.now()
    let n = 0
    emit({ type: 'indexing-started' })
    const cursor = collection.find({
      $or: [{ [ns]: { $exists: false } }, { [`${ns}._v`]: { $ne: version } }],
    })
    for await (const doc of cursor) {
      const derived = computeSearchFields(doc, cfg) as Record<string, unknown>
      await collection.updateOne({ _id: doc._id }, { $set: { [ns]: derived[ns] } }).catch(() => {})
      n += 1
    }
    emit({ type: 'indexing-finished', count: n, durationMs: Date.now() - sweepStartedAt })
  }

  // Provider path: re-resolve on idle; if the version changed, ensure indexes and
  // re-derive stale docs. Guarded so flushes during a long backfill don't start a
  // second one (the next idle re-checks).
  async function maybeReconfigure() {
    if (reindexing) return
    const next = await resolveConfig()
    const nextVersion = searchFieldsVersion(next)
    if (nextVersion === currentVersion) return
    reindexing = true
    try {
      current = next
      currentVersion = nextVersion
      await createSearchIndexes(collection, next)
      await runBackfill(next)
    } finally {
      reindexing = false
    }
  }

  // Initial bootstrap. Provider: resolve, ensure indexes, optional backfill (all
  // async, fire-and-forget — the change stream is already open and the loop guard
  // dedups overlap). Fixed config: behave exactly as before — the caller owns
  // createSearchIndexes; we only run the optional backfill.
  if (isProvider) {
    reindexing = true
    void (async () => {
      try {
        current = await resolveConfig()
        currentVersion = searchFieldsVersion(current)
        await createSearchIndexes(collection, current)
        if (backfill) await runBackfill(current)
      } finally {
        reindexing = false
      }
    })()
  } else if (backfill) {
    void runBackfill(current as MongoSearchConfig)
  }

  return {
    on: (l) => { listeners.add(l) },
    off: (l) => { listeners.delete(l) },
    stop: async () => { if (idleTimer) clearTimeout(idleTimer); listeners.clear(); await stream.close() },
  }
}
```

- [ ] **Step 3: Export the new types** in `packages/mongo/src/index.ts`

Change the existing `startSearchSync` type-export line to add the two new types:

```ts
export type {
  SearchSync, SearchSyncEvent, SearchSyncListener, StartSearchSyncOptions,
  ConfigSource, MongoSearchConfigProvider,
} from './startSearchSync'
```

- [ ] **Step 4: Document the provider option** in `packages/mongo/README.md`

Add a short section (place it after the existing `startSearchSync` documentation). Match the README's existing prose/style; the content:

```markdown
### Dynamic config: a provider function

`startSearchSync` also accepts a **provider function** in place of a fixed
config, for collections whose searchable fields are not known up front or change
over time:

```ts
startSearchSync(collection, () => deriveConfigFromData(collection), { backfill: true })
```

The provider is resolved once at start and re-invoked on each idle flush. When it
returns a config whose `searchFieldsVersion` differs (e.g. a newly discovered
field), the watcher ensures the new indexes and re-derives existing documents.
Sampling and any throttling belong in the provider — the watcher calls it once per
idle burst and re-backfills only on a version change. Passing a plain config object
is unchanged: it is resolved once and you call `createSearchIndexes` yourself.
```
```

- [ ] **Step 5 (no run, no commit).** Do not run tests or git here. Verification and commit happen in Task 2.

---

## Task 2: Verify + commit (serial)

**Files:** none edited — provisions Mongo, runs the suite/build, commits.

- [ ] **Step 1: Stand up a single-member replica-set Mongo on :27018**

The tests connect to `mongodb://localhost:27018/?directConnection=true` and skip when unavailable — so a real RS Mongo is required to actually exercise the change-stream paths.

```bash
docker run -d --name qt-test-mongo -p 27018:27017 mongo:7 --replSet rs0
sleep 3
docker exec qt-test-mongo mongosh --quiet --eval "rs.initiate({_id:'rs0',members:[{_id:0,host:'localhost:27017'}]})"
# wait for PRIMARY
until docker exec qt-test-mongo mongosh --quiet --eval "db.hello().isWritablePrimary" | grep -q true; do sleep 1; done
```

If a usable RS Mongo is already listening on :27018, skip provisioning and use it.

- [ ] **Step 2: Run the mongo package tests and build**

```bash
pnpm --filter @quaesitor-textus/mongo test
pnpm --filter @quaesitor-textus/mongo build
```

Expected: all tests PASS (the new `startSearchSync config provider` block runs against the RS Mongo — confirm it is **not** skipped; the existing suite stays green), and `tsup` build succeeds (type-checks the new `ConfigSource`/provider types and exports).

- [ ] **Step 3: Fix any breakage**

Fix and re-run until green. If a test is timing-sensitive (idle/backfill waits), adjust the `idleMs` and `setTimeout` constants in the test — do not weaken assertions. If the RS Mongo could not be provisioned (no docker), say so explicitly and do **not** claim the change-stream tests passed (skipped ≠ passed).

- [ ] **Step 4: Tear down the throwaway Mongo (only if this task started it)**

```bash
docker rm -f qt-test-mongo
```

- [ ] **Step 5: Commit** (no `Co-Authored-By` trailer — `~/deai` repos ban it)

```bash
git add packages/mongo/src/startSearchSync.ts packages/mongo/src/index.ts \
        packages/mongo/src/startSearchSync.test.ts packages/mongo/README.md
git commit -m "feat(mongo): accept a config provider function in startSearchSync

Re-invoke the provider on each idle flush and re-backfill (ensuring indexes)
when the resolved searchFieldsVersion changes, so an evolving field set is
picked up without a restart. Fixed-config callers are unchanged: resolved once,
no re-invocation, caller owns createSearchIndexes."
```

---

## Self-review notes

- **Spec coverage:** provider type + widened signature (Step 2/3) ✓; resolve-at-start + ensure-indexes + backfill ✓; idle re-invoke + version-gated re-backfill (`maybeReconfigure`) ✓; serialization guard (`reindexing`) ✓; static path byte-identical incl. no `createSearchIndexes` (Step 2 `else if` branch + test 4) ✓; README ✓; tests 1–6 ✓.
- **No placeholders:** full file + full test block + exact README text + exact commands.
- **Type consistency:** `ConfigSource` / `MongoSearchConfigProvider` defined in `startSearchSync.ts`, exported in `index.ts`, used in the signature; `runBackfill(cfg)` parameterized and called with `current`/`next` consistently.
