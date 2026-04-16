# `filterFunction` — Replace `executeSearch` with Array-Compatible Filter

**Base revision:** `7da635de2bbf8073888a729da6764a26b742f2b6` on branch `main`, later updated to reflect `3f32267d73e17f45760dc44d8cf5c415781393d6` (as of 2026-04-16T01:50:34Z)

## Summary

Replace the `executeSearch` API on `SearchContextValue` / `useSearchContext` with a
`filterFunction` that can be passed directly to `Array.filter`. The mapping from item
to searchable corpus moves from the call site of `executeSearch` to an optional
argument of `useSearchContext`, making `useSearchContext` generic over the item type.

---

## Section 1 — `SearchContextValue`

Remove `executeSearch`. The `highlightedPatterns: string[]` field was added by a parallel feature (`highlight-patterns-and-trimming`) and is already present — this spec leaves it untouched.

```ts
export interface SearchContextValue {
  query: string
  setQuery: (q: string) => void
  patterns: string[]
  highlightedPatterns: string[]   // added by parallel feature; left as-is
  hasPatterns: boolean
  reset: () => void
}
```

`WithSearch` loses its `executeSearch` memoization block; nothing replaces it there.

---

## Section 2 — `useSearchContext`

`useSearchContext` becomes generic and accepts an optional `ItemOptions<T>` argument.

```ts
interface ItemOptions<T> {
  mapping?: (item: T) => string
}

function useSearchContext<T = string>(itemOptions?: ItemOptions<T>): {
  query: string
  setQuery: (q: string) => void
  patterns: string[]
  filterFunction: (item: T) => boolean
  hasPatterns: boolean
  reset: () => void
}
```

`filterFunction` is built inside `useSearchContext` via `useMemo`:

```ts
const mapping = itemOptions?.mapping ?? ((x: unknown) => x as string)
const filterFunction = useMemo(
  () => (item: T) => matchItem(mapping(item), patterns),
  [mapping, patterns]
)
```

`matchItem` is called without `SearchOptions`, using its defaults (case-insensitive,
diacritic-insensitive). When `patterns` is empty, `matchItem` returns `true`, so
`filterFunction` passes all items through — no special handling needed for the
"no active search" case.

`ItemOptions` is not part of `SearchContextValue`. The context is untyped with respect
to the consumer's item shape; the mapping is a `useSearchContext` concern only.

---

## Section 3 — Call-site changes

Before:
```ts
const { executeSearch } = useSearchContext()
const results = executeSearch(items, item => item.text)
```

After:
```ts
const { filterFunction } = useSearchContext<Item>({ mapping: item => item.text })
const results = items.filter(filterFunction)
```

Default case (string arrays) — no argument needed:
```ts
const { filterFunction } = useSearchContext()
const results = items.filter(filterFunction)
```

### Rebase conflict resolution for story files

Both `packages/core/stories/FullListDemo.stories.tsx` and `packages/antd/stories/FullListDemo.stories.tsx` conflict during rebase because the parallel `highlight-patterns-and-trimming` feature replaced `HighlightedText` with `HighlightedTrimmedText` in those same files while this branch replaced `executeSearch` with `filterFunction` in the same lines.

The resolution combines both changes: use `filterFunction` from this branch AND `HighlightedTrimmedText` from main. Resolved form for both stories:

```tsx
const { filterFunction, hasPatterns, reset } = useSearchContext<string>()
const filtered = phrases.filter(filterFunction)
// rendering:
<HighlightedTrimmedText text={phrase} fragmentLength={40} />
```

Import `HighlightedTrimmedText` instead of `HighlightedText` in both story files.

---

## Section 4 — Tests

### `useSearchContext` (extend existing tests or add new)

- Called with no args: `filterFunction` is `(item: string) => boolean`; matches items containing all patterns.
- Called with `mapping`: `filterFunction` maps each item through the function before matching.
- When `patterns` is empty: `filterFunction` returns `true` for every item.
- `filterFunction` is stable across re-renders when `patterns` and `mapping` are unchanged.

### `WithSearch` (extend existing tests)

- `executeSearch` is no longer present in context value.

---

## Out of scope

- Passing `SearchOptions` through `useSearchContext` — normalization settings remain a `WithSearch` concern.
- Changes to `useSearch` (the standalone hook) — it already returns `filteredItems` directly and is unaffected.
