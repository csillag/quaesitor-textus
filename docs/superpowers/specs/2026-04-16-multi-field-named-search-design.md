# Multi-field Named Search

**Base revision:** `9bec3025844c576038a886aece2ee5ca6b604a84` on branch `main` (as of 2026-04-16T13:44:07Z)

## Summary

The library currently supports only a single search context per component tree. Nesting two `WithSearch` providers causes the inner one to merge and eclipse the outer one's patterns, making multi-field search (e.g. searching by both book title and author) impossible. This design replaces the single flat context value with a named key/value map, allowing multiple independent `WithSearch` instances to coexist and enabling `HighlightedText` and `useFilterFunction` to reference specific named searches.

## Breaking changes

- `highlightedPatterns` is removed from the context value.
- `filterFunction` is removed from the return value of `useSearchContext`.
- `HighlightedText` no longer auto-picks up context patterns. Existing usages must add `all` or `searchNames` props. Migration: add `all` to any `<HighlightedText>` that previously relied on implicit context highlights.

## Context shape

The context value changes from a flat object to a generic named map.

```ts
interface SearchEntry<T> {
  query: string
  setQuery: (q: string) => void
  patterns: string[]
  hasPatterns: boolean
  reset: () => void
  mapping: (item: T) => string
  options?: SearchOptions
}

type SearchContextValue<T> = Record<string, SearchEntry<T>>
```

The React context itself is stored as `Record<string, SearchEntry<unknown>>` (React contexts cannot be generic). Type safety for `T` is enforced at the hook and component call sites.

`highlightedPatterns` is removed entirely from the context.

## `WithSearch`

New props:
- `name?: string` — identifies this search in the map. Defaults to `"default search"`.
- `mapping?: (item: T) => string` — extracts the searchable corpus from a domain object. Defaults to the existing `String(item)` conversion already present in the codebase.

Behavior:
- Reads the upstream `Record<string, SearchEntry<unknown>>` from context (empty object at the root).
- **Throws** if `name` already exists in the upstream map — duplicate names are a programmer error.
- Creates its own entry and provides the augmented map downward via context.
- The old `upstreamCtx.highlightedPatterns` merge logic is removed.

## `SearchInput` (core and antd)

New prop:
- `name?: string` — defaults to `"default search"`.

Uses `useSearchContext(name)` internally to connect to the correct map entry. Both `@quaesitor-textus/core` and `@quaesitor-textus/antd` `SearchInput` components receive this prop.

## `useSearchContext(name?: string)`

- `name` defaults to `"default search"`.
- Throws if the requested name is not found in the map.
- Returns `{ query, setQuery, patterns, hasPatterns, reset }`.
- **`filterFunction` is removed** from the return value.

## `HighlightedText`

New props:
- `searchNames?: string | string[]` — names of search entries whose patterns to include. A single string is treated as a one-element array.
- `all?: boolean` — if true, include patterns from all entries in the map.

Pattern resolution:
1. If `all` is true → collect patterns from every entry in the map, plus any locally provided patterns.
2. Else if `searchNames` is given → collect patterns from those named entries, plus local patterns. Any name not found in the map produces a `console.warn` and is skipped.
3. Else → local patterns only (no context patterns).

## `useFilterFunction<T>(mode?: "AND" | "OR")`

A new hook. `mode` defaults to `"AND"`.

Returns `(item: T) => boolean`:

- If no entries in the map have patterns → returns `true` (no active search, no filtering).
- **AND mode**: iterate all entries that have patterns. For each, extract `mapping(item)` and run `matchItem` against the entry's patterns. Return `false` on the first miss; return `true` if all pass.
- **OR mode**: same iteration. Return `true` on the first entry whose `mapping(item)` matches all of its own patterns. Return `false` if no entry matches.

In both modes, entries with zero patterns are neutral and do not participate in the evaluation.

If an entry has patterns but no `mapping` was provided to its `WithSearch`, the default `String(item)` conversion is used (same as the `WithSearch` default), so this situation is handled transparently.

## Removals

- `highlightedPatterns` field removed from `SearchContextValue` and all usages.
- `filterFunction` removed from `useSearchContext` return value and its internal construction logic.
- The `upstreamCtx` read and merge in `WithSearch` is removed.

## BookSearchDemo story (core and antd)

A new story demonstrating multi-field search over a list of 500 classical books.

### Data model and test data file

```ts
interface Book {
  author: string
  title: string
  year: number
}
```

A shared data file (`stories/data/books.ts`) exports an array of 500 classical books with `author`, `title`, and `year`. The file is shared between both storybook packages (or duplicated if the packages cannot share files).

### Story structure

Both stories use two nested `WithSearch` providers:

```tsx
<WithSearch name="author" mapping={(book: Book) => book.author}>
  <WithSearch name="title" mapping={(book: Book) => book.title}>
    <BookSearchDemo />
  </WithSearch>
</WithSearch>
```

Inside `BookSearchDemo`:
- Two `SearchInput` fields side by side: `name="author"` with placeholder `"Search for author"`, and `name="title"` with placeholder `"Search for title"`.
- A mode toggle switch (AND / OR) that controls the `mode` passed to `useFilterFunction<Book>`.
- `useFilterFunction<Book>(mode)` produces the filter function applied to the books array.
- A match count line (e.g. `"42 of 500 books"`) shown when either search has patterns.

### Result rendering

Each row shows:
- Author: `<HighlightedText text={book.author} searchNames="author" />`
- Title: `<HighlightedText text={book.title} searchNames="title" />`
- Year: plain text, no highlighting.

### Core story

Plain `<ul>` list, one `<li>` per book, following the same style as `FullListDemo` in the core package. Show all results (no pagination).

### Antd story

`<Table>` with pagination (pageSize 10), following the same pattern as `FullListDemo` in the antd package. Three columns: Author, Title, Year. No enter-to-select behaviour needed.
