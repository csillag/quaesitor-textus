# Controlled `WithSearch` Component

**Base revision:** `88b544756e6183ed8b325545d5ba6d7cf732c3bc` on branch `main` (as of 2026-04-15T21:44:45Z)

## Goal

Make `WithSearch` usable as a controlled component by accepting optional `query`, `onSetQuery`, and `onReset` props, while keeping the current uncontrolled (self-managed state) behavior as the default.

**Motivating use case:** storing the search term in the URL so search results are shareable — the parent owns the state (e.g. a URL query param) and passes it down.

## Architecture

`WithSearch` already owns `query`/`setQuery` via `useState`. In controlled mode, the caller supplies those values instead. The component resolves the active pair at the top of its function body; all downstream logic (pattern parsing, `executeSearch`, `hasPatterns`, `reset`) is unchanged because it already depends only on `query` and `setQuery`.

## Props Changes

### `WithSearchProps`

```ts
export interface WithSearchProps {
  options?: SearchOptions
  children: React.ReactNode
  query?: string                    // controlled value; omit for uncontrolled mode
  onSetQuery?: (q: string) => void  // called when query changes; pair with query
  onReset?: () => void              // if given, reset() calls this instead of setQuery('')
}
```

`query` and `onSetQuery` are intended to travel together. No runtime warning is added for passing one without the other (out of scope).

## Implementation

At the top of `WithSearch`, resolve the active query and setter:

```ts
const [internalQuery, setInternalQuery] = useState('')
const isControlled = controlledQuery !== undefined
const query = isControlled ? controlledQuery : internalQuery
const setQuery = isControlled ? (onSetQuery ?? (() => {})) : setInternalQuery
```

`reset` delegates to `onReset` if provided, otherwise calls `setQuery('')`:

```ts
const reset = useCallback(() => {
  if (onReset) {
    onReset()
  } else {
    setQuery('')
  }
}, [onReset, setQuery])
```

Everything else in `WithSearch` is unchanged.

## Testing

New test cases in `packages/core/src/context/WithSearch.test.tsx`:

1. Controlled mode renders with the provided `query` value (not internal state)
2. Controlled mode calls `onSetQuery` when the input changes
3. Controlled mode `reset` calls `onSetQuery('')` when no `onReset` is given
4. Controlled mode `reset` calls `onReset` (and not `onSetQuery`) when `onReset` is given

Existing tests are unaffected — uncontrolled behavior is unchanged.

## Out of Scope

- No changes to `SearchContext`, `useSearchContext`, `useSearch`, or any consumer
- No runtime warning for passing `query` without `onSetQuery`
- No changes to the `antd` package
