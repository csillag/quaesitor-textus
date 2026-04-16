# Core Package README

**Base revision:** `6bbc88b002216457f326d7b44ce12ec46fffdf98` on branch `main` (as of 2026-04-16T02:00:38Z)

## Goal

Add a `README.md` to `packages/core` with installation instructions and a minimal React usage example that demonstrates the `WithSearch` + `useSearchContext` pattern.

## Scope

Single file: `packages/core/README.md`. No changes to library code, tests, or stories.

## Structure

Option B: one-sentence intro, installation, annotated usage example in two named sections, closing explanation paragraph.

### Title and intro

```markdown
# @quaesitor-textus/core

Text search and highlighting for React.
```

### Installation

```markdown
## Installation

```bash
npm install @quaesitor-textus/core
```

Requires React ≥ 18.
```

### Usage

Two named sections.

**"Define a consumer component"** — shows `FilteredList`. A comment above the component explains why it is isolated. The body calls `useSearchContext()` to get `filterFunction`, filters the items array with it, and renders each result with `<HighlightedText text={item} />` (no `patterns` prop needed — `HighlightedText` reads patterns from context automatically).

**"Wire it into the tree"** — shows the `App` component: `WithSearch` wrapping `SearchInput` and `FilteredList`. This section is intentionally short to show how clean the tree reads when the filtering logic lives in `FilteredList`.

Full code block:

```tsx
import { WithSearch, SearchInput, useSearchContext, HighlightedText } from '@quaesitor-textus/core'

const items = ['Apple', 'Banana', 'Cherry', 'Date', 'Elderberry']

// FilteredList runs the search and renders results.
// Keeping it separate makes the App tree easy to read.
const FilteredList = () => {
  const { filterFunction } = useSearchContext()
  const results = items.filter(filterFunction)
  return (
    <ul>
      {results.map(item => (
        <li key={item}>
          <HighlightedText text={item} />
        </li>
      ))}
    </ul>
  )
}

export const App = () => (
  <WithSearch>
    <SearchInput placeholder="Search…" />
    <FilteredList />
  </WithSearch>
)
```

### Closing explanation paragraph

```markdown
`WithSearch` owns the search state and makes it available to the tree. `SearchInput`
reads and updates the query. `FilteredList` calls `useSearchContext()` to get
`filterFunction` — a pre-bound filter predicate — and passes it to `Array.filter`.
`HighlightedText` picks up the active search patterns from context automatically.
```

## Notes

- The example uses a plain `string[]` so `useSearchContext()` needs no configuration. For object arrays, pass a mapping: `useSearchContext<MyItem>({ mapping: item => item.name })`.
- This note is **not** included in the README — the README stays minimal. It is recorded here for the implementer's awareness.
