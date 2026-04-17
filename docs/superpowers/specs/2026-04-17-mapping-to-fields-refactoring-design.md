# Mapping Function → Field Paths Refactoring

**Base revision:** `60f0d98c3535107b949fe123c217b2c4fbbc4b51` on branch `main` (as of 2026-04-17T02:02:34Z)

## Summary

Replace the `mapping: (item: T) => string` prop on `WithSearch` with `field: string` / `fields: string[]` props that specify dot-notation field paths. This makes the search configuration serializable and inspectable, enabling future server-side search packages (e.g. `@quaesitor-textus/mongodb`) to read the same field list from context and generate server-side query conditions automatically.

## Section 1: Props API

`WithSearch` loses its `T` generic entirely. The new props use a TypeScript union to enforce mutual exclusion between `field` and `fields` at compile time, plus a runtime guard:

```typescript
type WithSearchProps = {
  name?: string
  options?: SearchOptions
  children: React.ReactNode
  query?: string
  onSetQuery?: (q: string) => void
  onReset?: () => void
  onChange?: (oldValue: string, newValue: string) => void
} & (
  | { field?: never; fields?: never }   // default: ["$"]
  | { field: string; fields?: never }
  | { fields: string[]; field?: never }
)
```

Runtime normalization at the top of `WithSearch`:

```typescript
if (field !== undefined && fields !== undefined) {
  throw new Error('Cannot specify both `field` and `fields` on WithSearch.')
}
const resolvedFields: string[] = field !== undefined ? [field] : (fields ?? ['$'])
```

`resolvedFields` is what gets stored in context — the `field` / `fields` distinction disappears immediately after normalization.

### Path syntax

Paths are plain dot-notation: `"name"`, `"metadata.title"`, `"author.name"`. The special token `"$"` addresses the root value itself. This is borrowed from JSONPath's root token; we do not implement full JSONPath syntax.

- `"$"` → the item itself
- `"name"` → `item.name`
- `"metadata.title"` → `item.metadata.title`

Default when neither `field` nor `fields` is specified: `fields={["$"]}`, which works naturally for string arrays and extracts all leaf primitives for objects.

## Section 2: Utility Functions

Two functions, independently testable, exported from core:

```typescript
// Traverses a dot-notation path against any value.
// "$" returns the value itself (root).
// Missing intermediate nodes return undefined.
export function getByPath(obj: unknown, path: string): unknown

// Recursively collects all leaf primitive values as strings.
// Arrays and objects are traversed; null/undefined are skipped;
// booleans, numbers, strings are coerced via String().
export function harvestStrings(value: unknown): string[]
```

Corpus for a single field: `harvestStrings(getByPath(doc, field)).join(' ')`

Corpus for a document:
```typescript
resolvedFields
  .map(f => harvestStrings(getByPath(doc, f)).join(' '))
  .filter(Boolean)
  .join(' ')
```

`getByPath` splits the path on `.` and traverses step by step. Numeric segments (e.g. `"0"`) index into arrays naturally — no special handling needed. Both functions live in `packages/core/src/utils/` and are re-exported from the core package index.

## Section 3: Context — `SearchEntry`

`SearchEntry` loses its `T` generic and the `mapping` function. `fields` replaces it:

```typescript
export interface SearchEntry {
  query: string
  setQuery: (q: string) => void
  patterns: string[]
  hasPatterns: boolean
  reset: () => void
  fields: string[]
  options?: SearchOptions
}

export type SearchContextValue = Record<string, SearchEntry>
```

`SearchContext` itself is unchanged. `useSearchContext()` continues to work as before. Future packages (`@quaesitor-textus/mongodb` etc.) read `fields` from `SearchEntry` to build server-side queries.

## Section 4: `useFilterFunction`

The hook loses its `T` generic. Instead of calling `entry.mapping`, it builds the corpus via the utilities:

```typescript
export function useFilterFunction(mode: 'AND' | 'OR' = 'AND') {
  const map = useContext(SearchContext)

  return useCallback(
    (item: unknown): boolean => {
      const activeEntries = Object.values(map).filter(e => e.hasPatterns)
      if (activeEntries.length === 0) return true

      const check = (entry: SearchEntry) =>
        matchItem(
          entry.fields
            .map(f => harvestStrings(getByPath(item, f)).join(' '))
            .filter(Boolean)
            .join(' '),
          entry.patterns,
          entry.options
        )

      return mode === 'AND'
        ? activeEntries.every(check)
        : activeEntries.some(check)
    },
    [map, mode]
  )
}
```

The returned predicate is `(item: unknown) => boolean`. Callers that previously wrote `useFilterFunction<Book>()` write `useFilterFunction()` — TypeScript still infers correctly at the call site.

## Section 5: Exports

Two additions to the core package's public index:

```typescript
export { getByPath } from './utils/getByPath'
export { harvestStrings } from './utils/harvestStrings'
```

Existing exports are unchanged. `WithSearchProps` and `SearchEntry` are no longer generic — any consumer importing them directly gets the non-generic version. This is a minor breaking change in the type surface but requires no code changes unless they were explicitly parameterizing these types (e.g. `SearchEntry<Book>`).

## Section 6: Stories & Documentation

**Storybook stories** — all `mapping={}` usages replaced with `field` or `fields`:
- `packages/core/stories/` — any stories using `mapping`
- `packages/antd/stories/BookSearchDemo.stories.tsx` — multi-field demo updated to `fields`

**READMEs:**
- `packages/core/README.md` — code examples updated; `getByPath` and `harvestStrings` mentioned with brief examples; `$` root token documented
- `packages/antd/README.md` — code examples updated

## Breaking Changes

- `mapping` prop removed from `WithSearch`. No migration shim — consumers update to `field` / `fields`.
- `WithSearchProps<T>` becomes `WithSearchProps` (non-generic).
- `SearchEntry<T>` becomes `SearchEntry` (non-generic).
- `useFilterFunction<T>()` becomes `useFilterFunction()` (non-generic).

## Out of Scope

- JSONPath wildcards, recursive descent, filter expressions
- Array-element-level field specs (e.g. `"tags[*].label"`)
- Named corpus functions registered server-side
- Server-side search packages (e.g. `@quaesitor-textus/mongodb`) — depend on this refactoring but are separate work
