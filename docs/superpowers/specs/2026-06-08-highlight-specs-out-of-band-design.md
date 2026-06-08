# Highlight specs out-of-band — `buildTextSearchFilter` stays a pure filter

This spec was written against the following baseline:

**Base revision:** `1bb3f8f4f0627865b7a53eb2ceeb2a900214b9e2` on branch `main` (as of 2026-06-08T13:38:45Z)

## Summary

The server-side highlight annotation feature (spec
`2026-06-08-server-side-highlight-annotation-design.md`) shipped with the highlight
tag **embedded in the mongo filter** under a reserved `__qtHighlights` key, stripped by
`createLiveSearch` before querying. This broke every codepath that runs the filter
directly without stripping: mongo treats `__qtHighlights` as a field-equality condition,
so the query matches zero documents.

This spec **supersedes that tag mechanism**. Highlight info travels **out-of-band** as a
`HighlightSpec[]` passed to the live-search layer; `buildTextSearchFilter` returns a
plain, directly-usable mongo `Filter` again. The per-record `_highlights` sidecar and the
entire client side (`HighlightedCell`) are unchanged.

## The bug being fixed

Reproduced against the demo DB (1000 seeded books), predicate
`{AND:[{TEXT:{target:'author',patterns:['sara']}},{YEAR:{gte:-800,lte:2024}}]}`:

```
filter has __qtHighlights: true
count WITH tag (current /api/books):   0      <- the bug
count CLEANED (tag stripped):          46     <- correct (matches the live stream)
```

`/api/live` worked only because `createLiveSearch` strips the tag. `/api/books`
(`col.find(filter)` / `countDocuments(filter)`) does not, so it returned zero.

## Why out-of-band (not embed-and-strip)

`buildTextSearchFilter` is a **public export**. Embedding the tag makes its output no
longer a valid mongo filter — a footgun for every direct consumer:

- In-repo: the demo `/api/books` endpoint (the reported break).
- External: **excavator** (`packages/api/src/search/filter.ts`) calls
  `buildTextSearchFilter` and composes filters it runs directly; it would break on
  upgrade.

Changing `buildTextSearchFilter`'s **return type** (e.g. `{filter, tag}`) is also ruled
out: excavator's `filter.ts` expects a plain `Filter`. So the filter must stay a clean
`Filter<Document>`, and highlight info must travel separately.

The "tag must ride the filter to survive transport" premise was wrong for this
architecture: the mongo filter is always built **server-side** from the consumer's own
predicate, so highlight specs are built server-side too, in the same place.

## Division of responsibility

The library owns the **leaf primitive**, not query composition:

- `buildTextSearchFilter(target, patterns, config, options)` turns one text-search target
  into one mongo filter fragment.
- How leaves combine into a query is **consumer code** with a consumer-owned DSL
  (demo: `DemoPredicate` + `predicateToMongo`; excavator: its own filter schema +
  `filter.ts`). The library never sees these trees — they carry custom operators and
  non-text conditions — so only the consumer's own traversal can find the text leaves.

Therefore collecting highlight specs is the consumer's job, done **in the traversal it
already performs** (or a tiny parallel one): at each text leaf, emit the same
`{target, patterns, options}` triple it already passes to `buildTextSearchFilter`.

## Public API

```ts
// NEW — the raw, unfolded spec (same triple as buildTextSearchFilter inputs):
export interface HighlightSpec {
  target: string
  patterns: string[]
  options?: SearchOptions
}

// buildTextSearchFilter: unchanged signature, returns a CLEAN Filter (no __qtHighlights):
export function buildTextSearchFilter(
  target: string, patterns: string[], config: MongoSearchConfig, options?: SearchOptions,
): Filter<Document>

// computeHighlights: now takes specs and folds internally:
export function computeHighlights(
  specs: HighlightSpec[], doc: Document, config: MongoSearchConfig,
): RecordHighlights

// createLiveSearch / streamLiveSearch / runLiveSearch gain:
//   highlightSpecs?: HighlightSpec[]
// (replaces the removed `highlight?: boolean`)
```

**Removed:** the `__qtHighlights` filter key, `collectHighlightTags`, the `HighlightTag`
type/export, the `highlight?: boolean` option, and the filter-strip path in
`createLiveSearch`.

**Unchanged:** `RecordHighlights` / `FieldHighlight`, the `_highlights` sidecar shape,
`HighlightedCell`, the core READMEs, and the per-cell client logic.

## Server computation

Folding must match `buildTextSearchFilter` exactly (extract a shared helper so the two
cannot drift). Per spec:

```
target = config.targets[spec.target]; if missing -> skip
mode   = spec.options ?? target.options ?? {}
tokens = spec.patterns.map(p => normalizeText(p, mode))
stored = doc[ns]?.[spec.target]?.[modeKey(mode)]
folded = typeof stored === 'string' ? stored
                                    : normalizeText(buildCorpus(doc, target.fields), mode)  // refold fallback
if tokens.some(t => folded.includes(t)):
    result[spec.target] = { tokens, fields: target.fields }
```

The sidecar `tokens` are the folded tokens (what `HighlightedText` marks); `fields` are
the target's fields (exact for single-field targets; safe superset for multi-field —
the client no-ops on fields without a match). Keyed by `target` === client `searchName`.

`createLiveSearch` uses the (clean) `filter` directly and annotates snapshot items + each
emitted match via `computeHighlights(highlightSpecs, doc, config)` when
`highlightSpecs` is present and non-empty; otherwise docs are emitted unchanged.

## Demo wiring

- `predicateToMongo` — **unchanged**: stays pure, returns a clean filter; `/api/books`
  works untouched (this is the regression fix in practice).
- New `predicateToHighlightSpecs(predicate): HighlightSpec[]` in `packages/demo/src/shared`
  — recursive, descends `AND`/`OR`, emits one `HighlightSpec` per `TEXT` leaf
  (`{ target, patterns, options }`), ignores non-text nodes.
- `/api/live` builds `highlightSpecs = predicateToHighlightSpecs(predicate)` and passes
  them to `streamLiveSearch` (no more `highlight: true`). `bookColumns` / `HighlightedCell`
  unchanged.

## Compatibility & release

Within the unreleased v0.5.0 work on `main` — this corrects the not-yet-published
mechanism, so there is no external break to manage. Still ships as **v0.5.0**.
`buildTextSearchFilter`'s public contract is *restored* (clean filter), so excavator and
any other direct consumer are unaffected on upgrade.

## Testing

- **Regression (the reproduced bug):** `buildTextSearchFilter(...)` returns a filter with
  no key beyond `$and` (no `__qtHighlights`); empty patterns still returns `{}`. A
  composed filter `{ $and: [buildTextSearchFilter(...), {year:{...}}] }` is a clean mongo
  filter (no reserved keys anywhere).
- **computeHighlights(specs, doc, config):** single-field exact match; token absent →
  omitted; multi-field target marks all fields; refold fallback when folded field absent;
  multiple specs (compound query) → multi-key sidecar; per-spec `options` selects the
  right `modeKey`; unknown target ignored.
- **createLiveSearch:** with `highlightSpecs`, snapshot items + matches carry
  `_highlights`; without, docs are unchanged; the filter is passed to mongo as-is (no
  reserved keys; existing mongo-backed tests still pass).
- **runLiveSearch (adapter):** forwards `highlightSpecs` so the SSE stream carries
  `_highlights`.
- **Folding SSOT:** the shared fold helper used by `buildTextSearchFilter` and
  `computeHighlights` produces identical tokens for the same `(patterns, mode)`.

## Out of scope (unchanged from the prior spec)

- Per-field folded storage / sub-field selectivity inside multi-field targets.
- Pushing per-field matching into a mongo aggregation.
- Server-computed highlight positions (client computes over the sparse matched cells).
