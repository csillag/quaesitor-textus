# Add `hasPatterns` and `reset` to Search API

**Base revision:** `e394309aea3b9d6bce82de156701e30653fdb0f1` on branch `main` (as of 2026-04-15T21:07:57Z)

## Goal

Enrich the search API with two convenience members — `hasPatterns` and `reset` — and update the `FullListDemo` story to use them for conditional rendering and a clear button.

## Architecture

Two fields are added to `UseSearchResult` in the `useSearch` hook, then propagated through `SearchContextValue` and `WithSearch` so both the raw hook and the context expose a consistent interface. The `FullListDemo` story is updated to use them.

## Changes

### `packages/core/src/hooks/useSearch.ts`

Add to `UseSearchResult<T>`:

```ts
hasPatterns: boolean   // patterns.length > 0
reset: () => void      // clears query via setQuery('')
```

`hasPatterns` is derived inline: `patterns.length > 0`.  
`reset` is stable: `useCallback(() => setQuery(''), [setQuery])` — but since `setQuery` is a React `useState` setter it is already stable, so `useCallback` with `[]` is sufficient.

### `packages/core/src/context/SearchContext.ts`

Add the same two fields to `SearchContextValue`:

```ts
hasPatterns: boolean
reset: () => void
```

### `packages/core/src/context/WithSearch.tsx`

Thread `hasPatterns` and `reset` from the `useSearch` result into the context value object.

### `packages/core/stories/FullListDemo.stories.tsx`

- Destructure `hasPatterns`, `reset`, and `query` from `useSearchContext()`.
- Wrap the result count paragraph, `<ul>`, and empty-state paragraph in `{hasPatterns && ...}` so they only render during an active search.
- Wrap `<SearchInput>` in a flex container. Add a `<button>` to its right that is rendered only when `query.length > 0`, calls `reset()` on click, and displays `×`.

## Testing

- `useSearch.test.ts`: add cases verifying `hasPatterns` is `false` on empty query, `true` after typing, and that calling `reset()` clears the query and sets `hasPatterns` back to `false`.
- No new test files needed.

## Out of scope

- No changes to `@quaesitor-textus/antd`.
- No changes to `SearchInput` or `HighlightedText` components.
- The clear button styling is intentionally minimal (inline styles in the story only).
