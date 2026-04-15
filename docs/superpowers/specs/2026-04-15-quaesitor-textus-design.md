# quaesitor-textus — Library Design

**Base revision:** `initial project state (no commits)` on branch `main` (as of 2026-04-15T00:00:00Z)

## Summary

`quaesitor-textus` is a playful, TypeScript-first Node.js library for text search, filtering, and highlighting. It targets UI-side list filtering as its primary use case, with a React context-based API that makes wiring up search to any component tree effortless. Future packages will cover backend query generation (MongoDB, PostgreSQL, etc.).

---

## Repository Structure

pnpm workspaces monorepo. Two publishable packages to start.

```
quaesitor-textus/
  pnpm-workspace.yaml
  package.json                        ← workspace root (not published)
  packages/
    core/                             → @quaesitor-textus/core
      src/
        logic/                        ← pure TS, zero dependencies
        hooks/                        ← React hooks
        components/                   ← SearchInput, HighlightedText
        index.ts
      .storybook/
      stories/
      package.json
    antd/                             → @quaesitor-textus/antd
      src/
        components/                   ← SearchInput (Ant Design styled)
        index.ts
      package.json
  .github/
    workflows/
      storybook.yml                   ← build + deploy Storybook to GitHub Pages on push to main
```

---

## Package 1: `@quaesitor-textus/core`

### Dependencies
- Peer: `react`
- No other runtime dependencies

### 1. Pure Logic Layer (`src/logic/`)

Zero-dependency TypeScript functions. Usable outside React (e.g. future backend packages).

#### Shared options type

```ts
interface SearchOptions {
  caseSensitive?: boolean       // default: false
  diacriticSensitive?: boolean  // default: false
  minLength?: number            // default: 2
}
```

#### `parseInput(text, options?): string[]`

1. Trim leading/trailing whitespace.
2. Split on single space `' '` (comma is not a separator).
3. Remove empty strings (handles multiple consecutive spaces).
4. If result is a single pattern shorter than `minLength`, return `[]` (filter inactive — all items pass).
5. Return the array of patterns.

#### `normalizeText(text, options?): string`

1. Apply Unicode NFD normalization.
2. Strip combining diacritical marks (`U+0300–U+036F`) unless `diacriticSensitive: true`.
3. Apply `toLowerCase()` unless `caseSensitive: true`.

#### `matchItem(corpus, patterns, options?): boolean`

Normalizes corpus and each pattern, then checks `normalizedCorpus.indexOf(normalizedPattern) !== -1` for every pattern. Returns `true` only if **all** patterns match (AND logic). Order does not matter; overlapping matches are allowed.

#### `getHighlightPositions(text, patterns, options?): HighlightSpan[]`

```ts
interface HighlightSpan {
  start: number
  end: number
}
```

1. For each pattern, run `indexOf` on the **normalized** corpus to find `start`. `end = start + rawPattern.length` (raw, un-normalized length — known caveat: positions may be slightly off when normalization changes string length).
2. Sort spans by `start` ascending.
3. Discard overlapping spans: if a span's `start` is less than the current cursor position, skip it.
4. Return the clean, non-overlapping list.

---

### 2. React Layer

#### `<WithSearch>` — context provider, owns query state

```tsx
interface WithSearchProps {
  options?: SearchOptions
  children: React.ReactNode
}
```

Manages `query` string state and derives `patterns` from it via `parseInput`. Exposes state and `executeSearch` via React context. Does not know about any specific items or data.

#### `useSearchContext()` — context consumer hook

```ts
interface SearchContextValue {
  query: string
  setQuery: (q: string) => void
  patterns: string[]
  executeSearch: <T>(items: T[], getCorpus: (item: T) => string) => T[]
}
```

- Throws a clear error if called outside `<WithSearch>`.
- `executeSearch` is a stable memoized function that is replaced only when `patterns` changes. It applies the current `patterns` to the provided `items` using `matchItem`. The caller supplies `getCorpus` to define which fields are searched — e.g. `item => item.name + ' ' + item.description`.
- Multiple components in the same tree can each call `executeSearch` with their own independent item lists, all driven by the same query.

#### `<SearchInput>` — unstyled controlled input

```tsx
interface SearchInputProps {
  placeholder?: string
  // standard HTML input props forwarded (className, style, autoFocus, etc.)
}
```

Reads `query` and `setQuery` from context. No required props. This is the base that `@quaesitor-textus/antd` replaces with a styled version.

#### `<HighlightedText>` — renders text with `<mark>` spans

```tsx
interface HighlightedTextProps {
  text: string
  patterns?: string[]           // optional override; defaults to patterns from context
  options?: SearchOptions
  markStyle?: React.CSSProperties
  // default markStyle: { background: '#FFFF5480', padding: '2px', margin: '-2px' }
}
```

Calls `getHighlightPositions` internally. Reads `patterns` from context by default; `patterns` prop overrides for standalone use outside `<WithSearch>`. If neither context nor prop provides patterns, renders text unhighlighted (no error).

#### `useSearch` — lower-level escape hatch (also exported)

```ts
function useSearch<T>(
  items: T[],
  getCorpus: (item: T) => string,
  options?: SearchOptions
): {
  query: string
  setQuery: (q: string) => void
  patterns: string[]
  filteredItems: T[]
}
```

For consumers who want the logic without the context pattern.

---

### 3. Storybook

Storybook lives in `packages/core` and serves as the interactive demo and public-facing website.

Stories:
- **`HighlightedText`** — various patterns, overlapping matches, diacritics, empty patterns
- **`SearchInput`** — within a `<WithSearch>`, typing behavior
- **Full list demo** — ~100 random English phrases, live filtering with `executeSearch`, highlights rendered via `<HighlightedText>`

---

## Package 2: `@quaesitor-textus/antd`

### Dependencies
- Peer: `react`, `antd`, `@quaesitor-textus/core`
- No runtime dependencies of its own

### `<SearchInput>` — Ant Design styled drop-in

Wraps Ant Design's `Input` (or `Input.Search`) with the same zero-required-props API as the core `SearchInput`. Reads `query`/`setQuery` from `WithSearch` context. Accepts any `antd` `InputProps` as passthrough.

```tsx
import { SearchInput } from '@quaesitor-textus/antd'

<WithSearch>
  <SearchInput placeholder="Filter..." size="large" />
</WithSearch>
```

This is the entire package — intentionally thin. All logic lives in `@quaesitor-textus/core`.

---

## GitHub Pages / CI

`.github/workflows/storybook.yml` triggers on push to `main`:
1. Install dependencies (`pnpm install`)
2. Build Storybook from `packages/core`
3. Deploy build output to GitHub Pages via `actions/deploy-pages`

The deployed Storybook is the library's public website.

---

## Matching Semantics (from reference implementation)

- **Input:** trim → split on space → remove empty → apply `minLength` threshold
- **Corpus:** caller-defined via `getCorpus` function
- **Normalization:** diacritic removal (NFD + strip `U+0300–U+036F`) + lowercasing, both configurable
- **Matching:** substring (`indexOf`), AND logic across all patterns
- **Highlighting:** sorted non-overlapping spans, `<mark>` elements, default semi-transparent yellow

---

## Out of Scope (future packages)

- `@quaesitor-textus/mui` — Material UI styled `SearchInput`
- `@quaesitor-textus/raw` — raw React styled `SearchInput` (no UI framework)
- `@quaesitor-textus/mongo` — MongoDB query builder from patterns
- `@quaesitor-textus/pg` — PostgreSQL query builder from patterns
- Demo app (`packages/quaesitor-textus-demo`) — vite + raw React todo-like app
