# Core Package README Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create `packages/core/README.md` with installation instructions and a minimal annotated React usage example demonstrating the `WithSearch` + `useSearchContext` pattern.

**Architecture:** Single Markdown file. No library code, tests, or stories are touched. Verification is done by reading the rendered output and confirming it matches the spec.

**Tech Stack:** Markdown.

---

### Task 1: Write the README

**Files:**
- Create: `packages/core/README.md`

- [ ] **Step 1: Create the file with the full content**

Write `packages/core/README.md` with exactly this content:

````markdown
# @quaesitor-textus/core

Text search and highlighting for React.

## Installation

```bash
npm install @quaesitor-textus/core
```

Requires React ≥ 18.

## Usage

### Define a consumer component

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
```

### Wire it into the tree

```tsx
export const App = () => (
  <WithSearch>
    <SearchInput placeholder="Search…" />
    <FilteredList />
  </WithSearch>
)
```

`WithSearch` owns the search state and makes it available to the tree. `SearchInput`
reads and updates the query. `FilteredList` calls `useSearchContext()` to get
`filterFunction` — a pre-bound filter predicate — and passes it to `Array.filter`.
`HighlightedText` picks up the active search patterns from context automatically.
````

- [ ] **Step 2: Verify the file looks right**

```bash
cat packages/core/README.md
```

Check:
1. Title is `# @quaesitor-textus/core`.
2. Installation section has the `npm install` command and the React ≥ 18 peer dep note.
3. Usage has two subsections: "Define a consumer component" and "Wire it into the tree".
4. The import line includes all four names: `WithSearch`, `SearchInput`, `useSearchContext`, `HighlightedText`.
5. `FilteredList` uses `filterFunction` from `useSearchContext()` and `items.filter(filterFunction)`.
6. `<HighlightedText text={item} />` has no `patterns` prop.
7. `App` contains exactly `<WithSearch>`, `<SearchInput placeholder="Search…" />`, and `<FilteredList />`.
8. The closing paragraph mentions all four roles.

- [ ] **Step 3: Commit**

```bash
git add packages/core/README.md
git commit -m "docs(core): add README with installation and usage example"
```
