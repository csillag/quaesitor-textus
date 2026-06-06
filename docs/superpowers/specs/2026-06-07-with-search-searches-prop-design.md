# `searches` prop on `WithSearch` — multiple parallel searches from one provider

This spec was written against the following baseline:

**Base revision:** `45f5631ad211359906ca8998eead3dabc26fffc5` on branch `main` (as of 2026-06-06T22:52:30Z)

## Summary

`WithSearch` currently hosts exactly one named search (one query, one input). Running
N parallel searches today requires nesting N `WithSearch` wrappers. When N is
**dynamic**, the nesting depth changes at runtime — the React component tree and DOM
structure churn (remounts, reconciliation overhead) as searches are added/removed.

This change adds a `searches` prop to `WithSearch`: an array of search specs. One
`WithSearch` instance then hosts any number of independent named searches with a
**flat, stable tree** regardless of N. The feature is purely additive — existing
single-search usage (`field` / `fields`, controlled or uncontrolled) is unchanged.

## Motivation

The need is parallel searches over a **dynamic number of fields**. With the current
pattern that means wrapping the subtree in a dynamically changing number of
`<WithSearch>` providers, so both the component tree and the DOM structure keep
changing shape. That is needless work for React's reconciliation and a structural
smell. A single provider that accepts an array of searches removes the variable-depth
nesting entirely.

## Public API

A new per-search spec type and a new (additive) prop shape on `WithSearch`:

```ts
interface SearchSpec {
  /** Context key for this search. Default: field ?? fields.join('+') (same rule WithSearch uses today). */
  name?: string
  /** Single field for this search. Mutually exclusive with fields. */
  field?: string
  /** Multiple fields for this search. Mutually exclusive with field. */
  fields?: string[]
  /** Per-search option overrides; merged over the WithSearch-level options (per-search wins). */
  options?: SearchOptions
}
```

`WithSearchProps` becomes a discriminated union — the existing single-search forms
plus a new multi-search form:

```ts
// existing (unchanged):
//   { field?: string;  fields?: never; searches?: never } & controlled props
//   { fields: string[]; field?: never; searches?: never } & controlled props
// new:
//   { searches: SearchSpec[]; field?: never; fields?: never } & NO controlled props
```

The `searches` form is **mutually exclusive** with `field`, `fields`, and the
controlled-state props (`query`, `onSetQuery`, `onReset`, `onChange`). Searches created
this way are **uncontrolled** (each manages its own query internally).

### Usage

```tsx
// dynamic number of fields, one stable provider:
<WithSearch searches={fields.map(f => ({ name: f, field: f }))}>
  {fields.map(f => <SearchInput key={f} name={f} />)}
  {rows.map(row =>
    fields.map(f => <HighlightedText key={f} text={row[f]} searchNames={f} />)
  )}
</WithSearch>
```

Consumers are unchanged: `SearchInput name=`, `useSearchContext(name)`, and
`HighlightedText searchNames=` already key by name and resolve against the context map.

## Semantics

- Each `SearchSpec` produces one independent uncontrolled `SearchEntry` in the context
  map, with the same shape as today: `{ query, setQuery, patterns, hasPatterns, reset,
  fields, options }`.
- `name` defaults to `field ?? fields.join('+')` (the existing rule). A spec with
  neither `field` nor `fields` defaults to `fields: ['$']` (whole corpus), matching a
  bare `WithSearch` today.
- Per-search `options` are merged over the WithSearch-level `options`; per-search keys
  win. `patterns` are derived per search via `parseInput(query, mergedOptions)`.
- **Duplicate-name detection** applies within the `searches` array *and* against the
  upstream context map (same error message style as today). `searches` still composes
  with nested `WithSearch` (the provider merges into `upstreamMap`).
- Removing a spec from the array drops its entry on the next render; its internal query
  is discarded (expected — these searches are uncontrolled).

## Internal implementation

- The `searches` path holds **one** `useState<Record<string, string>>` (name → query)
  in `WithSearch`. It does NOT call a hook per array item (rules of hooks forbid
  per-item hooks with dynamic N). All entries are built in a `useMemo` keyed on
  `[searches, queryMap, options]`.
  - `setQuery(name)` / `reset(name)` update the map functionally
    (`setMap(m => ({ ...m, [name]: value }))`); `reset` sets the entry to `''`.
- Extract a shared helper `deriveEntry({ query, setQuery, reset, fields, options })`
  that returns a `SearchEntry` (runs `parseInput`, computes `hasPatterns`). Both the
  existing single-search path and the new multi path build entries through it, so there
  is a single source of truth for entry shape and pattern derivation (no duplication).
- The single-search path (`field` / `fields`, controlled support via
  `useSearchInternalState`) is left intact and refactored only to route its entry
  through `deriveEntry`.
- Runtime guard: passing `searches` together with `field` / `fields` / any controlled
  prop throws (mirrors the existing `field` + `fields` guard) so plain-JS users get a
  clear error even though TypeScript already forbids it.

## Edge cases

- `searches={[]}` → a provider with no entries (valid no-op).
- Spec with neither `field` nor `fields` → `fields: ['$']`.
- Two specs with the same resolved `name` → throws (duplicate name).
- `searches` plus `field` / `fields` / controlled props → throws at runtime; forbidden
  by the prop union at compile time.

## Testing (TDD)

- **Multi-entry, independent:** two specs → two independent queries; setting one does
  not affect the other; `HighlightedText searchNames=` marks resolve per search.
- **Dynamic N stability:** render with 2 specs, rerender with 3 — existing inputs/children
  do not remount (stable identity), the new entry appears, and the queries of unchanged
  entries are preserved.
- **Per-search options override:** a spec's `options` overrides the WithSearch-level
  `options` (e.g. `caseSensitive`).
- **Default name:** spec without `name` keys by `field` (and `fields.join('+')`).
- **Duplicate name in array → throws.**
- **Backward compatibility:** all existing single-search `field` / `fields` and
  controlled tests continue to pass unchanged.

## Compatibility & release

Purely additive; no breaking change. Ships as a new minor version (**v0.4.0**). The fix
lives entirely in `@quaesitor-textus/core`; `antd` and `mongo` are bumped in lockstep
per the project's release convention.

## Out of scope (YAGNI)

- Controlled per-search state (per-item `query` / `onSetQuery` / callbacks). The driving
  use case is uncontrolled; controlled-multi would reintroduce an external map of state
  and callbacks. Can be added later if a real need appears.
- Reworking the single-search path into a thin wrapper over the multi path (Approach 3).
  Larger refactor with risk to existing controlled behavior; not needed for this goal.
