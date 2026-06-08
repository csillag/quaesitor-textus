# Server-side highlight annotation — data-driven, off the typing path

This spec was written against the following baseline:

**Base revision:** `c605d5384dd50df98536699e512ca7d9891c42b7` on branch `main` (as of 2026-06-08T12:27:35Z)

## Summary

When a search result is rendered with per-cell highlighting, every text cell is a
`HighlightedText` subscribed to the live token context. Each keystroke changes the
tokens and fans out a re-evaluation to **every** cell — hundreds of `HighlightedText`
recomputes per keypress, spiking CPU and killing typing.

This change makes highlighting **data-driven instead of input-driven**. The server,
which already runs the search, annotates each emitted record with a small sidecar
saying *which fields matched which named search, and with what tokens*. The client
renders `HighlightedText` only on the flagged cells, using the tokens carried in the
data — never subscribing cells to the live input. Typing then triggers only the input
update and the re-subscribe; it performs **no** per-cell highlight work. Highlights
update when annotated data arrives, the same gradual way rows already do.

## Problem

Per keystroke today:

- **Immediate:** the token context changes → every existing `HighlightedText` cell
  re-evaluates `getHighlightPositions`. With a large table this is the CPU spike.
- **Secondary:** the data source re-subscribes with a new filter; rows update gradually.
  Existing rows are not dropped.

The spike is the immediate context fan-out across all cells, before any new data
arrives. Decoupling highlighting from the live input removes it at the root.

## Approach

Highlight info travels **with the streamed rows**:

```
keystroke → new tokens → re-subscribe (mongo)              [no client highlight work]
                              ↓
server: per emitted record, per matched named search →
        which fields matched + that search's tokens         [computeHighlights]
                              ↓
record carries a `_highlights` sidecar
                              ↓
client: cell = matched ? <HighlightedText patterns={sidecar.tokens}/> : plain value
```

The hundreds of non-matching cells become plain strings — no subscription, no re-render
on typing. Only the sparse matching cells run `getHighlightPositions`, and only when new
annotated data lands.

## Key facts this design rests on

- **A "target" is a static `config.targets` entry** (a named group of fields + fold
  options), known at index time. `computeSearchFields` stores, per target, the folded
  corpus `ns.<target>.<modeKey>` = `normalizeText(buildCorpus(doc, target.fields), mode)`.
- **Per-field targets give per-field folded text for free.** When a target is a single
  field (excavator's `excavator-target-mongo-search-indexer` auto-configures exactly
  this: `for (f of fields) targets[f] = { fields: [f] }`), `ns.<target>.<modeKey>` *is*
  that field, folded. The per-cell match test is then a bare substring on already-stored
  data — no re-folding, no new storage, no new index.
- **The search already selected the rows.** "Does field F of *this* returned document
  contain token T" is a local property of one document — answered by reading the
  document, not by an index. The existing ngram index (`ns.<target>.ngrams`) only
  accelerates collection-wide *selection*; it offers nothing for the per-cell signal and
  would only re-derive an *approximate* (superset) version of what we read exactly for
  free. So the per-cell test is JS substring on the fetched folded field.
- **Folding is the SSOT.** Server `includes()` and client `getHighlightPositions` both
  fold via the same `normalizeText`, so they always agree — the server never produces a
  false negative, and tokens are carried folded (highlighting `Weiß` from token `weiss`
  works via the existing offset-mapping fix).

## Data contract

### Self-describing query tag

`buildTextSearchFilter` currently emits, per target + mode + patterns:

```js
{ $and: [
  { `${ns}.${target}.ngrams`: { $all: [ ...ngramTerms ] } },
  { `${ns}.${target}.${modeKey(mode)}`: { $regex: escapeRegex(normalizeText(p, mode)) } },
  ...
] }
```

The folded patterns are only recoverable by un-escaping the `$regex` (brittle, lossy).
Instead, `buildTextSearchFilter` additionally emits an explicit, machine-readable tag so
the highlight extractor never reverse-engineers the regex.

The tag is carried as a **reserved sidecar key on the filter object** (not as a `$and`
member — that risks mongo trying to match it). It travels with the query across the
transport boundary; `createLiveSearch` reads it and **strips it before calling
`collection.find`**, so mongo never sees it:

```js
// buildTextSearchFilter returns:
{
  $and: [
    { `${ns}.${target}.ngrams`: { $all: [...] } },
    ...verifyConditions
  ],
  __qtHighlights: [
    { target, mode, tokens: patterns.map(p => normalizeText(p, mode)) }
  ]
}
```

- `__qtHighlights` is an array so a compound query (several text-search primitives
  combined by the caller) accumulates one entry per primitive. When the caller composes
  multiple filters, the entries are merged into a single top-level `__qtHighlights` array.
- The requirement: each text-search primitive contributes `{ target, mode, tokens }` with
  `tokens` already folded for that mode; the array is reachable from the query object and
  is removed before the query reaches mongo.
- `tokens` empty / patterns empty → no entry contributed.

### Per-record sidecar

```ts
// added to each emitted record when highlight annotation is enabled:
_highlights: Record<string /* target = searchName */, {
  tokens: string[]   // that named search's folded tokens (same across the query's records)
  fields: string[]   // this record's fields to highlight for this search
}>

// example:
_highlights: {
  author: { tokens: ['tolst'],       fields: ['author'] },
  title:  { tokens: ['war', 'peac'], fields: ['title'] },
}
```

- Keyed by **target**, which is the client's **searchName**.
- `tokens` carried per-record (self-contained; no separate once-only event to miss).
- `fields` is the set of fields to highlight for that search in this record (see fallback
  rules for multi-field targets).

### Client consumption

```tsx
const h = record._highlights?.[searchName]
h?.fields.includes(field)
  ? <HighlightedText text={value} patterns={h.tokens} />
  : value
```

`HighlightedText` already accepts `patterns` directly (v0.4.0), so no core component
change is required.

## Server computation

Per emitted record, for each tagged text-search primitive `{ target, mode, tokens }`:

```
folded = doc[ns]?.[target]?.[modeKey(mode)]            // precomputed folded target text
if folded === undefined:                               // fallback 2 (see below)
    folded = normalizeText(buildCorpus(doc, config.targets[target].fields), mode)
hits = tokens.filter(t => folded.includes(t))
if hits.length > 0:
    _highlights[target] = { tokens, fields: matchedFields(doc, target, tokens, mode) }
```

`matchedFields`:
- **Single-field target:** `[the field]` (the folded text is exactly that field; a hit
  means the field contains a token).
- **Multi-field target:** all of `config.targets[target].fields` (fallback 1 — see
  below). We cannot tell *which* sub-field from the concatenated blob, so we mark them
  all; the client harmlessly no-ops on fields that don't contain a token.

## Graceful fallback (correctness always; performance degrades)

Correctness is preserved for any usage pattern. Three fallbacks are **required** parts of
this design:

1. **Multi-field target.** Mark all the target's fields. The client renders
   `HighlightedText` on each; it renders plain text where there is no match. Correct
   output; cost = a few extra no-op `HighlightedText` widgets (bounded by target width).
2. **Stored folded text unavailable** (projection excluded `ns.<target>.<modeKey>`, or the
   doc isn't indexed yet). `computeHighlights` refolds from the raw fields on the fly.
   Correct; costs per-doc normalization for that record.
3. **Consumer hasn't adopted server annotation** (no tag, `highlight` disabled, or a
   different transport → no `_highlights` on the record). The client cell helper detects
   the missing sidecar and reverts to the original **context-driven** highlighting (every
   cell wired to live tokens). Correct, at today's performance. Non-adopters lose nothing
   but speed.

We always mark a **superset** of cells (never a false negative), and server/client fold
via the same `normalizeText`, so the optimization only ever removes *wasted*
`HighlightedText` widgets — it never changes what is highlighted.

## Components / files

- **mongo `buildTextSearchFilter`** — emit the self-describing `{ target, mode, tokens }`
  tag alongside the existing conditions. Additive; existing matching behavior unchanged.
- **mongo `computeHighlights(tags, doc, config)`** (new, pure) — given the
  `__qtHighlights` tag array and a document, read `doc[ns][target][modeKey]` (or refold
  per fallback 2), build the `_highlights` sidecar. Unit-testable in isolation.
- **mongo `createLiveSearch`** — opt-in `highlight?: boolean`. It receives the filter
  object, reads `filter.__qtHighlights`, and **strips that key before querying mongo**.
  When `highlight` is enabled and tags are present, run `computeHighlights` on each
  snapshot item and each emitted match/`matches` item; the applied `projection` must
  **retain** `ns.<target>.<modeKey>` (it may still drop the large `ns.<target>.ngrams`
  arrays). When disabled, docs are emitted unchanged (the key is still stripped).
- **client** — no required core change (`HighlightedText` already takes `patterns`).
  Provide an optional thin helper `HighlightedCell({ record, field, searchName, ... })`
  that implements the data-driven lookup with the context-driven fallback (fallback 3) in
  one place.
- **docs (deliverable, not optional)** — see Documentation.

## Documentation (2b)

Shipped with the feature:
- **mongo README:** the performant pattern — single-field targets, enable `highlight`,
  keep `ns.<target>.<modeKey>` in the projection; what `_highlights` contains; the
  fallback behavior for multi-field targets and missing folded text.
- **core README / client docs:** the data-driven cell pattern
  (`record._highlights[searchName]` → conditional `HighlightedText`) and the automatic
  context-driven fallback when the sidecar is absent.
- A short rationale note: highlighting is data-driven to keep typing off the per-cell
  recompute path.

## Compatibility & release

Additive throughout: the query tag is ignorable; the sidecar appears only when
`highlight` is enabled; no change to stored search fields or indexes (existing folded
fields are read, not rewritten). Ships as a new minor version (**v0.5.0**); core/antd/
mongo bumped in lockstep per project convention.

## Testing

- **Tag round-trip:** `buildTextSearchFilter` output, walked by the extractor, yields the
  original `{ target, mode, tokens }` (folded).
- **Sidecar correctness — AND query:** multi-primitive AND → sidecar keyed by each target
  with correct tokens and fields.
- **Sidecar correctness — OR / compound query:** a record satisfying the predicate via one
  branch only gets `fields` for the branches it actually matches (per-record substring
  test, not "predicate matched").
- **Single-field target precision:** sibling field that doesn't contain the token is
  absent from `fields`.
- **Multi-field target fallback:** all target fields marked; client-side render shows the
  matching field highlighted and the non-matching field as plain text.
- **Mode-aware:** `caseSensitive` / `diacriticSensitive` queries read the correct
  `modeKey` folded field and test accordingly.
- **Missing folded text fallback:** with `ns.<target>.<modeKey>` projected out,
  `computeHighlights` refolds raw and still produces the correct sidecar.
- **Tag stripping:** `createLiveSearch` removes `__qtHighlights` from the filter before
  calling `collection.find` (mongo never receives it), with `highlight` on *and* off.
- **Annotation disabled:** `highlight` off → emitted docs are byte-identical to today.
- **Projection:** with `highlight` on, folded verify fields are retained and ngram arrays
  are dropped.
- **Client fallback:** a record without `_highlights` renders via the context-driven path
  and still highlights correctly.

## Out of scope (YAGNI)

- Per-field folded storage (`ns.<target>.fields.<field>.<modeKey>`) and the associated
  derivation-version bump / re-backfill. Only needed to get sub-field selectivity *inside*
  multi-field targets without refolding; the refold fallback (2) already keeps those
  correct. Revisit if a real multi-field-target perf need appears.
- Pushing the per-field test into a mongo aggregation (`$regexMatch` / `$facet`). The
  documents are already fetched; an in-memory substring on the folded field is exact and
  cheaper than extra DB round-trips, and the index cannot accelerate a per-document
  projection anyway.
- Precomputed highlight *positions/segments* on the server (vs. tokens). Client-side
  `getHighlightPositions` over the sparse matched cells is cheap and keeps the payload
  small.
