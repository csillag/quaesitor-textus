# antd Package README Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create `packages/antd/README.md` with a short description and a minimal usage example showing `SearchInput` from `@quaesitor-textus/antd` alongside core components.

**Architecture:** Single Markdown file. No library code, tests, or stories are touched.

**Tech Stack:** Markdown.

---

### Task 1: Write the README

**Files:**
- Create: `packages/antd/README.md`

- [ ] **Step 1: Create the file with the full content**

Write `packages/antd/README.md` with exactly this content:

````markdown
# @quaesitor-textus/antd

Ant Design `SearchInput` for [@quaesitor-textus/core](https://github.com/csillag/quaesitor-textus).

## Installation

```bash
npm install @quaesitor-textus/antd
```

Requires `antd ≥ 5` and `react ≥ 18`.

## Usage

### Define a consumer component

```tsx
import { WithSearch, useSearchContext, HighlightedText } from '@quaesitor-textus/core'
import { SearchInput } from '@quaesitor-textus/antd'

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

`SearchInput` is an antd `Input` with a built-in clear button. The search state and
filtering logic are provided by `@quaesitor-textus/core`.
````

- [ ] **Step 2: Verify the file looks right**

```bash
cat packages/antd/README.md
```

Check:
1. Title is `# @quaesitor-textus/antd`.
2. Intro line links to the core package on GitHub.
3. Installation section has `npm install @quaesitor-textus/antd` and the peer dep note.
4. `SearchInput` is imported from `@quaesitor-textus/antd`; `WithSearch`, `useSearchContext`, `HighlightedText` from `@quaesitor-textus/core`.
5. `FilteredList` uses `filterFunction` from `useSearchContext()` and `items.filter(filterFunction)`.
6. `<HighlightedText text={item} />` has no `patterns` prop.
7. `App` contains `<WithSearch>`, `<SearchInput placeholder="Search…" />`, and `<FilteredList />`.
8. Closing sentence mentions antd `Input` and `@quaesitor-textus/core`.

- [ ] **Step 3: Commit**

```bash
git add packages/antd/README.md
git commit -m "docs(antd): add README with installation and usage example"
```
