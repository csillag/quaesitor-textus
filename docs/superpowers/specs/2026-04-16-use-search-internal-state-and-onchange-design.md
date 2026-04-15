# useSearchInternalState Refactoring and onChange Support

**Base revision:** `bcff694d21853d6a7b6dcb22cd5090cf2703cf3d` on branch `main` (as of 2026-04-15T22:56:43Z)

## Goal

Two related changes:

1. Eliminate duplicated query-state logic between `WithSearch` and `useSearch` by extracting a shared internal hook `useSearchInternalState`.
2. Add an `onChange(oldValue, newValue)` callback to both `WithSearch` and `useSearch`, implemented inside `useSearchInternalState`, so callers can react to query changes outside the scope of the search (e.g. scroll to top, reset pagination).

## Motivation

`WithSearch` and `useSearch` each independently implement the same logic: `useState` for query, `useMemo` for pattern parsing, `useCallback` for reset, and `hasPatterns` derivation. This is an accidental duplication — there was never an intention to maintain two implementations of the same state management.

## Architecture

A new private hook `useSearchInternalState` is created and used by both `WithSearch` and `useSearch`. It is not exported from the package's public API.

```
useSearchInternalState   ← new, internal
       ↑              ↑
  WithSearch        useSearch
```

## useSearchInternalState

**File:** `packages/core/src/hooks/useSearchInternalState.ts`

**Not exported** from `packages/core/src/index.ts`.

```ts
interface UseSearchInternalStateParams {
  options?: SearchOptions
  query?: string                                      // controlled mode
  onSetQuery?: (q: string) => void                   // controlled mode
  onReset?: () => void                               // controlled mode
  onChange?: (oldValue: string, newValue: string) => void
}

interface UseSearchInternalStateResult {
  query: string
  setQuery: (q: string) => void
  patterns: string[]
  hasPatterns: boolean
  reset: () => void
}
```

**Controlled/uncontrolled logic** (preserved from current `WithSearch`):

- If `query` param is `undefined` → uncontrolled: own `useState('')`, own `setInternalQuery`
- If `query` param is defined → controlled: use the provided value; `setQuery` delegates to `onSetQuery ?? noop`

**`onChange` call sites:**

`onChange` is called with `(currentQuery, newValue)` in two places:

1. Inside the wrapped `setQuery` function — before delegating to internal state or `onSetQuery`. This covers all normal typing/input changes.
2. Explicitly at the start of `reset()` when `onReset` is provided (controlled mode) — because `onReset` bypasses `setQuery`, so `onChange` would not fire otherwise.

In uncontrolled mode, `reset()` calls `setQuery('')`, so `onChange` fires naturally via case 1.

`onChange` is optional — callers that don't pass it get identical behavior to today.

`onChange` may fire even when `oldValue === newValue` (no deduplication). Callers that need to suppress no-op notifications can compare the values themselves.

## WithSearch

**File:** `packages/core/src/context/WithSearch.tsx`

Replaces its own `useState`/`useMemo`/`useCallback` state block with a call to `useSearchInternalState`, passing `options`, `query`, `onSetQuery`, `onReset`, and `onChange` through.

`executeSearch` and the context construction remain in `WithSearch` — those are context-specific concerns.

New prop added to `WithSearchProps`:

```ts
onChange?: (oldValue: string, newValue: string) => void
```

No other API changes. All existing props and behavior preserved.

## useSearch

**File:** `packages/core/src/hooks/useSearch.ts`

Replaces its own state block with a call to `useSearchInternalState({ options, onChange })`. `useSearch` always passes `query`/`onSetQuery`/`onReset` as `undefined` — it is always uncontrolled.

`filteredItems` memoization remains in `useSearch`.

New optional 4th parameter:

```ts
function useSearch<T>(
  items: T[],
  getCorpus: (item: T) => string,
  options?: SearchOptions,
  onChange?: (oldValue: string, newValue: string) => void
): UseSearchResult<T>
```

Non-breaking — existing callers are unaffected.

## Testing

**New tests in `packages/core/src/context/WithSearch.test.tsx`:**

1. `onChange` is called with correct `(oldValue, newValue)` when `setQuery` is called (uncontrolled)
2. `onChange` is called with `(oldValue, '')` when `reset()` is called in uncontrolled mode
3. `onChange` is called with `(oldValue, newValue)` when `setQuery` is called (controlled mode via `onSetQuery`)
4. `onChange` is called with `(oldValue, '')` when `reset()` is called in controlled mode with `onReset`
5. `onChange` is optional — existing behavior unchanged when not provided

**New tests in `packages/core/src/hooks/useSearch.test.ts`:**

1. `onChange` is called with correct `(oldValue, newValue)` when `setQuery` is called
2. `onChange` is called with `(oldValue, '')` when `reset()` is called
3. `onChange` is optional — existing behavior unchanged when not provided

## Out of Scope

- No changes to `SearchOptions` (remains framework-independent logic config)
- No changes to `SearchContext`, `useSearchContext`, or any component
- No changes to the antd package
- `useSearchInternalState` has no tests of its own — it is covered indirectly through `WithSearch` and `useSearch` tests
