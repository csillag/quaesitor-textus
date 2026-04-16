# filterFunction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `executeSearch` on `SearchContextValue` / `useSearchContext` with a `filterFunction` that can be passed directly to `Array.filter`, with the item-to-corpus mapping supplied as an optional argument to `useSearchContext`.

**Architecture:** `useSearchContext` becomes generic (`T = string`) and accepts an optional `ItemOptions<T>` argument containing a `mapping` function. It constructs a `filterFunction: (item: T) => boolean` via `useMemo`, calling `matchItem` directly. `SearchContextValue` loses `executeSearch` with nothing replacing it at the context level — the function factory logic moves entirely into `useSearchContext`.

**Tech Stack:** TypeScript, React (`useMemo`, `useContext`), Vitest, React Testing Library.

**Worktree:** `.worktrees/filter-function` on branch `feature/filter-function`

**Run all core tests:** `pnpm --filter @quaesitor-textus/core test`
**Run all antd tests (requires core build):** `pnpm --filter @quaesitor-textus/core build && pnpm --filter @quaesitor-textus/antd test`

---

## File Map

| File | Change |
|------|--------|
| `packages/core/src/context/SearchContext.ts` | Remove `executeSearch` from `SearchContextValue` |
| `packages/core/src/context/WithSearch.tsx` | Remove `executeSearch` useMemo block and context value entry |
| `packages/core/src/context/useSearchContext.ts` | Make generic, add `ItemOptions<T>`, build and return `filterFunction` |
| `packages/core/src/index.ts` | Export `ItemOptions` type |
| `packages/core/src/context/WithSearch.test.tsx` | Add `filterFunction` tests; update `TestConsumer` to use `filterFunction` |
| `packages/core/src/components/HighlightedTrimmedText.test.tsx` | Remove `executeSearch` from mock context helper |
| `packages/core/stories/FullListDemo.stories.tsx` | Replace `executeSearch` with `filterFunction` |
| `packages/antd/stories/FullListDemo.stories.tsx` | Replace `executeSearch` with `filterFunction` |

---

### Task 1: Write failing tests for `filterFunction`

**Files:**
- Modify: `packages/core/src/context/WithSearch.test.tsx`

- [ ] **Step 1: Add `FilterConsumer` component and three new tests**

  Insert after the `ResetConsumer` component (after line 28) in `WithSearch.test.tsx`:

  ```tsx
  const FilterConsumer = ({ items, getCorpus }: { items: Item[]; getCorpus: (i: Item) => string }) => {
    const { filterFunction } = useSearchContext<Item>({ mapping: getCorpus })
    return <div data-testid="filter-count">{items.filter(filterFunction).length}</div>
  }

  const StringFilterConsumer = ({ items }: { items: string[] }) => {
    const { filterFunction } = useSearchContext<string>()
    return <div data-testid="string-count">{items.filter(filterFunction).length}</div>
  }
  ```

  Add these tests at the end of the `describe` block (before the closing `})`):

  ```tsx
  it('filterFunction returns all items when query is empty', () => {
    render(
      <WithSearch>
        <FilterConsumer items={items} getCorpus={getCorpus} />
      </WithSearch>
    )
    expect(screen.getByTestId('filter-count')).toHaveTextContent('3')
  })

  it('filterFunction filters items using provided mapping', () => {
    render(
      <WithSearch query="an" onSetQuery={() => {}}>
        <FilterConsumer items={items} getCorpus={getCorpus} />
      </WithSearch>
    )
    expect(screen.getByTestId('filter-count')).toHaveTextContent('1')
  })

  it('filterFunction works with default string type (no mapping)', () => {
    const strings = ['Apple', 'Banana', 'Cherry']
    render(
      <WithSearch query="an" onSetQuery={() => {}}>
        <StringFilterConsumer items={strings} />
      </WithSearch>
    )
    expect(screen.getByTestId('string-count')).toHaveTextContent('1')
  })
  ```

- [ ] **Step 2: Run tests to verify they fail**

  ```bash
  pnpm --filter @quaesitor-textus/core test 2>&1 | grep -E "FAIL|filterFunction|error|Error" | head -20
  ```

  Expected: TypeScript errors — `filterFunction` does not exist on the return type of `useSearchContext`.

---

### Task 2: Implement `filterFunction` in `useSearchContext`

**Files:**
- Modify: `packages/core/src/context/useSearchContext.ts`

- [ ] **Step 1: Rewrite `useSearchContext.ts`**

  Replace the entire file content with:

  ```ts
  import { useContext, useMemo } from 'react'
  import { SearchContext } from './SearchContext'
  import { matchItem } from '../logic/matchItem'

  export interface ItemOptions<T> {
    mapping?: (item: T) => string
  }

  export function useSearchContext<T = string>(itemOptions?: ItemOptions<T>) {
    const ctx = useContext(SearchContext)
    if (!ctx) {
      throw new Error('useSearchContext must be used within <WithSearch>')
    }
    const { query, setQuery, patterns, highlightedPatterns, hasPatterns, reset } = ctx
    const mapping: (item: T) => string =
      itemOptions?.mapping ?? ((x: unknown) => x as string)
    const filterFunction = useMemo(
      () =>
        (item: T): boolean =>
          matchItem(mapping(item), patterns),
      [mapping, patterns]
    )
    return { query, setQuery, patterns, highlightedPatterns, filterFunction, hasPatterns, reset }
  }
  ```

- [ ] **Step 2: Run core tests to verify new tests pass**

  ```bash
  pnpm --filter @quaesitor-textus/core test 2>&1 | tail -15
  ```

  Expected: All tests pass — `filterFunction` tests pass, existing `executeSearch` tests still pass (the field still exists on `SearchContextValue`).

---

### Task 3: Remove `executeSearch` from `SearchContextValue`

**Files:**
- Modify: `packages/core/src/context/SearchContext.ts`

- [ ] **Step 1: Remove the `executeSearch` field from the interface**

  Replace the file content with:

  ```ts
  import { createContext } from 'react'

  export interface SearchContextValue {
    query: string
    setQuery: (q: string) => void
    patterns: string[]
    highlightedPatterns: string[]
    hasPatterns: boolean
    reset: () => void
  }

  export const SearchContext = createContext<SearchContextValue | null>(null)
  ```

- [ ] **Step 2: Run tests to observe TypeScript failures**

  ```bash
  pnpm --filter @quaesitor-textus/core test 2>&1 | grep -E "error|Error|executeSearch" | head -20
  ```

  Expected: TypeScript compilation errors in `WithSearch.tsx` (provides `executeSearch`), `WithSearch.test.tsx` (TestConsumer reads it), `HighlightedTrimmedText.test.tsx` (mock context includes it).

---

### Task 4: Remove `executeSearch` from `WithSearch`

**Files:**
- Modify: `packages/core/src/context/WithSearch.tsx`

- [ ] **Step 1: Replace the file with the updated version**

  The current file has `highlightedPatterns` accumulation already in place. Remove the `executeSearch` useMemo block (lines 37–45), the `matchItem` import (line 4), and the `caseSensitive`/`diacriticSensitive` destructure (line 25). Also remove `executeSearch` from the `value` object.

  Replace `packages/core/src/context/WithSearch.tsx` with:

  ```tsx
  import React, { useContext, useMemo } from 'react'
  import { SearchContext } from './SearchContext'
  import type { SearchContextValue } from './SearchContext'
  import type { SearchOptions } from '../logic/types'
  import { useSearchInternalState } from '../hooks/useSearchInternalState'

  export interface WithSearchProps {
    options?: SearchOptions
    children: React.ReactNode
    query?: string
    onSetQuery?: (q: string) => void
    onReset?: () => void
    onChange?: (oldValue: string, newValue: string) => void
  }

  export function WithSearch({
    options,
    children,
    query: controlledQuery,
    onSetQuery,
    onReset,
    onChange,
  }: WithSearchProps) {
    const { query, setQuery, patterns, hasPatterns, reset } = useSearchInternalState({
      options,
      query: controlledQuery,
      onSetQuery,
      onReset,
      onChange,
    })

    const upstreamCtx = useContext(SearchContext)

    const highlightedPatterns = useMemo(
      () => [...new Set([...(upstreamCtx?.highlightedPatterns ?? []), ...patterns])],
      [upstreamCtx?.highlightedPatterns, patterns]
    )

    const value: SearchContextValue = useMemo(
      () => ({ query, setQuery, patterns, highlightedPatterns, hasPatterns, reset }),
      [query, setQuery, patterns, highlightedPatterns, hasPatterns, reset]
    )

    return <SearchContext.Provider value={value}>{children}</SearchContext.Provider>
  }
  ```

- [ ] **Step 2: Run tests — TypeScript should now pass for WithSearch.tsx**

  ```bash
  pnpm --filter @quaesitor-textus/core test 2>&1 | grep -E "error|Error|executeSearch" | head -20
  ```

  Expected: Remaining errors only in `WithSearch.test.tsx` (TestConsumer) and `HighlightedTrimmedText.test.tsx`.

---

### Task 5: Update `TestConsumer` in `WithSearch.test.tsx`

**Files:**
- Modify: `packages/core/src/context/WithSearch.test.tsx`

- [ ] **Step 1: Replace `TestConsumer` to use `filterFunction` instead of `executeSearch`**

  Replace the `TestConsumer` component (lines 9–23) with:

  ```tsx
  const TestConsumer = ({ items, getCorpus }: { items: Item[]; getCorpus: (i: Item) => string }) => {
    const { query, setQuery, patterns, filterFunction } = useSearchContext<Item>({ mapping: getCorpus })
    return (
      <div>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          data-testid="input"
        />
        <div data-testid="count">{items.filter(filterFunction).length}</div>
        <div data-testid="patterns">{patterns.join(',')}</div>
      </div>
    )
  }
  ```

- [ ] **Step 2: Rename the two `executeSearch` test descriptions**

  - `'executeSearch returns all items when query is empty'` → `'filterFunction returns all items when query is empty'`
  - `'executeSearch filters items as query changes'` → `'filterFunction filters items as query changes'`

- [ ] **Step 3: Run core tests — all should pass**

  ```bash
  pnpm --filter @quaesitor-textus/core test 2>&1 | tail -10
  ```

  Expected: All tests pass.

---

### Task 6: Remove `executeSearch` from `HighlightedTrimmedText.test.tsx`

**Files:**
- Modify: `packages/core/src/components/HighlightedTrimmedText.test.tsx`

- [ ] **Step 1: Remove `executeSearch` from the `makeCtx` helper**

  Replace the `makeCtx` function (lines 7–17) with:

  ```ts
  function makeCtx(highlightedPatterns: string[]): SearchContextValue {
    return {
      query: '',
      setQuery: () => {},
      patterns: highlightedPatterns,
      highlightedPatterns,
      hasPatterns: highlightedPatterns.length > 0,
      reset: () => {},
    }
  }
  ```

- [ ] **Step 2: Run core tests — all should pass**

  ```bash
  pnpm --filter @quaesitor-textus/core test 2>&1 | tail -10
  ```

  Expected: All 100+ tests pass.

- [ ] **Step 3: Commit**

  ```bash
  git add packages/core/src/context/SearchContext.ts \
          packages/core/src/context/WithSearch.tsx \
          packages/core/src/context/useSearchContext.ts \
          packages/core/src/context/WithSearch.test.tsx \
          packages/core/src/components/HighlightedTrimmedText.test.tsx
  git commit -m "feat(core): replace executeSearch with filterFunction on useSearchContext"
  ```

---

### Task 7: Update `core` story

**Files:**
- Modify: `packages/core/stories/FullListDemo.stories.tsx`

- [ ] **Step 1: Replace `executeSearch` with `filterFunction`**

  Replace lines 13–14:

  ```tsx
  const { executeSearch, patterns, hasPatterns, reset } = useSearchContext()
  const filtered = executeSearch(phrases, item => item)
  ```

  With:

  ```tsx
  const { filterFunction, hasPatterns, reset } = useSearchContext<string>()
  const filtered = phrases.filter(filterFunction)
  ```

  Also remove `patterns` from the destructure since it is only used for `HighlightedText`. That component now reads from context automatically — remove the `patterns={patterns}` prop on `<HighlightedText>`:

  ```tsx
  <HighlightedText text={phrase} />
  ```

- [ ] **Step 2: Verify the story builds**

  ```bash
  pnpm --filter @quaesitor-textus/core build 2>&1 | tail -5
  ```

  Expected: Build success (no TypeScript errors in stories).

---

### Task 8: Update `antd` story

**Files:**
- Modify: `packages/antd/stories/FullListDemo.stories.tsx`

- [ ] **Step 1: Replace `executeSearch` with `filterFunction`**

  Replace lines 23–24:

  ```tsx
  const { executeSearch, patterns, hasPatterns, reset } = useSearchContext()
  const filtered = executeSearch(phrases, item => item)
  ```

  With:

  ```tsx
  const { filterFunction, hasPatterns, reset } = useSearchContext<string>()
  const filtered = phrases.filter(filterFunction)
  ```

  Also update the column `render` to remove the `patterns={patterns}` prop:

  ```tsx
  render: (phrase: string) => <HighlightedText text={phrase} />,
  ```

- [ ] **Step 2: Run antd tests**

  ```bash
  pnpm --filter @quaesitor-textus/core build && pnpm --filter @quaesitor-textus/antd test 2>&1 | tail -10
  ```

  Expected: All 7 antd tests pass.

- [ ] **Step 3: Commit**

  ```bash
  git add packages/core/stories/FullListDemo.stories.tsx \
          packages/antd/stories/FullListDemo.stories.tsx
  git commit -m "chore(stories): update FullListDemo stories to use filterFunction"
  ```

---

### Task 9: Export `ItemOptions` and final verification

**Files:**
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Add `ItemOptions` export**

  In the `# Context` section of `packages/core/src/index.ts`, add:

  ```ts
  export type { ItemOptions } from './context/useSearchContext'
  ```

- [ ] **Step 2: Run full test suite**

  ```bash
  pnpm --filter @quaesitor-textus/core build && pnpm test 2>&1 | tail -15
  ```

  Expected: All tests pass across both packages.

- [ ] **Step 3: Commit**

  ```bash
  git add packages/core/src/index.ts
  git commit -m "feat(core): export ItemOptions type"
  ```
